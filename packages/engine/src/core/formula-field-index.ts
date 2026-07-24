import {
  ROOT_SECTION_KEY,
  resolveSectionName,
  resolveFieldIdByName,
} from './field-id.js';
import { listColumnCellFieldIds, isValidFieldId } from './field-schemas.js';
import { walkSegments } from './segment-tree.js';
import type { EditorBlock, FieldSchema, Segment } from '../types.js';

const LEGACY_FIELD_ID_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const FIELD_REF_RE = /\{([^}]+)\}/g;

const SCALAR_FIELD_TYPES = new Set([
  'text',
  'integer',
  'date',
  'image',
  'list',
  'choice',
  'tree',
]);

export type FormulaFieldTreeNode = {
  id: string;
  label: string;
  kind: 'section' | 'field' | 'column';
  path?: string;
  fieldId?: string;
  tableId?: string;
  colKey?: string;
  children?: FormulaFieldTreeNode[];
};

type FieldSchemaMap = Record<string, FieldSchema>;

type TableColumn = {
  key: string;
  name?: string;
  label?: string;
  [key: string]: unknown;
};

type TableSchema = FieldSchema & {
  type: 'table';
  columns?: TableColumn[];
};

export type FormulaReferenceResolved =
  | { kind: 'scalar'; fieldId: string }
  | { kind: 'column'; tableId: string; colKey: string; cellIds: string[] };

export type FormulaTableColumnInfo = {
  tableId: string;
  sectionName: string;
  tableName: string;
  path: string;
  columns: Array<{ colKey: string; columnName: string; path: string }>;
};

function quoteSegment(segment: string): string {
  const str = String(segment ?? '');
  if (!str.includes('.') && !str.includes('"')) return str;
  return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function formatFormulaReference(segments: string[]): string {
  return (segments ?? []).map(quoteSegment).join('.');
}

export function parseFormulaReferenceSegments(ref: string): string[] {
  const raw = String(ref ?? '').trim();
  if (!raw) return [];

  const segments: string[] = [];
  let i = 0;

  while (i < raw.length) {
    if (raw[i] === '.') {
      i += 1;
      continue;
    }

    if (raw[i] === '"') {
      let j = i + 1;
      let str = '';
      while (j < raw.length) {
        if (raw[j] === '\\' && j + 1 < raw.length) {
          str += raw[j + 1];
          j += 2;
          continue;
        }
        if (raw[j] === '"') break;
        str += raw[j];
        j += 1;
      }
      if (raw[j] !== '"') throw new Error('Unclosed quoted segment in field reference');
      segments.push(str);
      i = j + 1;
      continue;
    }

    let j = i;
    while (j < raw.length && raw[j] !== '.') j += 1;
    segments.push(raw.slice(i, j));
    i = j;
  }

  return segments.filter((segment) => segment.length > 0);
}

export function extractFormulaReferences(formula: string): string[] {
  if (!formula) return [];
  const refs: string[] = [];
  for (const match of formula.matchAll(FIELD_REF_RE)) {
    refs.push(match[1]!);
  }
  return refs;
}

function columnDisplayName(col: TableColumn | null | undefined): string {
  return String(col?.name ?? col?.label ?? col?.key ?? '').trim();
}

function findTableColumnByName(
  tableSchema: TableSchema | null | undefined,
  columnName: string,
): TableColumn | null {
  const normalized = String(columnName ?? '').trim();
  if (!normalized) return null;

  for (const col of tableSchema?.columns ?? []) {
    if (columnDisplayName(col) === normalized) return col;
  }
  return null;
}

export function resolveFormulaReference(
  ref: string,
  blocks: EditorBlock[],
  fieldSchemas: FieldSchemaMap = {},
): FormulaReferenceResolved | null {
  const raw = String(ref ?? '').trim();
  if (!raw) return null;

  if (LEGACY_FIELD_ID_RE.test(raw) && fieldSchemas[raw]) {
    const schema = fieldSchemas[raw];
    if (schema?.type === 'table') return null;
    return { kind: 'scalar', fieldId: raw };
  }

  const segments = parseFormulaReferenceSegments(raw);
  if (segments.length === 2) {
    const [sectionName, fieldName] = segments;
    const fieldId = resolveFieldIdByName(sectionName!, fieldName!, blocks, fieldSchemas);
    if (!fieldId) return null;
    const schema = fieldSchemas[fieldId];
    if (!schema || schema.type === 'table') return null;
    return { kind: 'scalar', fieldId };
  }

  if (segments.length === 3) {
    const [sectionName, tableName, columnName] = segments;
    const tableId = resolveFieldIdByName(sectionName!, tableName!, blocks, fieldSchemas);
    if (!tableId) return null;
    const tableSchema = fieldSchemas[tableId] as TableSchema | undefined;
    if (tableSchema?.type !== 'table') return null;
    const col = findTableColumnByName(tableSchema, columnName!);
    if (!col) return null;
    return {
      kind: 'column',
      tableId,
      colKey: col.key,
      cellIds: listColumnCellFieldIds(tableId, col.key, fieldSchemas),
    };
  }

  return null;
}

export function extractFormulaDependencyFieldIds(
  formula: string,
  blocks: EditorBlock[],
  fieldSchemas: FieldSchemaMap = {},
): string[] {
  const ids = new Set<string>();

  for (const ref of extractFormulaReferences(formula)) {
    const resolved = resolveFormulaReference(ref, blocks, fieldSchemas);
    if (!resolved) {
      if (LEGACY_FIELD_ID_RE.test(ref) && fieldSchemas[ref]) {
        ids.add(ref);
      }
      continue;
    }

    if (resolved.kind === 'scalar') {
      ids.add(resolved.fieldId);
      continue;
    }

    for (const cellId of resolved.cellIds) {
      ids.add(cellId);
    }
  }

  return [...ids];
}

export function buildFormulaFieldTree(
  blocks: EditorBlock[],
  fieldSchemas: FieldSchemaMap = {},
  options: { excludeFieldId?: string | null } = {},
): FormulaFieldTreeNode[] {
  const { excludeFieldId = null } = options;
  const sectionMap = new Map<string, FormulaFieldTreeNode>();

  const ensureSection = (sectionName: string): FormulaFieldTreeNode => {
    const key = sectionName || ROOT_SECTION_KEY;
    if (!sectionMap.has(key)) {
      sectionMap.set(key, {
        id: `section:${key}`,
        label: key,
        kind: 'section',
        children: [],
      });
    }
    return sectionMap.get(key)!;
  };

  const addFieldNode = (
    sectionName: string,
    fieldId: string | undefined,
    schema: FieldSchema | undefined,
  ): void => {
    if (!fieldId || fieldId === excludeFieldId) return;
    if (!schema || schema.type === 'computed') return;

    const sectionNode = ensureSection(sectionName);
    const fieldName = String(schema.name ?? schema.label ?? fieldId).trim() || fieldId;
    const pathSegments = [sectionName, fieldName];

    if (schema.type === 'table') {
      const tableSchema = schema as TableSchema;
      const tableNode: FormulaFieldTreeNode = {
        id: `table:${fieldId}`,
        label: fieldName,
        kind: 'field',
        fieldId,
        path: formatFormulaReference(pathSegments),
        children: [],
      };

      for (const col of tableSchema.columns ?? []) {
        const columnName = columnDisplayName(col);
        if (!columnName) continue;
        tableNode.children!.push({
          id: `column:${fieldId}:${col.key}`,
          label: columnName,
          kind: 'column',
          tableId: fieldId,
          colKey: col.key,
          path: formatFormulaReference([...pathSegments, columnName]),
        });
      }

      sectionNode.children!.push(tableNode);
      return;
    }

    if (!SCALAR_FIELD_TYPES.has(schema.type)) return;

    sectionNode.children!.push({
      id: `field:${fieldId}`,
      label: fieldName,
      kind: 'field',
      fieldId,
      path: formatFormulaReference(pathSegments),
    });
  };

  for (const block of blocks ?? []) {
    const data = block.data ?? {};

    if (block.type === 'documentSection') {
      const sectionName = resolveSectionName(data);
      walkSegments((data.segments ?? []) as Segment[], (seg) => {
        if (seg.type !== 'field' && seg.type !== 'table') return;
        if (!('id' in seg) || !seg.id) return;
        addFieldNode(sectionName, seg.id, fieldSchemas[seg.id]);
      });
      continue;
    }

    if (block.type === 'visionTable' && data.fieldId) {
      addFieldNode(ROOT_SECTION_KEY, data.fieldId, fieldSchemas[data.fieldId]);
      continue;
    }

    if (block.type === 'templateBlock' && data.fieldId) {
      addFieldNode(ROOT_SECTION_KEY, data.fieldId, fieldSchemas[data.fieldId]);
    }
  }

  const sections = [...sectionMap.values()];
  sections.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  for (const section of sections) {
    section.children?.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    for (const child of section.children ?? []) {
      child.children?.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    }
  }

  return sections;
}

export function listFormulaTableColumns(
  blocks: EditorBlock[],
  fieldSchemas: FieldSchemaMap = {},
): FormulaTableColumnInfo[] {
  const tree = buildFormulaFieldTree(blocks, fieldSchemas);
  const tables: FormulaTableColumnInfo[] = [];

  for (const section of tree) {
    for (const field of section.children ?? []) {
      if (field.kind !== 'field' || !field.children?.length || !field.fieldId) continue;
      tables.push({
        tableId: field.fieldId,
        sectionName: section.label,
        tableName: field.label,
        path: field.path ?? '',
        columns: field.children.map((col) => ({
          colKey: col.colKey ?? '',
          columnName: col.label,
          path: col.path ?? '',
        })),
      });
    }
  }

  return tables;
}

export function renameFormulaPathInFormula(
  formula: string,
  oldPath: string,
  newPath: string,
): string {
  if (!formula || !oldPath || oldPath === newPath) return formula ?? '';
  const escaped = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return formula.replace(new RegExp(`\\{${escaped}\\}`, 'g'), `{${newPath}}`);
}

export function patchComputedFormulas(
  fieldSchemas: FieldSchemaMap,
  transform: (formula: string) => string,
): FieldSchemaMap {
  const next = { ...fieldSchemas };
  let changed = false;

  for (const [id, schema] of Object.entries(next)) {
    if (schema?.type !== 'computed' || !schema.formula) continue;
    const updated = transform(schema.formula as string);
    if (updated !== schema.formula) {
      next[id] = { ...schema, formula: updated };
      changed = true;
    }
  }

  return changed ? next : fieldSchemas;
}

export function createFormulaSegmentRenamer(
  sectionName: string,
  oldSegment: string,
  newSegment: string,
  segmentIndex: number,
): (formula: string) => string {
  return (formula) => {
    if (!formula) return formula;
    let next = formula;
    for (const ref of extractFormulaReferences(formula)) {
      try {
        const segments = parseFormulaReferenceSegments(ref);
        if (segments.length <= segmentIndex) continue;
        if (segments[0] !== sectionName) continue;
        if (segments[segmentIndex] !== oldSegment) continue;
        segments[segmentIndex] = newSegment;
        const newRef = formatFormulaReference(segments);
        next = renameFormulaPathInFormula(next, ref, newRef);
      } catch {
        // ignore invalid refs
      }
    }
    return next;
  };
}

export function renameSectionInFormulas(
  fieldSchemas: FieldSchemaMap,
  oldSectionName: string,
  newSectionName: string,
): FieldSchemaMap {
  if (!oldSectionName || !newSectionName || oldSectionName === newSectionName) {
    return fieldSchemas;
  }
  return patchComputedFormulas(fieldSchemas, (formula) => {
    let next = formula;
    for (const ref of extractFormulaReferences(formula)) {
      try {
        const segments = parseFormulaReferenceSegments(ref);
        if (segments[0] !== oldSectionName) continue;
        segments[0] = newSectionName;
        next = renameFormulaPathInFormula(next, ref, formatFormulaReference(segments));
      } catch {
        // ignore invalid refs
      }
    }
    return next;
  });
}

export function renameFieldNameInFormulas(
  fieldSchemas: FieldSchemaMap,
  sectionName: string,
  oldFieldName: string,
  newFieldName: string,
): FieldSchemaMap {
  if (!oldFieldName || !newFieldName || oldFieldName === newFieldName) {
    return fieldSchemas;
  }
  return patchComputedFormulas(
    fieldSchemas,
    createFormulaSegmentRenamer(sectionName, oldFieldName, newFieldName, 1),
  );
}

export function renameTableColumnInFormulas(
  fieldSchemas: FieldSchemaMap,
  sectionName: string,
  tableName: string,
  oldColumnName: string,
  newColumnName: string,
): FieldSchemaMap {
  if (!oldColumnName || !newColumnName || oldColumnName === newColumnName) {
    return fieldSchemas;
  }
  return patchComputedFormulas(fieldSchemas, (formula) => {
    let next = formula;
    for (const ref of extractFormulaReferences(formula)) {
      try {
        const segments = parseFormulaReferenceSegments(ref);
        if (segments.length !== 3) continue;
        if (segments[0] !== sectionName || segments[1] !== tableName) continue;
        if (segments[2] !== oldColumnName) continue;
        segments[2] = newColumnName;
        next = renameFormulaPathInFormula(next, ref, formatFormulaReference(segments));
      } catch {
        // ignore invalid refs
      }
    }
    return next;
  });
}

export { isValidFieldId };
