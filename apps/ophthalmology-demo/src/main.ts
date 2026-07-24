// @ts-nocheck
import {
  createEditor,
  registerField,
  normalizeImportedDoc,
  buildTemplateExport,
  applyDocumentValues,
  normalizeDocumentValues,
  validateRequiredFields,
  saveBlobToDisk,
  ACTION_ICONS,
  normalizeFieldMappingSpec,
  showNotification,
} from '@docengine/editor';
import {
  registerDateField,
  createDatePickerCallbacks,
} from '@docengine/field-date';
import '@docengine/editor/styles.css';
import '@docengine/editor/themes/bridge.css';
import './styles/demo.css';
import './styles/modern-theme.css';

import { createOphthalmologyTemplate } from './data/ophthalmology-template.js';
import { ophthalmologyCatalogs } from './catalogs.js';
import { resolveOphthalmologyListItems } from './services/resolve-list-items.js';

registerDateField({ registerField });

const defaultDocument = createOphthalmologyTemplate();

let docEngine = createEditor({
  holder: '#editorjs',
  data: defaultDocument,
  defaultDocument,
  catalogs: ophthalmologyCatalogs,
  resolveListItems: resolveOphthalmologyListItems,
  tools: ['documentSection', 'templateBlock'],
  pickers: createDatePickerCallbacks(),
  ui: {
    chromeParent: '.page-sticky-chrome',
    designLayout: 'panels',
    documentActionsContainer: '.page-actions__document',
    pdfFilename: 'ophthalmology-document.pdf',
  },

  imageUpload: {

    uploadUrl: import.meta.env.VITE_UPLOAD_BASE_URL ?? '',

    stub: !import.meta.env.VITE_UPLOAD_BASE_URL,

  },

});



const designToggle = document.getElementById('design-mode-toggle');

designToggle?.addEventListener('change', async () => {

  await docEngine.setDesignMode(designToggle.checked);

});



function initIconButton(el, icon, label) {

  if (!el) return;

  el.innerHTML = icon;

  el.title = label;

  el.setAttribute('aria-label', label);

}



function initLoadLabel(label, icon, text) {

  if (!label) return;

  const glyph = document.createElement('span');

  glyph.className = 'btn-icon__glyph';

  glyph.innerHTML = icon;

  label.insertBefore(glyph, label.firstChild);

  label.title = text;

}



initIconButton(document.getElementById('btn-save-full-document'), ACTION_ICONS.save, 'Save full document');

initLoadLabel(document.querySelector('label[aria-label="Load full document"]'), ACTION_ICONS.load, 'Load full document');

initIconButton(document.getElementById('btn-save-template'), ACTION_ICONS.save, 'Save template');

initLoadLabel(document.querySelector('label[aria-label="Load template"]'), ACTION_ICONS.load, 'Load template');

initIconButton(document.getElementById('btn-save-fields'), ACTION_ICONS.save, 'Save values');

initLoadLabel(document.querySelector('label[aria-label="Load values"]'), ACTION_ICONS.load, 'Load values');

initIconButton(document.getElementById('btn-save-mapping'), ACTION_ICONS.save, 'Save template with mapping');

initLoadLabel(document.querySelector('label[aria-label="Load mapping"]'), ACTION_ICONS.load, 'Load mapping from template or mapping JSON');



async function saveJson(data, defaultFilename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  await saveBlobToDisk(blob, defaultFilename, 'application/json');
}



async function loadJsonFile(file) {

  const text = await file.text();

  return JSON.parse(text);

}



function formatMissingRequiredMessage(missing) {

  const labels = missing.map((item) => item.label);

  if (labels.length === 1) {

    return `Cannot save: required field is empty — ${labels[0]}.`;

  }

  const preview = labels.slice(0, 5).join(', ');

  const more = labels.length > 5 ? ` (+${labels.length - 5} more)` : '';

  return `Cannot save: ${labels.length} required fields are empty — ${preview}${more}.`;

}



async function ensureRequiredFieldsFilled() {

  const { valid, missing } = await docEngine.validate();

  if (valid) return true;

  showNotification(formatMissingRequiredMessage(missing), { type: 'error' });

  return false;

}



document.getElementById('btn-save-full-document')?.addEventListener('click', async () => {

  if (!(await ensureRequiredFieldsFilled())) return;

  await saveJson(await docEngine.exportDoc(), 'ophthalmology-full-document.json');

});



document.getElementById('btn-load-full-document')?.addEventListener('change', async (e: any) => {

  const file = e.target.files?.[0];

  if (!file) return;



  try {

    const data = await loadJsonFile(file);

    if (data.kind && data.kind !== 'document' && data.kind !== 'template') {
      if (data.kind === 'field' || (data.kind === 'document' && !data.blocks)) {
        alert('This is a values file. Use Values → Load instead.');
        return;
      }
    }

    await docEngine.load(normalizeImportedDoc(data));

  } catch (err: any) {

    alert('Failed to load full document: ' + err.message);

  }



  e.target.value = '';

});



document.getElementById('btn-save-template')?.addEventListener('click', async () => {

  await saveJson(await docEngine.exportTemplate(), 'ophthalmology-template.json');

});



document.getElementById('btn-load-template')?.addEventListener('change', async (e: any) => {

  const file = e.target.files?.[0];

  if (!file) return;



  try {

    const data = await loadJsonFile(file);

    if (data.kind && data.kind !== 'template') {

      alert(`Expected a template file (kind: "template"), got "${data.kind}".`);

      return;

    }

    if (!confirm('Load template? Current layout and field schemas will be replaced.')) return;

    await docEngine.load(normalizeImportedDoc(data));

  } catch (err: any) {

    alert('Failed to load template: ' + err.message);

  }



  e.target.value = '';

});



document.getElementById('btn-save-fields')?.addEventListener('click', async () => {

  if (!(await ensureRequiredFieldsFilled())) return;

  await saveJson(await docEngine.exportFields(), 'ophthalmology-values.json');

});



document.getElementById('btn-load-fields')?.addEventListener('change', async (e: any) => {

  const file = e.target.files?.[0];

  if (!file) return;



  try {

    const data = await loadJsonFile(file);

    const isValuesExport =
      data.kind === 'field' || (data.kind === 'document' && !Array.isArray(data.blocks));
    if (data.kind && !isValuesExport) {
      alert(`Expected a values file (kind: "field"), got "${data.kind ?? 'unknown'}".`);
      return;
    }

    if (!data.values && !data.sections) {

      alert('Values file has no values or sections.');

      return;

    }



    const doc = await docEngine.getDocument();

    const values = normalizeDocumentValues(data, doc.blocks, doc.fieldSchemas);

    const { blocks, fieldSchemas: nextFieldSchemas } = applyDocumentValues(

      doc.blocks,

      values,

      doc.fieldSchemas,

    );

    await docEngine.load({

      time: data.time ?? Date.now(),

      fieldSchemas: nextFieldSchemas,

      blocks,

    });

  } catch (err: any) {

    alert('Failed to load values: ' + err.message);

  }



  e.target.value = '';

});



document.getElementById('btn-edit-mapping')?.addEventListener('click', async () => {

  try {

    await docEngine.openFieldMapping();

  } catch (err: any) {

    if (err?.message !== 'cancelled') {

      alert('Field mapping: ' + (err?.message ?? String(err)));

    }

  }

});



document.getElementById('btn-save-mapping')?.addEventListener('click', async () => {
  // Mapping is persisted inside the template JSON (fieldMapping), not as a separate file.
  await saveJson(await docEngine.exportTemplate(), 'ophthalmology-template.json');
});

document.getElementById('btn-load-mapping')?.addEventListener('change', async (e: any) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const data = await loadJsonFile(file);
    const mapping =
      data?.kind === 'fieldMapping'
        ? data
        : data?.fieldMapping && typeof data.fieldMapping === 'object'
          ? data.fieldMapping
          : null;
    if (!mapping) {
      alert('No fieldMapping found. Use a template JSON or a fieldMapping JSON file.');
      return;
    }
    docEngine.setFieldMapping(normalizeFieldMappingSpec(mapping));
    alert('Field mapping loaded. Save template to persist it with the template export.');
  } catch (err: any) {
    alert('Failed to load field mapping: ' + err.message);
  }

  e.target.value = '';
});



// Re-export schemas for template module compatibility

export { ophthalmologySchemas };

