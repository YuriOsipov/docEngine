import { resolveRegistry } from '../registry/registry-context.js';
import { allocateFieldIdentity, findSectionNameForNode } from '../core/field-id.js';
import {
  extractFormulaReferences,
  formatFormulaReference,
  parseFormulaReferenceSegments,
  patchComputedFormulas,
  renameFieldNameInFormulas,
  renameFormulaPathInFormula,
} from '../core/formula-field-index.js';

const REPEATER_CHILD_FIELD_PREFIX = '_repeater_';

function isRepeaterChildFieldId(fieldId: any) {
  return typeof fieldId === 'string' && fieldId.startsWith(REPEATER_CHILD_FIELD_PREFIX);
}

function escapeRegExp(value: any) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Collect top-level fields/tables inside a moved DOM subtree that need section-owned IDs.
 * @param {HTMLElement} root
 * @returns {Array<{ kind: 'field' | 'table', id: string, el: HTMLElement }>}
 */
export function collectRemappableEntries(root: any) {
  const entries: Array<{ kind: 'field' | 'table'; id: string; el: any }> = [];
  if (!root?.classList) return entries;

  const addField = (el: any) => {
    const id = el?.dataset?.fieldId;
    if (!id || isRepeaterChildFieldId(id)) return;
    if (el.classList?.contains('field-token--cell')) return;
    entries.push({ kind: 'field', id, el });
  };

  const addTable = (el: any) => {
    const id = el?.dataset?.tableId;
    if (!id) return;
    entries.push({ kind: 'table', id, el });
  };

  if (root.classList.contains('field-token')) {
    addField(root);
    return entries;
  }

  if (root.classList.contains('document-table')) {
    addTable(root);
    return entries;
  }

  if (root.classList.contains('document-columns')) {
    root.querySelectorAll('.field-token:not(.field-token--cell)').forEach(addField);
    root.querySelectorAll('.document-table').forEach(addTable);
    return entries;
  }

  // Mixed prose fragments (text + field tokens) moved via native selection DnD.
  root.querySelectorAll?.('.field-token:not(.field-token--cell)').forEach(addField);
  root.querySelectorAll?.('.document-table').forEach(addTable);

  return entries;
}

export function remapFieldIdOnDom(entry: any, oldId: any, newId: any) {
  if (!entry?.el || !oldId || !newId || oldId === newId) return;

  if (entry.kind === 'field') {
    entry.el.dataset.fieldId = newId;
    return;
  }

  entry.el.dataset.tableId = newId;
  entry.el.querySelectorAll?.('.field-token--cell').forEach((token: any) => {
    if (token.dataset.tableId === oldId) {
      token.dataset.tableId = newId;
    }
    const fieldId = token.dataset.fieldId;
    if (typeof fieldId === 'string' && fieldId.startsWith(`${oldId}_`)) {
      token.dataset.fieldId = `${newId}${fieldId.slice(oldId.length)}`;
    }
  });
}

export function remapFieldIdInRegistry(registry: any, oldId: any, newId: any, schema: any) {
  if (!registry || !oldId || !newId || oldId === newId) return;

  const next = { ...registry.getFieldSchemas() };
  delete next[oldId];
  next[newId] = { ...schema };

  if (schema?.type === 'table') {
    const oldPrefix = `${oldId}_`;
    for (const key of [...Object.keys(next)]) {
      if (!key.startsWith(oldPrefix)) continue;
      next[`${newId}_${key.slice(oldPrefix.length)}`] = next[key];
      delete next[key];
    }
  }

  for (const [id, schemaRaw] of Object.entries(next)) {
    if (id === newId) continue;
    const computed = schemaRaw as any;
    if (computed?.type !== 'computed' || !computed.formula) continue;
    const formula = String(computed.formula);
    if (!formula.includes(`{${oldId}`)) continue;
    next[id] = {
      ...computed,
      formula: formula
        .replace(new RegExp(`\\{${escapeRegExp(oldId)}\\}`, 'g'), `{${newId}}`)
        .replace(new RegExp(`\\{${escapeRegExp(oldId)}_`, 'g'), `{${newId}_`),
    };
  }

  registry.setFieldSchemas(next);
}

export function moveFieldToSectionInFormulas(
  fieldSchemas: any,
  oldSectionName: any,
  newSectionName: any,
  fieldName: any,
) {
  if (!oldSectionName || !newSectionName || oldSectionName === newSectionName || !fieldName) {
    return fieldSchemas;
  }

  return patchComputedFormulas(fieldSchemas, (formula: any) => {
    let next = formula;
    for (const ref of extractFormulaReferences(formula)) {
      try {
        const segments = parseFormulaReferenceSegments(ref);
        if (segments.length < 2) continue;
        if (segments[0] !== oldSectionName || segments[1] !== fieldName) continue;
        segments[0] = newSectionName;
        next = renameFormulaPathInFormula(next, ref, formatFormulaReference(segments));
      } catch {
        // ignore invalid refs
      }
    }
    return next;
  });
}

/**
 * After a DOM node was moved into another section, re-derive owned field IDs and
 * update schemas / formula paths to match the target section.
 */
export function remapperMovedSubtreeToSection(
  root: any,
  targetBody: any,
  sourceBody: any,
  options: any = {},
) {
  const registry = resolveRegistry(options);
  if (!registry || !root || !targetBody) return false;

  const oldSectionName = findSectionNameForNode(sourceBody);
  const newSectionName = findSectionNameForNode(targetBody);
  if (!sourceBody || oldSectionName === newSectionName) return false;

  const entries = collectRemappableEntries(root);
  if (!entries.length) return false;

  let changed = false;

  for (const entry of entries) {
    const oldId = entry.id;
    const schema = registry.getFieldSchemas()?.[oldId];
    if (!schema) continue;

    const oldName = String(schema.name ?? schema.label ?? '').trim();
    const baseName = oldName || oldId;
    const { fieldId: newId, fieldName } = allocateFieldIdentity(targetBody, registry, baseName, {
      excludeFieldId: oldId,
    });
    const nextSchema = { ...schema, name: fieldName };

    if (newId !== oldId) {
      remapFieldIdOnDom(entry, oldId, newId);
      remapFieldIdInRegistry(registry, oldId, newId, nextSchema);
      entry.id = newId;
      changed = true;
    } else if (fieldName !== schema.name) {
      registry.updateFieldSchema(oldId, nextSchema);
      changed = true;
    }

    let schemas = registry.getFieldSchemas();
    const withSection = moveFieldToSectionInFormulas(schemas, oldSectionName, newSectionName, oldName);
    if (withSection !== schemas) {
      schemas = withSection;
      changed = true;
    }
    if (oldName && fieldName && oldName !== fieldName) {
      const withName = renameFieldNameInFormulas(schemas, newSectionName, oldName, fieldName);
      if (withName !== schemas) {
        schemas = withName;
        changed = true;
      }
    }
    if (schemas !== registry.getFieldSchemas()) {
      registry.setFieldSchemas(schemas);
    }
  }

  if (changed) {
    options.onSchemaChange?.(registry.getFieldSchemas());
  }

  return changed;
}
