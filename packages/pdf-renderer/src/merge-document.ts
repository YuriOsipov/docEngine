import {
  applyDocumentValues,
  normalizeDocumentValues,
  collectAllValues,
  resolveRepeatablePagePlan,
  isFieldsExport,
} from '@docengine/editor/node';
import type { EditorDocument, FieldsExport, TemplateExport } from './types.js';

export function mergeTemplateAndDocument(
  template: TemplateExport,
  fieldsExport: FieldsExport,
): EditorDocument {
  if (template?.kind !== 'template') {
    throw new Error('Expected template export with kind "template".');
  }
  if (!isFieldsExport(fieldsExport)) {
    throw new Error('Expected fields export with kind "field" (or legacy values-only kind "document").');
  }

  const blocks = template.blocks ?? [];
  const fieldSchemas = { ...(template.fieldSchemas ?? {}) };
  const values = normalizeDocumentValues(fieldsExport, blocks, fieldSchemas);
  const merged = applyDocumentValues(blocks, values, fieldSchemas);
  const flatValues = collectAllValues(merged.blocks);
  const pagePlan = resolveRepeatablePagePlan(
    merged.blocks,
    merged.fieldSchemas,
    flatValues,
    fieldsExport.sections ?? {},
  );

  const doc: EditorDocument = {
    time: fieldsExport.time ?? template.time ?? Date.now(),
    fieldSchemas: merged.fieldSchemas,
    blocks: merged.blocks,
  };

  if (template.pageSetup) {
    doc.pageSetup = JSON.parse(JSON.stringify(template.pageSetup));
  }

  if (pagePlan && pagePlan.instances.length > 1) {
    doc.repeatablePagePlan = pagePlan;
    doc.repeatableSectionInstances = { [pagePlan.sectionName]: pagePlan.instances };
  }

  return doc;
}
