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
