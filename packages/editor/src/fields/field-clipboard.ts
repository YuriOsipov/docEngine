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
} from './inline-fields.js';
import {
  getFieldTokensForClipboard,
  selectDesignToken,
  clearDesignTokenSelection,
} from './field-selection.js';

export const FIELD_CLIPBOARD_MIME = 'application/x-docengine-field';

let internalFieldClipboard: any = null;

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

function normalizePayload(payload: any) {
  if (!payload) return null;

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
  const count = payload.items.length;
  if (count === 1) {
    const item = payload.items[0];
    return `[Field: ${item.placeholder || item.fieldId}]`;
  }
  return `[${count} fields]`;
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
  if (!normalized?.items?.length) return [];

  const reservedIds = new Set();
  const reservedNames = new Set();
  const tokens = [];

  for (const item of normalized.items) {
    tokens.push(
      pasteFieldItem(editable, item, normalized.action, options, reservedIds, reservedNames),
    );
  }

  return tokens;
}

export function wireFieldClipboard(editable: any, options: any = {}) {
  const registry = resolveRegistry(options, editable);

  function onCopy(e: any) {
    if (!editable.contains(e.target)) return;
    const tokens = getFieldTokensForClipboard(editable);
    if (!tokens.length) return;
    e.preventDefault();
    writeClipboard(e, buildPayload(tokens, 'copy', registry));
    clearDesignTokenSelection(editable);
  }

  function onCut(e: any) {
    if (!editable.contains(e.target)) return;
    const tokens = getFieldTokensForClipboard(editable).filter(
      (token: any) => !token.classList?.contains('field-token--cell'),
    );
    if (!tokens.length) return;
    e.preventDefault();
    const payload = buildPayload(tokens, 'cut', registry);
    writeClipboard(e, payload);
    for (const token of tokens) {
      options.onDeleteField?.(token.dataset.fieldId, token);
      token.remove();
    }
    options.onTokenRemoved?.();
    clearDesignTokenSelection(editable);
  }

  async function onPaste(e: any) {
    if (!editable.contains(e.target)) return;

    const raw =
      e.clipboardData?.getData(FIELD_CLIPBOARD_MIME) ||
      (internalFieldClipboard ? JSON.stringify(internalFieldClipboard) : '');
    const payload = parseClipboardPayload(raw);
    if (payload) {
      e.preventDefault();
      const tokens = pasteFieldPayload(editable, payload, options);
      if (tokens.length) {
        selectDesignToken(tokens[tokens.length - 1], editable, { additive: false });
      }
      return;
    }

    const plain = e.clipboardData?.getData('text/plain');
    if (plain == null || plain === '') return;

    const sel = window.getSelection();
    const anchor = sel?.anchorNode;
    if (!anchor || !editable.contains(anchor)) return;
    if (anchor.parentElement?.closest?.('.field-token, .document-table')) {
      return;
    }

    e.preventDefault();
    insertPlainTextAtCaret(editable, plain);
    normalizeEditableLineStructure(editable);
    options.onTokenRemoved?.();
  }

  function onKeyDown(e: any) {
    if (!editable.contains(document.activeElement) && !editable.contains(e.target)) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const tokens = getFieldTokensForClipboard(editable);
      if (!tokens.length) return;
      e.preventDefault();
      flushClipboardToSystem(buildPayload(tokens, 'copy', registry));
      clearDesignTokenSelection(editable);
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
      const tokens = getFieldTokensForClipboard(editable).filter(
        (token: any) => !token.classList?.contains('field-token--cell'),
      );
      if (!tokens.length) return;
      e.preventDefault();
      const payload = buildPayload(tokens, 'cut', registry);
      flushClipboardToSystem(payload);
      for (const token of tokens) {
        options.onDeleteField?.(token.dataset.fieldId, token);
        token.remove();
      }
      options.onTokenRemoved?.();
      clearDesignTokenSelection(editable);
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      const raw = internalFieldClipboard ? JSON.stringify(internalFieldClipboard) : null;
      const payload = parseClipboardPayload(raw);
      if (!payload) return;
      e.preventDefault();
      const tokens = pasteFieldPayload(editable, payload, options);
      if (tokens.length) {
        selectDesignToken(tokens[tokens.length - 1], editable, { additive: false });
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.defaultPrevented) return;
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const anchor = sel.anchorNode;
      if (!editable.contains(anchor)) return;
      if (anchor?.parentElement?.closest?.('.field-token')) return;
      e.preventDefault();
      insertLineBreakAtCaret(editable);
      options.onTokenRemoved?.();
    }
  }

  editable.addEventListener('copy', onCopy);
  editable.addEventListener('cut', onCut);
  editable.addEventListener('paste', onPaste);
  document.addEventListener('keydown', onKeyDown);

  return () => {
    editable.removeEventListener('copy', onCopy);
    editable.removeEventListener('cut', onCut);
    editable.removeEventListener('paste', onPaste);
    document.removeEventListener('keydown', onKeyDown);
  };
}
