import { collectAllValues, collectFieldIdsInBlocks, stripValuesFromBlocks } from './document-io.js';
import {
  labelToFieldKey,
  resolveSchemaDefaultValue,
  applyFieldIdChange,
  isCellFieldId,
  extractRowKeysFromTableValues,
  mergeTableInstanceRows,
  ensureCellSchemasForRows,
} from './field-schemas.js';
import { walkSegments } from './segment-tree.js';
import type { FieldSchema } from '../types.js';

type SoftSchema = FieldSchema & Record<string, any>;
type SchemaMap = Record<string, SoftSchema>;
type FieldValue = unknown;

/**
 * @param {RepeaterFieldSchema | null | undefined} repeaterSchema
 * @returns {Record<string, FieldSchema>}
 */
export function getRepeaterFieldSchemas(repeaterSchema: any): SchemaMap {
  if (!repeaterSchema) return {};
  const own = repeaterSchema.fieldSchemas;
  if (own && typeof own === 'object' && Object.keys(own).length > 0) {
    return own;
  }
  if (repeaterSchema.template?.fieldSchemas) {
    return repeaterSchema.template.fieldSchemas;
  }
  return own && typeof own === 'object' ? own : {};
}

/**
 * @param {RepeaterFieldSchema} repeaterSchema
 * @returns {RepeaterFieldSchema}
 */
export function normalizeRepeaterSchema( repeaterSchema: any) {
  if (!repeaterSchema || repeaterSchema.type !== 'child') return repeaterSchema;

  let fieldSchemas =
    repeaterSchema.fieldSchemas && typeof repeaterSchema.fieldSchemas === 'object'
      ? { ...repeaterSchema.fieldSchemas }
      : {};

  const next = {
    ...repeaterSchema,
    fieldSchemas,
  };
  delete next.instances;

  if (next.template?.blocks?.length && next.template?.fieldSchemas) {
    // Rebuild storage keys from the template so nested table cells keep unique
    // ids (label-collapsed keys like "name" collide across rows/columns).
    const rebuilt = extractRepeaterFieldSchemasFromDocument({
      fieldSchemas: next.template.fieldSchemas,
      blocks: next.template.blocks,
    });
    if (Object.keys(rebuilt).length) {
      next.fieldSchemas = rebuilt;
    }
    return next;
  }

  if (!Object.keys(fieldSchemas).length && next.template?.fieldSchemas) {
    next.fieldSchemas = { ...next.template.fieldSchemas };
  }

  delete next.template;
  return next;
}

/**
 * @param {RepeaterFieldSchema | null | undefined} repeaterSchema
 * @returns {boolean}
 */
export function repeaterHasTemplate( repeaterSchema: any) {
  if (!repeaterSchema || repeaterSchema.type !== 'child') return false;
  if (repeaterSchema.template?.blocks?.length) return true;
  return Object.keys(getRepeaterFieldSchemas(repeaterSchema)).length > 0;
}

/**
 * @param {string} repeaterFieldId
 * @returns {string}
 */
export function repeaterChildNamespacePrefix( repeaterFieldId: any) {
  return `${REPEATER_CHILD_FIELD_PREFIX}${repeaterFieldId}_`;
}

/**
 * @param {EditorDocument} doc
 * @param {string} repeaterFieldId
 * @returns {EditorDocument}
 */
export function namespaceRepeaterChildTemplate( doc: any, repeaterFieldId: any) {
  const prefix = repeaterChildNamespacePrefix(repeaterFieldId);
  let fieldSchemas = { ...(doc.fieldSchemas ?? {}) };
  let blocks = JSON.parse(JSON.stringify(doc.blocks ?? []));

  const ids = new Set([
    ...Object.keys(fieldSchemas),
    ...collectFieldIdsInBlocks(blocks, fieldSchemas),
  ]);

  const sortedIds = [...ids].sort((a, b) => b.length - a.length);
  for (const oldId of sortedIds) {
    if (!oldId || oldId.startsWith(prefix)) continue;
    const schema = fieldSchemas[oldId];
    if (!schema) continue;
    const newId = `${prefix}${oldId}`;
    try {
      const result = applyFieldIdChange(oldId, newId, schema, fieldSchemas, blocks);
      fieldSchemas = result.fieldSchemas;
      blocks = result.blocks;
    } catch {
      // skip ids that cannot be renamed
    }
  }

  return {
    time: doc.time ?? Date.now(),
    fieldSchemas,
    blocks: stripValuesFromBlocks(blocks, fieldSchemas),
  };
}

/**
 * @param {unknown} data
 * @param {RepeaterFieldSchema} repeaterSchema
 * @returns {Record<string, FieldValue>}
 */
function migrateLegacyBlockData( data: any, repeaterSchema: any) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }

  if ('blocks' in data && Array.isArray(data.blocks)) {
    const childSchemas = getRepeaterFieldSchemas(repeaterSchema);
    const collected = collectAllValues(data.blocks);
    /** @type {Record<string, FieldValue>} */
    const flat: Record<string, FieldValue> = {};
    for (const key of Object.keys(childSchemas)) {
      if (Object.prototype.hasOwnProperty.call(collected, key)) {
        flat[key] = collected[key];
      }
    }
    return flat;
  }

  return {};
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
/**
 * @param {import('../types.d.ts').FieldSchema | undefined} childSchema
 * @param {string} fallbackId
 * @returns {string}
 */
function repeaterChildStorageKey( childSchema: any, fallbackId: any) {
  const name = String(childSchema?.name ?? childSchema?.label ?? fallbackId ?? '').trim();
  return labelToFieldKey(name) || fallbackId;
}

/**
 * Prefer exact editor-id identity over label collapse for table cells.
 * @param {string} editorId
 * @param {import('../types.d.ts').FieldSchema} schema
 * @param {Record<string, import('../types.d.ts').FieldSchema>} docFieldSchemas
 * @param {Set<string>} usedKeys
 * @returns {string}
 */
function preferredRepeaterStorageKey( editorId: any, schema: any, docFieldSchemas: any, usedKeys: any) {
  const stripped = fromRepeaterChildEditorFieldId(editorId);
  const isCell = isCellFieldId(editorId, docFieldSchemas);
  const isTable = schema?.type === 'table';

  if (isCell || isTable) {
    const unique = labelToFieldKey(stripped, usedKeys) || stripped;
    usedKeys.add(unique);
    return unique;
  }

  const fromName = labelToFieldKey(
    String(schema.name ?? schema.label ?? stripped).trim(),
    usedKeys,
  );
  const key = fromName || stripped;
  usedKeys.add(key);
  return key;
}

export function isLegacyRepeaterInstancesWrapper( value: any) {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'instances' in value &&
    value.instances != null &&
    typeof value.instances === 'object' &&
    !('url' in value)
  );
}

/**
 * @param {RepeaterValue | null | undefined | unknown} value
 * @param {RepeaterFieldSchema} repeaterSchema
 * @returns {RepeaterValue}
 */
export function normalizeRepeaterValue( value: any, repeaterSchema: any) {
  const childSchemas = getRepeaterFieldSchemas(repeaterSchema);
  let flat: Record<string, FieldValue> = {};

  if (isLegacyRepeaterInstancesWrapper(value)) {
    const legacyKeys = Object.keys(value.instances ?? {});
    const first = legacyKeys[0];
    flat = first ? migrateLegacyBlockData(value.instances[first], repeaterSchema) : {};
    if (!Object.keys(flat).length && first && value.instances[first] && typeof value.instances[first] === 'object') {
      flat = { ...value.instances[first] };
    }
  } else if (value && typeof value === 'object' && !Array.isArray(value) && !('url' in value)) {
    if ('blocks' in value) {
      flat = migrateLegacyBlockData(value, repeaterSchema);
    } else {
      flat = { ...value };
    }
  }

  /** @type {RepeaterValue} */
  const next: Record<string, FieldValue> = {};
  const claimed = new Set();
  for (const [key, schema] of Object.entries(childSchemas)) {
    const matchedKey = findCollectedKeyForStorageKey(flat, key, schema, claimed);
    if (matchedKey != null) {
      next[key] = flat[matchedKey];
      claimed.add(matchedKey);
    }
  }

  const templateSchemas: SchemaMap = repeaterSchema?.template?.fieldSchemas ?? {};

  // Storage-key prefixes of nested tables, so extra rows (added in the modal
  // beyond the template's seed rows) survive normalization by identity.
  const nestedTableStoragePrefixes = collectNestedTableStoragePrefixes(
    childSchemas,
    templateSchemas,
  );

  for (const [flatKey, flatVal] of Object.entries(flat)) {
    if (Object.prototype.hasOwnProperty.call(next, flatKey)) continue;
    if (claimed.has(flatKey)) continue;

    let storageKey: string | null = null;
    if (templateSchemas[flatKey]) {
      storageKey = editorIdToRepeaterStorageKey(flatKey, repeaterSchema);
    } else if (
      nestedTableStoragePrefixes.some((prefix) =>
        fromRepeaterChildEditorFieldId(flatKey).startsWith(prefix),
      )
    ) {
      // Nested table cell (any row): preserve identity storage key.
      storageKey = fromRepeaterChildEditorFieldId(flatKey);
    } else {
      for (const editorId of Object.keys(templateSchemas)) {
        const stripped = fromRepeaterChildEditorFieldId(editorId);
        if (
          flatKey === editorId ||
          flatKey === stripped ||
          labelToFieldKey(stripped) === flatKey
        ) {
          storageKey = editorIdToRepeaterStorageKey(editorId, repeaterSchema);
          break;
        }
      }
    }

    if (storageKey && !Object.prototype.hasOwnProperty.call(next, storageKey)) {
      next[storageKey] = flatVal;
      claimed.add(flatKey);
    }
  }

  return next;
}

/**
 * Storage-key prefixes (`{tableStorageKey}_`) for every nested table declared in
 * either the flattened child schemas or the template field schemas.
 * @param {Record<string, import('../types.d.ts').FieldSchema>} childSchemas
 * @param {Record<string, import('../types.d.ts').FieldSchema>} templateSchemas
 * @returns {string[]}
 */
function collectNestedTableStoragePrefixes( childSchemas: any, templateSchemas: any) {
  const prefixes = new Set<string>();
  for (const [key, schema] of Object.entries(childSchemas ?? {})) {
    if ((schema as SoftSchema)?.type === 'table') prefixes.add(`${key}_`);
  }
  for (const [editorId, schema] of Object.entries(templateSchemas ?? {})) {
    if ((schema as SoftSchema)?.type === 'table') {
      prefixes.add(`${fromRepeaterChildEditorFieldId(editorId)}_`);
    }
  }
  return [...prefixes];
}

/**
 * @param {Record<string, FieldValue>} collected
 * @param {string} childKey
 * @param {import('../types.d.ts').FieldSchema | undefined} childSchema
 * @param {Set<string>} claimedKeys
 * @returns {string | null}
 */
function findCollectedKeyForStorageKey( collected: any, childKey: any, childSchema: any, claimedKeys: any) {
  const prefixedKey = toRepeaterChildEditorFieldId(childKey);
  if (
    Object.prototype.hasOwnProperty.call(collected, prefixedKey) &&
    !claimedKeys.has(prefixedKey)
  ) {
    return prefixedKey;
  }
  if (Object.prototype.hasOwnProperty.call(collected, childKey) && !claimedKeys.has(childKey)) {
    return childKey;
  }

  const slug = repeaterChildStorageKey(childSchema, childKey);
  const candidates = new Set(
    [childKey, prefixedKey, slug, childSchema?.name, childSchema?.label]
      .filter(Boolean)
      .map((entry) => String(entry).trim())
      .filter(Boolean),
  );

  for (const key of Object.keys(collected)) {
    if (claimedKeys.has(key)) continue;
    const stripped = fromRepeaterChildEditorFieldId(key);
    if (stripped === childKey || key === childKey || key === prefixedKey) return key;
    if (candidates.has(key) || candidates.has(stripped)) return key;
    if (labelToFieldKey(stripped) === childKey) return key;
  }

  /** @type {string[]} */
  const suffixMatches: string[] = [];
  for (const key of Object.keys(collected)) {
    if (claimedKeys.has(key)) continue;
    const keySlug = labelToFieldKey(fromRepeaterChildEditorFieldId(key));
    if (keySlug && keySlug === slug) {
      suffixMatches.push(key);
      continue;
    }
    if (slug && key.endsWith(`_${slug}`)) {
      suffixMatches.push(key);
    }
  }
  // Claim first unused match so legacy short keys (id/name) still round-trip a row,
  // while unique storage keys prefer exact matches above and leave surplus to the
  // template-field pass in extract/normalize.
  return suffixMatches[0] ?? null;
}

/**
 * @param {RepeaterFieldSchema} repeaterSchema
 * @returns {RepeaterValue}
 */
export function createEmptyRepeaterValue( repeaterSchema: any) {
  return normalizeRepeaterValue({}, repeaterSchema);
}

function childFieldHasContent( value: any) {
  if (value == null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    if ('url' in value) return !!value.url;
    if (isLegacyRepeaterInstancesWrapper(value)) return false;
    return Object.keys(value).length > 0;
  }
  return true;
}

/**
 * @param {RepeaterFieldSchema} repeaterSchema
 * @param {RepeaterValue} repeaterValue
 * @returns {EditorDocument}
 */
/**
 * @returns {EditorDocument}
 */
export function createDefaultRepeaterTemplateDocument() {
  return {
    time: Date.now(),
    fieldSchemas: {},
    blocks: [
      {
        type: 'documentSection',
        data: {
          label: '',
          segments: [{ type: 'text', content: '' }],
          fieldValues: {},
        },
      },
    ],
  };
}

/**
 * Build a nested-editor document for designing a repeater's child fieldSchemas.
 * @param {RepeaterFieldSchema} repeaterSchema
 * @returns {EditorDocument}
 */
export function buildRepeaterTemplateDocument( repeaterSchema: any) {
  const templateBlocks = repeaterSchema.template?.blocks;
  const templateFieldSchemas = repeaterSchema.template?.fieldSchemas;

  if (templateBlocks?.length && templateFieldSchemas) {
    return {
      time: Date.now(),
      fieldSchemas: JSON.parse(JSON.stringify(templateFieldSchemas)),
      blocks: stripValuesFromBlocks(templateBlocks, templateFieldSchemas),
    };
  }

  const childSchemas = getRepeaterFieldSchemas(repeaterSchema);

  if (!Object.keys(childSchemas).length) {
    return createDefaultRepeaterTemplateDocument();
  }

  return buildRepeaterPreviewDocument(repeaterSchema, createEmptyRepeaterValue(repeaterSchema));
}

/**
 * @param {EditorDocument} doc
 * @returns {RepeaterFieldSchema['fieldSchemas']}
 */
export function extractRepeaterFieldSchemasFromDocument( doc: any) {
  const ids = collectFieldIdsInBlocks(doc.blocks, doc.fieldSchemas);
  /** @type {RepeaterFieldSchema['fieldSchemas']} */
  const fieldSchemas: SchemaMap = {};
  const usedKeys = new Set();

  for (const id of ids) {
    const schema = doc.fieldSchemas?.[id];
    if (!schema) continue;
    const key = preferredRepeaterStorageKey(id, schema, doc.fieldSchemas ?? {}, usedKeys);
    fieldSchemas[key] = {
      ...schema,
      name: schema.name ?? schema.label ?? key,
    };
  }

  return fieldSchemas;
}

/** @deprecated Use extractRepeaterFieldSchemasFromDocument */
export function extractRepeaterTemplateFromDocument( doc: any) {
  return {
    fieldSchemas: extractRepeaterFieldSchemasFromDocument(doc),
    blocks: stripValuesFromBlocks(doc.blocks, doc.fieldSchemas),
  };
}

export function buildRepeaterPreviewDocument( repeaterSchema: any, repeaterValue: any) {
  const childSchemas = getRepeaterFieldSchemas(repeaterSchema);
  const flat = normalizeRepeaterValue(repeaterValue, repeaterSchema);
  const fieldSchemas: SchemaMap = {};
  const fieldValues: Record<string, FieldValue> = {};
  const segments: Array<{ type: string; id: string }> = [];

  for (const [key, schema] of Object.entries(childSchemas)) {
    const editorFieldId = toRepeaterChildEditorFieldId(key);
    fieldSchemas[editorFieldId] = {
      ...schema,
      name: schema.name ?? schema.label ?? key,
    };
    fieldValues[editorFieldId] = Object.prototype.hasOwnProperty.call(flat, key)
      ? flat[key]
      : resolveSchemaDefaultValue(schema, { forTemplate: true });
    segments.push({ type: 'field', id: editorFieldId });
  }

  return {
    time: Date.now(),
    fieldSchemas,
    blocks: [
      {
        type: 'documentSection',
        data: {
          name: '_repeater',
          label: '',
          segments,
          fieldValues,
        },
      },
    ],
  };
}

function findEditorIdForStorageKey( templateFieldSchemas: any, storageKey: any, storageSchema: any, usedEditorIds: any = null) {
  for (const editorId of Object.keys(templateFieldSchemas ?? {})) {
    if (usedEditorIds?.has(editorId)) continue;
    const stripped = fromRepeaterChildEditorFieldId(editorId);
    if (stripped === storageKey || editorId === storageKey) return editorId;
    if (labelToFieldKey(stripped) === storageKey) return editorId;
  }

  const slug = repeaterChildStorageKey(storageSchema, storageKey);
  const matches: string[] = [];
  for (const [editorId, schemaRaw] of Object.entries(templateFieldSchemas ?? {})) {
    if (usedEditorIds?.has(editorId)) continue;
    const schema = schemaRaw as SoftSchema;
    if (repeaterChildStorageKey(schema, editorId) === slug) {
      matches.push(editorId);
      continue;
    }
    const name = String(schema.name ?? schema.label ?? '').trim();
    if (name && labelToFieldKey(name) === slug) {
      matches.push(editorId);
    }
  }
  return matches.length ? matches[0] : null;
}

/**
 * Build a 1:1 storageKey → editorId map; each editor id assigned at most once.
 * @param {Record<string, import('../types.d.ts').FieldSchema>} storageSchemas
 * @param {Record<string, import('../types.d.ts').FieldSchema>} templateFieldSchemas
 * @returns {Record<string, string>}
 */
function buildEditorIdByStorageKeyMap( storageSchemas: any, templateFieldSchemas: any) {
  const result: Record<string, string> = {};
  const usedEditorIds = new Set();

  for (const [storageKey, schema] of Object.entries(storageSchemas ?? {})) {
    const editorId = findEditorIdForStorageKey(
      templateFieldSchemas,
      storageKey,
      schema,
      usedEditorIds,
    );
    if (!editorId) continue;
    result[storageKey] = editorId;
    usedEditorIds.add(editorId);
  }

  return result;
}

/**
 * Map a nested editor field id back to repeater storage key.
 * @param {string} editorId
 * @param {RepeaterFieldSchema} repeaterSchema
 * @returns {string}
 */
export function editorIdToRepeaterStorageKey( editorId: any, repeaterSchema: any) {
  const storageSchemas = getRepeaterFieldSchemas(repeaterSchema);
  const templateFieldSchemas =
    repeaterSchema.template?.fieldSchemas ?? storageSchemas;

  const prefixed = fromRepeaterChildEditorFieldId(editorId);
  if (prefixed !== editorId && Object.prototype.hasOwnProperty.call(storageSchemas, prefixed)) {
    return prefixed;
  }
  if (Object.prototype.hasOwnProperty.call(storageSchemas, editorId)) {
    return editorId;
  }
  if (Object.prototype.hasOwnProperty.call(storageSchemas, labelToFieldKey(prefixed))) {
    return labelToFieldKey(prefixed);
  }

  const map = buildEditorIdByStorageKeyMap(storageSchemas, templateFieldSchemas);
  for (const [storageKey, mappedEditorId] of Object.entries(map)) {
    if (mappedEditorId === editorId) return storageKey;
  }

  for (const storageKey of Object.keys(storageSchemas)) {
    if (storageKey === editorId) return storageKey;
  }

  return prefixed !== editorId ? prefixed : editorId;
}

/**
 * Merge persisted repeater JSON with live nested field token values.
 * Empty DOM tokens must not wipe populated stored values — nested table
 * previews often omit empty cells or only render a subset of columns.
 * @param {unknown} existingValue
 * @param {Record<string, FieldValue>} domValuesByEditorId
 * @param {RepeaterFieldSchema} repeaterSchema
 * @returns {RepeaterValue}
 */
export function mergeRepeaterDomValues( existingValue: any, domValuesByEditorId: any, repeaterSchema: any) {
  let flat: Record<string, FieldValue> = {};

  if (
    existingValue &&
    typeof existingValue === 'object' &&
    !Array.isArray(existingValue) &&
    !('url' in existingValue) &&
    !('blocks' in existingValue) &&
    !isLegacyRepeaterInstancesWrapper(existingValue)
  ) {
    flat = { ...existingValue };
  }

  for (const [editorId, val] of Object.entries(domValuesByEditorId ?? {})) {
    const key = editorIdToRepeaterStorageKey(editorId, repeaterSchema);
    if (isRepeaterStoredValueEmpty(val) && !isRepeaterStoredValueEmpty(flat[key])) {
      continue;
    }
    flat[key] = val;
  }

  return normalizeRepeaterValue(flat, repeaterSchema);
}

function isRepeaterStoredValueEmpty( value: any) {
  if (value == null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    if ('url' in value) return !value.url;
    return Object.keys(value).length === 0;
  }
  return false;
}

/**
 * @param {unknown} value
 * @param {RepeaterFieldSchema} repeaterSchema
 * @returns {Record<string, FieldValue>}
 */
function extractRawRepeaterFlat( value: any, repeaterSchema: any) {
  if (isLegacyRepeaterInstancesWrapper(value)) {
    const legacyKeys = Object.keys(value.instances ?? {});
    const first = legacyKeys[0];
    const inst = first ? value.instances[first] : null;
    if (inst && typeof inst === 'object') {
      return 'blocks' in inst
        ? migrateLegacyBlockData(inst, repeaterSchema)
        : { ...inst };
    }
    return {};
  }

  if (value && typeof value === 'object' && !Array.isArray(value) && !('url' in value)) {
    if ('blocks' in value) {
      return migrateLegacyBlockData(value, repeaterSchema);
    }
    return { ...value };
  }

  return {};
}

function applyFlatValuesToRepeaterTemplateDocument( doc: any, flat: any, repeaterSchema: any) {
  const storageSchemas = getRepeaterFieldSchemas(repeaterSchema);
  const templateFieldSchemas = doc.fieldSchemas ?? {};
  const editorIdByStorageKey = buildEditorIdByStorageKeyMap(
    storageSchemas,
    templateFieldSchemas,
  );

  /** Apply known storage → editor values (and any direct template editor ids in flat). */
  const valuesByEditorId: Record<string, FieldValue> = {};
  const assignedFlatKeys = new Set();
  for (const [storageKey, editorId] of Object.entries(editorIdByStorageKey)) {
    const schema = storageSchemas[storageKey];
    valuesByEditorId[editorId] = Object.prototype.hasOwnProperty.call(flat, storageKey)
      ? flat[storageKey]
      : resolveSchemaDefaultValue(schema, { forTemplate: true });
    if (Object.prototype.hasOwnProperty.call(flat, storageKey)) {
      assignedFlatKeys.add(storageKey);
    }
  }

  // Editor ids of nested tables inside the template, used to route extra row cells.
  const templateTableEditorIds = Object.entries(templateFieldSchemas)
    .filter(([, schema]) => (schema as SoftSchema)?.type === 'table')
    .map(([editorId]) => editorId);

  for (const [flatKey, flatVal] of Object.entries(flat ?? {})) {
    if (assignedFlatKeys.has(flatKey)) continue;
    if (templateFieldSchemas[flatKey]) {
      valuesByEditorId[flatKey] = flatVal;
      continue;
    }

    // Nested table cells (incl. rows added beyond the template) keep identity
    // storage keys; route them to the prefixed editor id under the same table.
    const prefixedKey = toRepeaterChildEditorFieldId(flatKey);
    const tableEditorId = templateTableEditorIds.find((tableId) =>
      prefixedKey.startsWith(`${tableId}_`),
    );
    if (tableEditorId) {
      valuesByEditorId[prefixedKey] = flatVal;
      continue;
    }

    for (const editorId of Object.keys(templateFieldSchemas)) {
      const stripped = fromRepeaterChildEditorFieldId(editorId);
      if (
        flatKey === stripped ||
        flatKey === labelToFieldKey(stripped) ||
        flatKey === editorId
      ) {
        valuesByEditorId[editorId] = flatVal;
        break;
      }
    }
  }

  for (const block of doc.blocks ?? []) {
    if (block.type === 'documentSection') {
      const fieldValues = { ...(block.data?.fieldValues ?? {}), ...valuesByEditorId };
      const segments = syncTableRowsInSegments(
        block.data?.segments ?? [],
        fieldValues,
        templateFieldSchemas,
      );
      block.data = { ...block.data, fieldValues, segments };
      continue;
    }

    if (block.type === 'templateBlock' && block.data?.fieldId) {
      const editorId = block.data.fieldId;
      if (Object.prototype.hasOwnProperty.call(valuesByEditorId, editorId)) {
        block.data = { ...block.data, value: valuesByEditorId[editorId] };
      }
    }
  }

  doc.fieldSchemas = ensureNestedTableCellSchemas(doc.fieldSchemas ?? {}, doc.blocks ?? []);
}

/**
 * Ensure nested table segments list instance rows discovered from cell values.
 * @param {import('../types.d.ts').DocumentSegment[]} segments
 * @param {Record<string, FieldValue>} fieldValues
 * @param {Record<string, import('../types.d.ts').FieldSchema>} fieldSchemas
 */
function syncTableRowsInSegments( segments: any, fieldValues: any, fieldSchemas: any): any[] {
  return (segments ?? []).map((seg: any) => {
    if (seg.type === 'columns') {
      return {
        ...seg,
        columns: (seg.columns ?? []).map((col: any) =>
          syncTableRowsInSegments(col, fieldValues, fieldSchemas),
        ),
      };
    }
    if (seg.type !== 'table' || !seg.id) return seg;
    const tableSchema = fieldSchemas[seg.id];
    if (!tableSchema || tableSchema.type !== 'table') return seg;
    const discovered = extractRowKeysFromTableValues(seg.id, tableSchema, fieldValues);
    const rows = mergeTableInstanceRows(seg.rows, discovered, tableSchema);
    return { ...seg, rows };
  });
}

/**
 * @param {Record<string, import('../types.d.ts').FieldSchema>} fieldSchemas
 * @param {import('../types.d.ts').EditorBlock[]} blocks
 */
function ensureNestedTableCellSchemas( fieldSchemas: any, blocks: any) {
  let next = { ...fieldSchemas };
  for (const block of blocks ?? []) {
    if (block.type !== 'documentSection') continue;
    walkSegments(block.data?.segments ?? [], (seg) => {
      if (seg.type !== 'table' || !seg.id) return;
      const tableSchema = next[seg.id];
      if (!tableSchema || tableSchema.type !== 'table') return;
      const rows = seg.rows ?? tableSchema.rows ?? [];
      next = ensureCellSchemasForRows(tableSchema, seg.id, next, rows);
    });
  }
  return next;
}

/**
 * Build nested-editor document for fill mode (uses uploaded template layout when present).
 * @param {RepeaterFieldSchema} repeaterSchema
 * @param {RepeaterValue | unknown} repeaterValue
 * @returns {EditorDocument}
 */
export function buildRepeaterFillDocument( repeaterSchema: any, repeaterValue: any) {
  const flat = normalizeRepeaterValue(repeaterValue, repeaterSchema);
  const templateBlocks = repeaterSchema.template?.blocks;
  const templateFieldSchemas = repeaterSchema.template?.fieldSchemas;

  if (templateBlocks?.length && templateFieldSchemas) {
    const doc = {
      time: Date.now(),
      fieldSchemas: JSON.parse(JSON.stringify(templateFieldSchemas)),
      blocks: JSON.parse(JSON.stringify(templateBlocks)),
    };
    applyFlatValuesToRepeaterTemplateDocument(doc, flat, repeaterSchema);
    return doc;
  }

  return buildRepeaterPreviewDocument(repeaterSchema, flat);
}

/** @deprecated Use buildRepeaterPreviewDocument */
export function buildRepeaterInstancePreviewDocument( repeaterSchema: any, _instanceKey: any, repeaterValue: any) {
  return buildRepeaterPreviewDocument(repeaterSchema, repeaterValue);
}

/** @deprecated Use buildRepeaterPreviewDocument */
export function buildRepeaterInstanceDocument( repeaterSchema: any, _instanceKey: any, repeaterValue: any) {
  return buildRepeaterPreviewDocument(repeaterSchema, repeaterValue);
}

/**
 * @param {RepeaterValue | null | undefined | unknown} value
 * @param {RepeaterFieldSchema} repeaterSchema
 * @returns {boolean}
 */
export function repeaterHasContent( value: any, repeaterSchema: any) {
  if (!repeaterSchema) return false;
  const flat = normalizeRepeaterValue(value, repeaterSchema);
  const childSchemas = getRepeaterFieldSchemas(repeaterSchema);

  for (const key of Object.keys(childSchemas)) {
    if (childFieldHasContent(flat[key])) {
      return true;
    }
  }

  const raw = extractRawRepeaterFlat(value, repeaterSchema);
  for (const val of Object.values(raw)) {
    if (childFieldHasContent(val)) {
      return true;
    }
  }

  return false;
}

export const REPEATER_TEMPLATE_FILE_KIND = 'repeater-template';
export const REPEATER_TEMPLATE_FILE_VERSION = 3;
export const REPEATER_CHILD_FIELD_PREFIX = '_repeater_';

/**
 * @param {string} storageKey
 * @returns {string}
 */
export function toRepeaterChildEditorFieldId( storageKey: any) {
  return `${REPEATER_CHILD_FIELD_PREFIX}${storageKey}`;
}

/**
 * @param {string} editorFieldId
 * @returns {string}
 */
export function fromRepeaterChildEditorFieldId( editorFieldId: any) {
  if (editorFieldId.startsWith(REPEATER_CHILD_FIELD_PREFIX)) {
    return editorFieldId.slice(REPEATER_CHILD_FIELD_PREFIX.length);
  }
  return editorFieldId;
}

/**
 * Drop child schemas whose keys collide with parent document fields.
 * @param {RepeaterFieldSchema} repeaterSchema
 * @param {Record<string, import('../types.d.ts').FieldSchema>} [parentFieldSchemas]
 * @param {import('../types.d.ts').EditorBlock[]} [blocks]
 * @returns {RepeaterFieldSchema}
 */
export function sanitizeRepeaterChildSchemas( repeaterSchema: any, parentFieldSchemas: any = {}, blocks: any = []) {
  if (!repeaterSchema || repeaterSchema.type !== 'child') return repeaterSchema;

  const childSchemas = repeaterSchema.fieldSchemas ?? {};
  const documentFieldIds = collectFieldIdsInBlocks(blocks, parentFieldSchemas);
  const parentFieldIds = new Set(Object.keys(parentFieldSchemas ?? {}));
  const filtered: SchemaMap = {};

  for (const [key, schema] of Object.entries(childSchemas)) {
    if (documentFieldIds.has(key)) continue;
    if (parentFieldIds.has(key)) continue;
    filtered[key] = schema as SoftSchema;
  }

  return normalizeRepeaterSchema({
    ...repeaterSchema,
    fieldSchemas: filtered,
  });
}

/**
 * Remove value keys that belong to the parent document field registry.
 * @param {unknown} value
 * @param {Record<string, import('../types.d.ts').FieldSchema>} [parentFieldSchemas]
 * @returns {unknown}
 */
export function stripForeignKeysFromRepeaterValue( value: any, parentFieldSchemas: any = {}, repeaterSchema: any = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || 'url' in value) {
    return value;
  }
  if (isLegacyRepeaterInstancesWrapper(value)) return value;

  const validStorageKeys = new Set(Object.keys(getRepeaterFieldSchemas(repeaterSchema ?? {})));
  const parentFieldIds = new Set(Object.keys(parentFieldSchemas ?? {}));
  const next: Record<string, FieldValue> = {};
  let changed = false;

  for (const [key, val] of Object.entries(value)) {
    if (validStorageKeys.has(key)) {
      next[key] = val;
      continue;
    }
    if (parentFieldIds.has(key)) {
      changed = true;
      continue;
    }
    next[key] = val;
  }

  return changed ? next : value;
}

/**
 * Build default child schemas from a flat repeater value when no template exists.
 * @param {unknown} value
 * @param {RepeaterFieldSchema} [repeaterSchema]
 * @returns {RepeaterFieldSchema['fieldSchemas']}
 */
function isLikelyRepeaterChildKey( key: any, parentFieldSchemas: any = {}, blocks: any = []) {
  if (!key) return false;
  if (Object.prototype.hasOwnProperty.call(parentFieldSchemas ?? {}, key)) return false;
  return !collectFieldIdsInBlocks(blocks, parentFieldSchemas).has(key);
}

export function inferRepeaterChildSchemasFromValue( value: any, repeaterSchema: any, parentFieldSchemas: any = {}, blocks: any = [],) {
  /** @type {Record<string, FieldValue>} */
  let raw = {};

  if (isLegacyRepeaterInstancesWrapper(value)) {
    const first = Object.keys(value.instances ?? {})[0];
    const inst = first ? value.instances[first] : null;
    if (inst && typeof inst === 'object') {
      raw =
        'blocks' in inst
          ? migrateLegacyBlockData(inst, repeaterSchema ?? { type: 'child', fieldSchemas: {} })
          : { ...inst };
    }
  } else if (value && typeof value === 'object' && !Array.isArray(value) && !('url' in value)) {
    raw =
      'blocks' in value
        ? migrateLegacyBlockData(value, repeaterSchema ?? { type: 'child', fieldSchemas: {} })
        : { ...value };
  }

  const fieldSchemas: SchemaMap = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!isLikelyRepeaterChildKey(key, parentFieldSchemas, blocks)) continue;
    if (val != null && typeof val === 'object' && !Array.isArray(val)) continue;
    const label = String(key)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
    fieldSchemas[key] = {
      type: 'text',
      label,
      name: key,
    };
  }

  return fieldSchemas;
}

/**
 * Keep existing child schemas or infer them from loaded values.
 * @param {RepeaterFieldSchema} repeaterSchema
 * @param {unknown} [value]
 * @returns {RepeaterFieldSchema}
 */
export function ensureRepeaterChildSchemas( repeaterSchema: any, value: any, parentFieldSchemas: any = {}, blocks: any = [],) {
  if (repeaterSchema?.template?.blocks?.length) {
    return normalizeRepeaterSchema(repeaterSchema);
  }

  const existing = getRepeaterFieldSchemas(repeaterSchema);
  if (Object.keys(existing).length > 0) {
    return normalizeRepeaterSchema(repeaterSchema);
  }

  const inferred = inferRepeaterChildSchemasFromValue(
    value,
    repeaterSchema,
    parentFieldSchemas,
    blocks,
  );
  if (!Object.keys(inferred).length) {
    return normalizeRepeaterSchema(repeaterSchema);
  }

  return normalizeRepeaterSchema({
    ...repeaterSchema,
    fieldSchemas: inferred,
  });
}

/**
 * @param {string} fieldId
 * @param {import('../types.d.ts').EditorBlock[]} blocks
 * @returns {unknown}
 */
export function extractRepeaterFieldValueFromBlocks( fieldId: any, blocks: any) {
  for (const block of blocks ?? []) {
    if (block.type === 'documentSection') {
      const fieldValues = block.data?.fieldValues ?? {};
      if (Object.prototype.hasOwnProperty.call(fieldValues, fieldId)) {
        return fieldValues[fieldId];
      }
    }

    if (block.type === 'templateBlock' && block.data?.fieldId === fieldId) {
      return block.data.value;
    }
  }

  return undefined;
}

/**
 * @param {Record<string, import('../types.d.ts').FieldSchema>} fieldSchemas
 * @param {import('../types.d.ts').EditorBlock[]} blocks
 * @returns {Record<string, import('../types.d.ts').FieldSchema>}
 */
export function ensureRepeaterSchemasFromBlockValues( fieldSchemas: any, blocks: any) {
  const next = { ...(fieldSchemas ?? {}) };

  for (const block of blocks ?? []) {
    if (block.type !== 'documentSection') continue;
    const fieldValues = block.data?.fieldValues ?? {};

    for (const seg of block.data?.segments ?? []) {
      if ((seg.type !== 'field' && seg.type !== 'child') || !seg.id) continue;
      const schema = next[seg.id];
      if (schema?.type !== 'child') continue;
      next[seg.id] = ensureRepeaterChildSchemas(schema, fieldValues[seg.id], next, blocks);
    }
  }

  for (const block of blocks ?? []) {
    if (block.type !== 'templateBlock' || block.data?.fieldType !== 'child') continue;
    const fieldId = block.data.fieldId;
    const schema = next[fieldId];
    if (schema?.type !== 'child') continue;
    next[fieldId] = ensureRepeaterChildSchemas(schema, block.data.value, next, blocks);
  }

  return next;
}

/**
 * @param {RepeaterFieldSchema} repeaterSchema
 * @returns {Record<string, unknown>}
 */
export function buildRepeaterTemplateExport( repeaterSchema: any) {
  return {
    kind: REPEATER_TEMPLATE_FILE_KIND,
    version: REPEATER_TEMPLATE_FILE_VERSION,
    fieldSchemas: getRepeaterFieldSchemas(repeaterSchema),
  };
}

/**
 * @param {unknown} data
 * @param {string} [repeaterFieldId]
 * @returns {{ fieldSchemas: RepeaterFieldSchema['fieldSchemas'], template?: RepeaterFieldSchema['template'] }}
 */
export function parseRepeaterTemplateImport( data: any, repeaterFieldId: any = '') {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid repeater template: expected a JSON object.');
  }

  const kind = data.kind;

  if (kind === 'field' || kind === 'document') {
    throw new Error(`Use a template file (kind: "template"), not "${kind}".`);
  }

  if (kind === 'template' || (kind == null && Array.isArray(data.blocks))) {
    if (!repeaterFieldId) {
      throw new Error('Repeater field id is required when importing a full editor template.');
    }
    if (!Array.isArray(data.blocks) || !data.blocks.length) {
      throw new Error('Template must include a non-empty blocks array.');
    }

    const doc = {
      time: data.time ?? Date.now(),
      fieldSchemas: data.fieldSchemas ?? {},
      blocks: data.blocks ?? [],
    };
    const namespaced = namespaceRepeaterChildTemplate(doc, repeaterFieldId);
    const storageFieldSchemas = extractRepeaterFieldSchemasFromDocument(namespaced);

    return {
      fieldSchemas: storageFieldSchemas,
      template: {
        blocks: namespaced.blocks,
        fieldSchemas: namespaced.fieldSchemas,
      },
    };
  }

  if (kind != null && kind !== REPEATER_TEMPLATE_FILE_KIND) {
    throw new Error(
      `Expected template (kind: "template") or repeater template (kind: "${REPEATER_TEMPLATE_FILE_KIND}"), got "${kind}".`,
    );
  }

  /** @type {RepeaterFieldSchema['fieldSchemas']} */
  let fieldSchemas = {};

  if ('template' in data && data.template && typeof data.template === 'object') {
    fieldSchemas = data.template.fieldSchemas ?? {};
  } else {
    fieldSchemas = data.fieldSchemas ?? {};
  }

  if (fieldSchemas == null || typeof fieldSchemas !== 'object' || Array.isArray(fieldSchemas)) {
    throw new Error('Invalid repeater template: fieldSchemas must be an object.');
  }

  const fieldCount = Object.keys(fieldSchemas).length;
  if (fieldCount > 25) {
    throw new Error(
      `Repeater template has ${fieldCount} fields (max 25). Upload a full editor template (kind: "template") instead.`,
    );
  }

  return { fieldSchemas };
}

/**
 * @param {RepeaterFieldSchema} repeaterSchema
 * @param {ReturnType<typeof parseRepeaterTemplateImport>} imported
 * @returns {RepeaterFieldSchema}
 */
export function applyRepeaterTemplateImport( repeaterSchema: any, imported: any) {
  /** @type {RepeaterFieldSchema} */
  const next = {
    ...repeaterSchema,
    fieldSchemas: imported.fieldSchemas,
  };
  if (imported.template?.blocks?.length) {
    next.template = imported.template;
  }
  return normalizeRepeaterSchema(next);
}

/**
 * After the Child fill modal saves, keep design-time template.blocks (seed rows).
 * Instance rows beyond the seed live in values and are re-expanded by
 * buildRepeaterFillDocument → syncTableRowsInSegments. Baking those rows into
 * the template made "+ Row" clone the previous Child's instance layout.
 * New cell schemas from the fill doc are merged so preview/mapping still resolve.
 * @param {RepeaterFieldSchema} repeaterSchema
 * @param {EditorDocument} fillDoc
 * @returns {RepeaterFieldSchema}
 */
export function syncRepeaterTemplateFromFillDocument( repeaterSchema: any, fillDoc: any) {
  if (!repeaterSchema || repeaterSchema.type !== 'child' || !fillDoc) {
    return repeaterSchema;
  }

  const templateBlocks = repeaterSchema.template?.blocks;
  const fieldSchemas = {
    ...(repeaterSchema.template?.fieldSchemas ?? {}),
    ...(fillDoc.fieldSchemas ?? {}),
  };

  return normalizeRepeaterSchema({
    ...repeaterSchema,
    template: {
      ...(repeaterSchema.template ?? {}),
      fieldSchemas,
      // Prefer the original seed layout; only fall back to the fill doc when
      // the Child had no template blocks yet.
      blocks: templateBlocks?.length
        ? JSON.parse(JSON.stringify(templateBlocks))
        : stripValuesFromBlocks(
            JSON.parse(JSON.stringify(fillDoc.blocks ?? [])),
            fieldSchemas,
          ),
    },
  });
}

/**
 * @param {EditorDocument} doc
 * @param {RepeaterFieldSchema} repeaterSchema
 * @returns {RepeaterValue}
 */
export function extractRepeaterValueFromDocument( doc: any, repeaterSchema: any) {
  const collected = collectAllValues(doc.blocks);
  const childSchemas = getRepeaterFieldSchemas(repeaterSchema);
  const templateSchemas = repeaterSchema.template?.fieldSchemas ?? {};
  const liveSchemas = { ...templateSchemas, ...(doc.fieldSchemas ?? {}) };
  const mapped: Record<string, FieldValue> = {};
  const claimed = new Set();

  for (const [key, schema] of Object.entries(childSchemas)) {
    const matchedKey = findCollectedKeyForStorageKey(collected, key, schema, claimed);
    if (matchedKey != null) {
      mapped[key] = collected[matchedKey];
      claimed.add(matchedKey);
    }
  }

  for (const [editorId, value] of Object.entries(collected)) {
    if (claimed.has(editorId)) continue;
    if (!liveSchemas[editorId]) continue;
    const storageKey = editorIdToRepeaterStorageKey(editorId, {
      ...repeaterSchema,
      template: {
        ...(repeaterSchema.template ?? {}),
        fieldSchemas: liveSchemas,
      },
    });
    if (!Object.prototype.hasOwnProperty.call(mapped, storageKey)) {
      mapped[storageKey] = value;
      claimed.add(editorId);
    }
  }

  return normalizeRepeaterValue(
    { ...collected, ...mapped },
    {
      ...repeaterSchema,
      template: {
        ...(repeaterSchema.template ?? {}),
        fieldSchemas: liveSchemas,
      },
    },
  );
}
