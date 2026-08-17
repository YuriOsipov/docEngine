import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  assertTemplate,
  buildDocumentExportFromInput,
  buildFullDocumentExport,
  getByPath,
  resolveInputValues,
  resolveTemplateFromItem,
} from './docengine-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const exampleTemplatePath = join(__dirname, '../../../../../examples/mammology-document-template.json');

test('assertTemplate accepts editor template export', () => {
  const template = JSON.parse(readFileSync(exampleTemplatePath, 'utf8'));
  assert.equal(assertTemplate(template).kind, 'template');
});

test('assertTemplate rejects invalid payload', () => {
  assert.throws(() => assertTemplate({ kind: 'bogus' }), /kind "template"/);
});

test('getByPath reads nested values', () => {
  assert.equal(getByPath('body.patient', { body: { patient: 'Ann' } }), 'Ann');
  assert.deepEqual(getByPath('', { a: 1 }), { a: 1 });
});

test('buildDocumentExportFromInput accepts flat field map', () => {
  const template = JSON.parse(readFileSync(exampleTemplatePath, 'utf8'));
  const document = buildDocumentExportFromInput(template, { statusLocalis: ['тканина однорідна'] });
  assert.equal(document.kind, 'field');
  assert.ok(document.sections);
});

test('buildFullDocumentExport returns template, fields, and doc', () => {
  const template = JSON.parse(readFileSync(exampleTemplatePath, 'utf8'));
  const full = buildFullDocumentExport(template, { statusLocalis: ['тканина однорідна'] });
  assert.equal(full.kind, 'docengine-document');
  assert.equal(full.template.kind, 'template');
  assert.equal(full.fields.kind, 'field');
  assert.equal(full.doc.kind, 'document');
  assert.ok(full.doc.blocks?.length);
});

test('assertTemplate strips tree node ids from field schemas', () => {
  const template = assertTemplate({
    kind: 'template',
    version: 2,
    fieldSchemas: {
      status: {
        type: 'tree',
        tree: [{ id: 'n_old', label: 'OK' }],
      },
    },
    blocks: [],
  });
  assert.deepEqual(template.fieldSchemas.status.tree, [{ label: 'OK' }]);
});

test('resolveTemplateFromItem reads nested path', () => {
  const template = JSON.parse(readFileSync(exampleTemplatePath, 'utf8'));
  const resolved = resolveTemplateFromItem({ body: { template } }, 'body.template');
  assert.equal(resolved.kind, 'template');
  assert.ok(resolved.blocks?.length);
});

test('resolveTemplateFromItem uses whole item when path is empty', () => {
  const template = JSON.parse(readFileSync(exampleTemplatePath, 'utf8'));
  const resolved = resolveTemplateFromItem(template);
  assert.equal(resolved.kind, 'template');
});

test('resolveTemplateFromItem parses JSON string at path', () => {
  const template = JSON.parse(readFileSync(exampleTemplatePath, 'utf8'));
  const resolved = resolveTemplateFromItem(
    { template: JSON.stringify(template) },
    'template',
  );
  assert.equal(resolved.kind, 'template');
});

test('resolveTemplateFromItem rejects invalid template kind', () => {
  assert.throws(
    () => resolveTemplateFromItem({ kind: 'bogus', blocks: [] }),
    /kind "template"/,
  );
});

test('resolveInputValues uses a mapped object from n8n JS/expression mode', () => {
  const incoming = {
    kind: 'document',
    sections: {
      Anamnesis: {
        Complaints: ['Vision disturbance decreased acuity.', 'Tearing'],
        'Life history': ['Chronic conditions hypertension'],
      },
    },
  };
  const mapped = {
    sections: {
      Anamnesis: {
        Complaints: 'Vision disturbance decreased acuity.',
        'Life history': 'Chronic conditions hypertension',
      },
    },
  };
  assert.deepEqual(resolveInputValues(mapped, incoming), mapped);
});

test('resolveInputValues parses a JSON object string', () => {
  const incoming = { kind: 'document', sections: { Anamnesis: { Complaints: ['all'] } } };
  const json = '{"Complaints":"first only"}';
  assert.deepEqual(resolveInputValues(json, incoming), { Complaints: 'first only' });
});

test('resolveInputValues reads a dot-path', () => {
  const incoming = { body: { patient: 'Ann' } };
  assert.deepEqual(resolveInputValues('body', incoming), { patient: 'Ann' });
});

test('resolveInputValues uses the whole item when path is empty', () => {
  const incoming = { kind: 'document', sections: { A: { x: 1 } } };
  assert.equal(resolveInputValues('', incoming), incoming);
  assert.equal(resolveInputValues(null, incoming), incoming);
});

test('resolveInputValues does not fall back to the incoming document for a missing path', () => {
  const incoming = { kind: 'document', sections: { A: { x: 1 } } };
  assert.throws(
    () => resolveInputValues('missing.path', incoming),
    /not found on the incoming item/,
  );
});
