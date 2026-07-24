import { buildPath } from './tree.js';

/**
 * @param {{ label: string, code?: string }} item
 * @param {boolean} withCode
 */
export function formatListItemLabel(item: any, withCode: any = false) {
  if (withCode && item.code) {
    return `${item.code} — ${item.label}`;
  }
  return item.label;
}

/**
 * @param {Array<{ label: string, children?: unknown[] }>} tree
 * @param {string[]} [ancestors]
 * @returns {string[]}
 */
export function collectTreeLeafPaths(tree: any, ancestors: any = []): any {
  const paths = [];

  for (const node of tree ?? []) {
    const hasChildren = node.children?.length > 0;
    if (!hasChildren) {
      paths.push(buildPath(ancestors, node));
      continue;
    }
    paths.push(...collectTreeLeafPaths(node.children, [...ancestors, node.label]));
  }

  return paths;
}

/**
 * @param {string[]} values
 * @param {Set<string>} knownSet
 * @returns {{ known: string[], custom: string[] }}
 */
function partitionByKnownSet(values: any, knownSet: any) {
  const known = [];
  const custom = [];

  for (const value of values ?? []) {
    const entry = String(value ?? '').trim();
    if (!entry) continue;
    if (knownSet.has(entry)) {
      known.push(entry);
    } else {
      custom.push(entry);
    }
  }

  return { known, custom };
}

/**
 * @param {string[]} paths
 * @param {Array<{ label: string, children?: unknown[] }>} tree
 */
export function partitionTreeValue(paths: any, tree: any) {
  const knownSet = new Set(collectTreeLeafPaths(tree));
  return partitionByKnownSet(Array.isArray(paths) ? paths : [], knownSet);
}

/**
 * @param {string[]} values
 * @param {Array<{ label: string, code?: string }>} items
 * @param {boolean} withCode
 */
export function partitionListValue(values: any, items: any, withCode: any = false) {
  const knownSet = new Set((items ?? []).map((item: any) => formatListItemLabel(item, withCode)));
  return partitionByKnownSet(Array.isArray(values) ? values : [], knownSet);
}

/**
 * @param {string} value
 * @param {Array<{ label: string, code?: string }>} items
 * @param {boolean} withCode
 */
export function partitionChoiceValue(value: any, items: any, withCode: any = false) {
  const text = String(value ?? '').trim();
  if (!text) return { known: '', custom: '' };

  const knownSet = new Set((items ?? []).map((item: any) => formatListItemLabel(item, withCode)));
  if (knownSet.has(text)) {
    return { known: text, custom: '' };
  }
  return { known: '', custom: text };
}

/**
 * @param {string[]|string} known
 * @param {string[]|string} custom
 * @returns {string[]|string}
 */
export function mergePartitioned(known: any, custom: any) {
  if (typeof known === 'string' || typeof custom === 'string') {
    const next = String(custom || known || '').trim();
    return next;
  }

  const seen = new Set();
  const merged = [];

  for (const value of [...(known ?? []), ...(custom ?? [])]) {
    const entry = String(value ?? '').trim();
    if (!entry || seen.has(entry)) continue;
    seen.add(entry);
    merged.push(entry);
  }

  return merged;
}

/**
 * Merge checked catalog entries with free-text lines from the textarea.
 * @param {string[]} catalogEntries
 * @param {string[]} textareaEntries
 * @param {Set<string>} catalogSet
 * @returns {string[]}
 */
export function syncCatalogWithTextareaEntries(catalogEntries: any, textareaEntries: any, catalogSet: any) {
  const customOnly = (textareaEntries ?? []).filter((entry: any) => !catalogSet.has(entry));
  return mergePartitioned(catalogEntries ?? [], customOnly);
}

/**
 * Sync selected catalog lines into manual-edit textarea while preserving line order.
 * Removes unchecked catalog lines, keeps free-text lines in place, appends new selections.
 * @param {string[]} currentLines
 * @param {string[]} selectedCatalogLines
 * @param {Set<string>} catalogSet
 * @returns {string[]}
 */
export function syncManualEditTextareaOrder(currentLines: any, selectedCatalogLines: any, catalogSet: any) {
  const selectedSet = new Set(selectedCatalogLines ?? []);
  const kept = (currentLines ?? []).filter(
    (line: any) => !catalogSet.has(line) || selectedSet.has(line),
  );
  const present = new Set(kept);
  for (const entry of selectedCatalogLines ?? []) {
    if (!present.has(entry)) {
      kept.push(entry);
      present.add(entry);
    }
  }
  return kept;
}

/**
 * @param {string[]|string} value
 * @param {'choice'|'list'|'tree'} schemaType
 */
export function formatManualEditText(value: any, schemaType: any) {
  if (schemaType === 'choice') {
    return String(value ?? '').trim();
  }
  if (Array.isArray(value)) {
    return value.map((entry: any) => String(entry ?? '').trim()).filter(Boolean).join('; ');
  }
  return String(value ?? '')
    .split(';')
    .map((entry: any) => entry.trim())
    .filter(Boolean)
    .join('; ');
}

/**
 * @param {string} text
 * @param {'choice'|'list'|'tree'} schemaType
 */
export function parseManualEditText(text: any, schemaType: any) {
  if (schemaType === 'choice') {
    return String(text ?? '').trim();
  }
  return String(text ?? '')
    .split(';')
    .map((entry: any) => entry.trim())
    .filter(Boolean);
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function parseCustomEntriesText(text: any) {
  return String(text ?? '')
    .split(';')
    .map((entry: any) => entry.trim())
    .filter(Boolean);
}

/**
 * Split manual-edit text into catalog-matched lines and free-text lines.
 * @param {string} text
 * @param {Set<string>} catalogSet
 * @param {'choice'|'list'|'tree'} [schemaType]
 * @returns {{ catalog: string[], freeText: string[] }}
 */
export function splitManualEditLines(text: any, catalogSet: any, schemaType: any = 'tree') {
  const lines = schemaType === 'choice'
    ? [String(text ?? '').trim()].filter(Boolean)
    : parseCustomEntriesText(text);
  const catalog = lines.filter((line: any) => catalogSet.has(line));
  const freeText = lines.filter((line: any) => !catalogSet.has(line));
  return { catalog, freeText };
}
