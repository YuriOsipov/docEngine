import { getRegistryFromNode } from '../registry/registry-context.js';
import {
  createDefaultSchema,
} from '../core/field-schemas.js';
import { allocateFieldIdentity } from '../core/field-id.js';
import {
  createFieldToken,
  readTokenValue,
  wireDesignFieldToken,
  insertFieldTokenAtCaret,
  insertLineBreakAtCaret,
  insertPlainTextAtCaret,
  normalizeEditableLineStructure,
  serializeEditableToSegments,
  renderSegmentsToDom,
  focusCaretAfter,
} from './inline-fields.js';
import {
  getFieldTokensForClipboard,
  selectDesignToken,
  clearDesignTokenSelection,
} from './field-selection.js';

export const FIELD_CLIPBOARD_MIME = 'application/x-docengine-field';

const LAYOUT_BLOCK_SELECTOR = '.document-columns, .document-table';
const PROSE_EDITABLE_SELECTOR =
  '.document-section__body, .document-columns__col, .template-block__inline';

let internalFieldClipboard: any = null;
/** Prevents body+column from inserting the same payload twice. */
let lastPasteStamp = 0;
let lastPastePayloadKey = '';
/**
 * While true, block native `beforeinput` insertFromPaste. Nested contenteditables often
 * still apply clipboard text/plain after our structured paste even when paste was canceled.
 */
let suppressNativePaste = false;

function armNativePasteSuppression() {
  suppressNativePaste = true;
  queueMicrotask(() => {
    suppressNativePaste = false;
  });
  // beforeinput can land in a later task in some browsers
  setTimeout(() => {
    suppressNativePaste = false;
  }, 0);
}
/** Inspect a live Range without mutating it (same idea as native prose DnD). */
function rangeContainsSelector(range: Range | null | undefined, selector: string) {
  if (!range || range.collapsed || !selector) return false;
  try {
    const clone = range.cloneContents();
    const wrap = document.createElement('div');
    wrap.appendChild(clone);
    return !!wrap.querySelector(selector);
  } catch {
    return false;
  }
}

/**
 * Innermost prose editable for a node. Columns nest inside the section body, and both
 * wire clipboard handlers — only the innermost must handle cut/copy/paste.
 */
export function resolveProseClipboardEditable(node: any) {
  if (!node) return null;
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? node
      : node.parentElement ?? node.parentNode ?? null;
  return el?.closest?.(PROSE_EDITABLE_SELECTOR) ?? null;
}

function isPrimaryClipboardEditable(editable: any, node: any) {
  return !!editable && resolveProseClipboardEditable(node) === editable;
}

function stripClipboardChrome(root: any) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('.editor-drag-handle').forEach((el: any) => el.remove());
}

function shouldSkipDuplicatePaste(payload: any) {
  const key = JSON.stringify(payload ?? null);
  const now = Date.now();
  if (key && key === lastPastePayloadKey && now - lastPasteStamp < 100) {
    return true;
  }
  lastPasteStamp = now;
  lastPastePayloadKey = key;
  return false;
}

function resolveRegistry(options: any, editable: any) {
  if (typeof options?.getRegistry === 'function') return options.getRegistry();
  return getRegistryFromNode(editable);
}

function isFieldIdInUse(fieldId: any, reservedIds: any = new Set(), root: any = document) {
  if (!fieldId || reservedIds.has(fieldId)) return true;
  const scope = root.closest?.('[data-doc-editor]') ?? root;
  return !!scope.querySelector(`.field-token[data-field-id="${CSS.escape(fieldId)}"]`);
}

function buildItemFromToken(token: any, registry: any) {
  const fieldId = token.dataset.fieldId;
  const schema = registry?.getFieldSchemas()?.[fieldId];
  return {
    fieldId,
    value: readTokenValue(token),
    placeholder: token.dataset.placeholder ?? '',
    schema: schema ? JSON.parse(JSON.stringify(schema)) : null,
  };
}

function buildPayload(tokens: any, action: any, registry: any) {
  return {
    version: 2,
    action,
    items: tokens.map((token: any) => buildItemFromToken(token, registry)),
  };
}

/**
 * Non-collapsed selection in this editable that includes field tokens (and not layout blocks).
 * Same spirit as native prose DnD: preserve interleaved text + fields.
 */
export function getProseFragmentSelectionRange(editable: any) {
  if (!editable) return null;
  const sel = window.getSelection();
  if (!sel?.rangeCount || sel.isCollapsed) return null;

  let range: Range;
  try {
    range = sel.getRangeAt(0);
  } catch {
    return null;
  }

  const startIn = editable.contains(range.startContainer);
  const endIn = editable.contains(range.endContainer);
  if (!startIn || !endIn) return null;

  // Selection lives in a nested column — only that column's handler owns it.
  if (!isPrimaryClipboardEditable(editable, range.startContainer)) return null;

  if (rangeContainsSelector(range, LAYOUT_BLOCK_SELECTOR)) return null;
  if (!rangeContainsSelector(range, '.field-token')) return null;

  return range;
}

/**
 * Serialize a live selection to clipboard payload v3 (segments + schemas/values).
 */
export function buildProseFragmentPayload(range: Range, action: any, registry: any) {
  const wrap = document.createElement('div');
  try {
    wrap.appendChild(range.cloneContents());
  } catch {
    return null;
  }

  // Design grip hint text ("Drag to move") must not enter plainText / segments.
  stripClipboardChrome(wrap);

  const segments = serializeEditableToSegments(wrap);
  if (!segments?.length) return null;

  const tokens = [...wrap.querySelectorAll('.field-token')].filter(
    (token: any) => !token.classList?.contains('field-token--cell'),
  );
  const fieldSchemas: Record<string, any> = {};
  const fieldValues: Record<string, any> = {};
  const items: any[] = [];

  for (const token of tokens) {
    const fieldId = token.dataset?.fieldId;
    if (!fieldId) continue;
    const schema = registry?.getFieldSchemas()?.[fieldId];
    if (schema) {
      fieldSchemas[fieldId] = JSON.parse(JSON.stringify(schema));
    }
    fieldValues[fieldId] = readTokenValue(token);
    items.push(buildItemFromToken(token, registry));
  }

  // textContent drops <br>; mirror breaks into plainText for external paste fallback.
  const plainWrap = wrap.cloneNode(true) as HTMLElement;
  plainWrap.querySelectorAll('br').forEach((br) => {
    br.replaceWith(document.createTextNode('\n'));
  });
  const plainText = String(plainWrap.textContent ?? '')
    .replace(/\u200B/g, '')
    .replace(/\uFEFF/g, '');

  return {
    version: 3,
    kind: 'prose-fragment',
    action,
    segments: JSON.parse(JSON.stringify(segments)),
    fieldSchemas,
    fieldValues,
    items,
    plainText,
  };
}

function remapSegmentFieldIds(segments: any, idMap: Record<string, string>): any {
  if (!Array.isArray(segments)) return segments;
  return segments.map((seg: any) => {
    if (!seg || typeof seg !== 'object') return seg;
    if ((seg.type === 'field' || seg.type === 'child') && seg.id && idMap[seg.id]) {
      return { ...seg, id: idMap[seg.id] };
    }
    if (seg.type === 'columns' && Array.isArray(seg.columns)) {
      return {
        ...seg,
        columns: seg.columns.map((col: any) => ({
          ...col,
          segments: remapSegmentFieldIds(col.segments, idMap),
        })),
      };
    }
    if (seg.type === 'table') {
      return seg;
    }
    return seg;
  });
}

function normalizePayload(payload: any) {
  if (!payload) return null;

  if (
    payload.version === 3 &&
    payload.kind === 'prose-fragment' &&
    Array.isArray(payload.segments) &&
    payload.segments.length > 0
  ) {
    return payload;
  }

  if (payload.version === 2 && Array.isArray(payload.items) && payload.items.length > 0) {
    return payload;
  }

  if (payload.version === 1 && payload.fieldId) {
    return {
      version: 2,
      action: payload.action ?? 'copy',
      items: [
        {
          fieldId: payload.fieldId,
          value: payload.value,
          placeholder: payload.placeholder ?? '',
          schema: payload.schema ?? null,
        },
      ],
    };
  }

  return null;
}

function parseClipboardPayload(raw: any) {
  if (!raw) return null;
  try {
    return normalizePayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

function clipboardSummary(payload: any) {
  if (payload?.version === 3 && payload.kind === 'prose-fragment') {
    const plain = String(payload.plainText ?? '').trim();
    if (plain) return plain;
  }
  const count = payload.items?.length ?? 0;
  if (count === 1) {
    const item = payload.items[0];
    return `[Field: ${item.placeholder || item.fieldId}]`;
  }
  if (count > 1) return `[${count} fields]`;
  return '';
}

let pendingSystemClipboardPayload: any = null;

function flushClipboardToSystem(payload: any) {
  pendingSystemClipboardPayload = payload;
  document.addEventListener('copy', handlePendingSystemCopy, { once: true });
  document.execCommand('copy');
}

function handlePendingSystemCopy(e: any) {
  if (!pendingSystemClipboardPayload) return;
  e.preventDefault();
  writeClipboard(e, pendingSystemClipboardPayload);
  pendingSystemClipboardPayload = null;
}

function writeClipboard(e: any, payload: any) {
  const json = JSON.stringify(payload);
  internalFieldClipboard = payload;
  e.clipboardData.setData(FIELD_CLIPBOARD_MIME, json);
  e.clipboardData.setData('text/plain', clipboardSummary(payload));
}

function clearInternalFieldClipboard() {
  internalFieldClipboard = null;
}

function pasteFieldItem(editable: any, item: any, action: any, options: any, reservedIds: any, reservedNames: any) {
  const { onEditSchema, onDeleteField, onTokenInserted } = options;
  const registry = resolveRegistry(options, editable);

  const reusingCutId =
    action === 'cut' && item.fieldId && !isFieldIdInUse(item.fieldId, reservedIds, editable);

  let fieldId;
  let label;

  if (reusingCutId) {
    fieldId = item.fieldId;
    if (!registry?.getFieldSchemas()?.[fieldId] && item.schema) {
      registry?.updateFieldSchema(fieldId, item.schema);
    }
    const schema = registry?.getFieldSchemas()?.[fieldId];
    label = schema?.label ?? item.placeholder;
    reservedIds.add(fieldId);
    const name = schema?.name ?? schema?.label ?? item.placeholder;
    if (name) reservedNames.add(String(name).trim());
  } else {
    const baseName =
      item.schema?.name ?? item.schema?.label ?? item.placeholder ?? 'Field';
    const { fieldId: nextId, fieldName } = allocateFieldIdentity(editable, registry, baseName, {
      reservedIds,
      reservedNames,
    });
    fieldId = nextId;
    reservedIds.add(fieldId);
    reservedNames.add(fieldName);

    const schema = item.schema
      ? JSON.parse(JSON.stringify(item.schema))
      : createDefaultSchema('text', item.placeholder || 'Field');
    schema.name = fieldName;
    label = schema.label ?? item.placeholder;
    registry?.updateFieldSchema(fieldId, schema);
  }

  const token = createFieldToken(fieldId, item.value, label);
  wireDesignFieldToken(token, { onEditSchema, onDeleteField });
  insertFieldTokenAtCaret(editable, token);
  onTokenInserted?.(fieldId, item.value);
  return token;
}

export function pasteFieldPayload(editable: any, payload: any, options: any = {}) {
  const normalized = normalizePayload(payload);
  if (!normalized) return [];

  if (normalized.version === 3 && normalized.kind === 'prose-fragment') {
    return pasteProseFragmentPayload(editable, normalized, options);
  }

  if (!normalized?.items?.length) return [];

  const reservedIds = new Set<string>();
  const reservedNames = new Set<string>();
  const tokens = [];

  for (const item of normalized.items) {
    tokens.push(
      pasteFieldItem(editable, item, normalized.action, options, reservedIds, reservedNames),
    );
  }

  return tokens;
}

function insertFragmentAtCaret(editable: any, fragment: DocumentFragment) {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !editable.contains(sel.anchorNode)) {
    editable.appendChild(fragment);
    return fragment.lastChild ?? null;
  }

  const range = sel.getRangeAt(0);
  range.deleteContents();
  const last = fragment.lastChild;
  range.insertNode(fragment);
  if (last) focusCaretAfter(last);
  return last;
}

/**
 * Paste a v3 prose-fragment payload (text + fields) at the caret.
 * @returns inserted field tokens
 */
export function pasteProseFragmentPayload(editable: any, payload: any, options: any = {}) {
  const normalized = normalizePayload(payload);
  if (!normalized || normalized.version !== 3 || normalized.kind !== 'prose-fragment') {
    return [];
  }

  const { onEditSchema, onDeleteField, onTokenInserted } = options;
  const registry = resolveRegistry(options, editable);
  const action = normalized.action ?? 'copy';
  const reservedIds = new Set<string>();
  const reservedNames = new Set<string>();
  const idMap: Record<string, string> = {};
  const fieldValues: Record<string, any> = {};

  const schemaEntries = Object.entries(normalized.fieldSchemas ?? {});
  // Prefer schema map; fall back to items list when schemas were omitted.
  const ids =
    schemaEntries.length > 0
      ? schemaEntries.map(([id]) => id)
      : (normalized.items ?? []).map((item: any) => item.fieldId).filter(Boolean);

  for (const oldId of ids) {
    const itemSchema =
      normalized.fieldSchemas?.[oldId] ??
      normalized.items?.find((item: any) => item.fieldId === oldId)?.schema ??
      null;
    const itemValue =
      normalized.fieldValues?.[oldId] ??
      normalized.items?.find((item: any) => item.fieldId === oldId)?.value;

    const reusingCutId =
      action === 'cut' && oldId && !isFieldIdInUse(oldId, reservedIds, editable);

    let fieldId: string;
    if (reusingCutId) {
      fieldId = oldId;
      reservedIds.add(fieldId);
      if (!registry?.getFieldSchemas()?.[fieldId] && itemSchema) {
        registry?.updateFieldSchema(fieldId, JSON.parse(JSON.stringify(itemSchema)));
      }
      const schema = registry?.getFieldSchemas()?.[fieldId];
      const name = schema?.name ?? schema?.label ?? itemSchema?.name;
      if (name) reservedNames.add(String(name).trim());
    } else {
      const baseName =
        itemSchema?.name ?? itemSchema?.label ?? 'Field';
      const { fieldId: nextId, fieldName } = allocateFieldIdentity(editable, registry, baseName, {
        reservedIds,
        reservedNames,
      });
      fieldId = nextId;
      reservedIds.add(fieldId);
      reservedNames.add(fieldName);
      const schema = itemSchema
        ? { ...JSON.parse(JSON.stringify(itemSchema)), name: fieldName }
        : createDefaultSchema('text', 'Field');
      schema.name = fieldName;
      registry?.updateFieldSchema(fieldId, schema);
    }

    idMap[oldId] = fieldId;
    fieldValues[fieldId] = itemValue;
    onTokenInserted?.(fieldId, itemValue);
  }

  const segments = remapSegmentFieldIds(normalized.segments, idMap);
  const fragment = renderSegmentsToDom(segments, fieldValues, {
    ...options,
    designMode: true,
    getRegistry: () => registry,
    onEditSchema,
    onDeleteField,
  });

  const tokens = [...fragment.querySelectorAll('.field-token')];
  insertFragmentAtCaret(editable, fragment);
  normalizeEditableLineStructure(editable);
  return tokens;
}

function cutProseFragmentRange(range: Range, payload: any, options: any) {
  const fieldIds = Object.keys(payload.fieldSchemas ?? {});
  try {
    if (typeof (range as any).deleteContents === 'function') {
      range.deleteContents();
    }
  } catch {
    /* ignore */
  }
  for (const fieldId of fieldIds) {
    options.onDeleteField?.(fieldId, null);
  }
}

export function wireFieldClipboard(editable: any, options: any = {}) {
  const registry = resolveRegistry(options, editable);

  function eventNode(e: any) {
    return e?.target ?? document.activeElement;
  }

  /**
   * Ownership follows the caret when possible. Paste events on nested contenteditables
   * often target the outer section body even when the caret is inside a column.
   */
  function ownsEvent(e: any) {
    const sel = window.getSelection();
    const caret = sel?.anchorNode;
    if (caret && (editable === caret || editable.contains(caret))) {
      const primary = resolveProseClipboardEditable(caret);
      if (primary === editable) return true;
      // Outer body received the paste event; caret lives in a nested column.
      if (e?.target === editable && primary && editable.contains(primary)) return true;
      return false;
    }
    const node = eventNode(e);
    if (!editable.contains(node) && node !== editable) return false;
    return isPrimaryClipboardEditable(editable, node);
  }

  function resolveCopyCutPayload(action: 'copy' | 'cut') {
    const proseRange = getProseFragmentSelectionRange(editable);
    if (proseRange) {
      const payload = buildProseFragmentPayload(proseRange, action, registry);
      if (payload) return { kind: 'prose' as const, payload, range: proseRange };
    }

    const tokens = getFieldTokensForClipboard(editable).filter(
      (token: any) => action === 'copy' || !token.classList?.contains('field-token--cell'),
    );
    if (!tokens.length) return null;
    // Nested column owns tokens that live inside it — body must not also cut/copy them.
    const first = tokens[0];
    if (first && !isPrimaryClipboardEditable(editable, first)) return null;
    return { kind: 'fields' as const, payload: buildPayload(tokens, action, registry), tokens };
  }

  function cancelNativePaste(e: any) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
    armNativePasteSuppression();
  }

  function applyPastePayload(payload: any) {
    if (shouldSkipDuplicatePaste(payload)) return null;
    const tokens = pasteFieldPayload(editable, payload, options);
    if (tokens.length) {
      selectDesignToken(tokens[tokens.length - 1], editable, { additive: false });
    } else if (payload.version === 3) {
      options.onTokenRemoved?.();
    }
    return tokens;
  }

  function onCopy(e: any) {
    if (!ownsEvent(e)) return;
    const resolved = resolveCopyCutPayload('copy');
    if (!resolved) {
      // Native plain-text copy/cut — drop stale field payload so paste won't revive it.
      clearInternalFieldClipboard();
      return;
    }
    e.preventDefault();
    writeClipboard(e, resolved.payload);
    clearDesignTokenSelection(editable);
  }

  function onCut(e: any) {
    if (!ownsEvent(e)) return;
    const resolved = resolveCopyCutPayload('cut');
    if (!resolved) {
      clearInternalFieldClipboard();
      return;
    }
    e.preventDefault();
    writeClipboard(e, resolved.payload);

    if (resolved.kind === 'prose' && resolved.range) {
      cutProseFragmentRange(resolved.range, resolved.payload, options);
    } else if (resolved.kind === 'fields' && resolved.tokens) {
      for (const token of resolved.tokens) {
        options.onDeleteField?.(token.dataset.fieldId, token);
        token.remove();
      }
    }

    options.onTokenRemoved?.();
    clearDesignTokenSelection(editable);
  }

  function onPaste(e: any) {
    if (!ownsEvent(e)) return;

    const mimeRaw = e.clipboardData?.getData(FIELD_CLIPBOARD_MIME) || '';
    const plain = e.clipboardData?.getData('text/plain');
    // Prefer live clipboard MIME. Fall back to in-memory payload only when the custom
    // type is missing (some browsers strip it) — never when a newer plain cut replaced it
    // (internal was cleared on that cut/copy).
    const raw = mimeRaw || (internalFieldClipboard ? JSON.stringify(internalFieldClipboard) : '');
    const payload = parseClipboardPayload(raw);
    if (payload) {
      cancelNativePaste(e);
      applyPastePayload(payload);
      return;
    }

    if (plain == null || plain === '') return;

    const sel = window.getSelection();
    const anchor = sel?.anchorNode;
    if (!anchor || !editable.contains(anchor)) return;
    if (!isPrimaryClipboardEditable(editable, anchor)) return;
    if (anchor.parentElement?.closest?.('.field-token, .document-table')) {
      return;
    }

    if (shouldSkipDuplicatePaste({ plain })) return;
    cancelNativePaste(e);
    insertPlainTextAtCaret(editable, plain);
    normalizeEditableLineStructure(editable);
    options.onTokenRemoved?.();
  }

  function onBeforeInput(e: any) {
    if (!suppressNativePaste) return;
    if (e.inputType !== 'insertFromPaste') return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
  }

  function onKeyDown(e: any) {
    const focusNode = document.activeElement ?? e.target;
    if (!editable.contains(focusNode) && focusNode !== editable) return;
    if (!isPrimaryClipboardEditable(editable, focusNode)) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const resolved = resolveCopyCutPayload('copy');
      if (!resolved) {
        clearInternalFieldClipboard();
        return;
      }
      e.preventDefault();
      flushClipboardToSystem(resolved.payload);
      clearDesignTokenSelection(editable);
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
      const resolved = resolveCopyCutPayload('cut');
      if (!resolved) {
        clearInternalFieldClipboard();
        return;
      }
      e.preventDefault();
      flushClipboardToSystem(resolved.payload);

      if (resolved.kind === 'prose' && resolved.range) {
        cutProseFragmentRange(resolved.range, resolved.payload, options);
      } else if (resolved.kind === 'fields' && resolved.tokens) {
        for (const token of resolved.tokens) {
          options.onDeleteField?.(token.dataset.fieldId, token);
          token.remove();
        }
      }

      options.onTokenRemoved?.();
      clearDesignTokenSelection(editable);
    }

    // Paste is handled only on the `paste` / beforeinput path.

    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.defaultPrevented) return;
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const anchor = sel.anchorNode;
      if (!editable.contains(anchor)) return;
      if (!isPrimaryClipboardEditable(editable, anchor)) return;
      if (anchor?.parentElement?.closest?.('.field-token')) return;
      e.preventDefault();
      insertLineBreakAtCaret(editable);
      options.onTokenRemoved?.();
    }
  }

  // Capture so we run before other paste handlers and can cancel native insertFromPaste.
  editable.addEventListener('copy', onCopy);
  editable.addEventListener('cut', onCut);
  editable.addEventListener('paste', onPaste, true);
  editable.addEventListener('beforeinput', onBeforeInput, true);
  document.addEventListener('keydown', onKeyDown);

  return () => {
    editable.removeEventListener('copy', onCopy);
    editable.removeEventListener('cut', onCut);
    editable.removeEventListener('paste', onPaste, true);
    editable.removeEventListener('beforeinput', onBeforeInput, true);
    document.removeEventListener('keydown', onKeyDown);
  };
}
