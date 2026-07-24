import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createSchemaEditorController } from './schema-editor-controller.js';

function installDom() {
  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  globalThis.document = document;
  globalThis.window = { document } as any;
  globalThis.HTMLElement = document.defaultView.HTMLElement;
  globalThis.Event = document.defaultView.Event;
  return document;
}

describe('schema-editor-controller allowManualEdit', () => {
  it('removes allowManualEdit from saved schema when checkbox is unchecked', () => {
    installDom();
    const body = document.createElement('div');
    document.body.appendChild(body);

    const controller = createSchemaEditorController({ body });
    const schema = {
      type: 'list',
      name: 'SkinChanges',
      label: 'List',
      multi: true,
      itemLayout: 'inline',
      itemPrefix: '',
      items: [{ id: 'item1', label: 'Option 1' }],
      defaultValue: [],
      allowManualEdit: true,
    };

    controller.load('skin_changes', schema, {
      sectionName: 'Exam',
      blocks: [],
      fieldSchemas: { skin_changes: schema },
    });

    assert.ok(body.querySelector('.schema-designer-launch'));
    assert.ok(body.textContent.includes('1 option'));

    const checkbox = body.querySelector('[data-field="allowManualEdit"]');
    assert.ok(checkbox);
    assert.ok(checkbox.hasAttribute('checked'));
    checkbox.checked = false;

    const result = controller.trySave();
    assert.ok(result);
    assert.equal('allowManualEdit' in result.schema, false);
  });
});

describe('schema-editor-controller remote list source', () => {
  it('saves sourceCollection and sourceLabelField for remote list fields', async () => {
    installDom();
    const body = document.createElement('div');
    document.body.appendChild(body);

    const controller = createSchemaEditorController({
      body,
      getRemoteListCollections: async () => ({
        bookmarks: [],
        tree: [
          {
            id: 'patient',
            label: 'Patient',
            kind: 'collection',
            collectionId: 'patient',
            children: [
              {
                id: 'preset:21',
                label: 'new',
                kind: 'preset',
                collectionId: 'patient',
                presetId: '21',
              },
            ],
          },
        ],
      }),
      getRemoteListLabelFields: async () => [
        { id: 'name', label: 'Name' },
      ],
    });

    const schema = {
      type: 'list',
      name: 'PatientList',
      label: 'Patient',
      multi: true,
      listSource: 'remote',
      sourceCollection: 'patient',
      sourceLabelField: 'name',
      itemLayout: 'inline',
      itemPrefix: '',
      defaultValue: [],
    };

    controller.load('patient_list', schema, {
      sectionName: 'Exam',
      blocks: [],
      fieldSchemas: { patient_list: schema },
    });

    await new Promise((resolve: any) => setTimeout(resolve, 0));

    const collectionInput = body.querySelector('[data-field="sourceCollection"]');
    assert.ok(collectionInput);
    assert.equal(collectionInput.value, 'patient');

    const result = controller.trySave();
    assert.ok(result);
    assert.equal(result.schema.listSource, 'remote');
    assert.equal(result.schema.sourceCollection, 'patient');
    assert.equal(result.schema.sourceLabelField, 'name');
  });

  it('saves sourcePresetId after selecting a bookmark in the tree picker', async () => {
    installDom();
    const body = document.createElement('div');
    document.body.appendChild(body);

    const controller = createSchemaEditorController({
      body,
      getRemoteListCollections: async () => ({
        bookmarks: [],
        tree: [
          {
            id: 'patient',
            label: 'Patient',
            kind: 'collection',
            collectionId: 'patient',
            children: [
              {
                id: 'preset:21',
                label: 'new',
                kind: 'preset',
                collectionId: 'patient',
                presetId: '21',
              },
            ],
          },
        ],
      }),
      getRemoteListLabelFields: async () => [{ id: 'name', label: 'Name' }],
    });

    const schema = {
      type: 'choice',
      name: 'PatientChoice',
      label: 'Patient',
      listSource: 'remote',
      sourceCollection: 'patient',
      itemLayout: 'inline',
      defaultValue: '',
    };

    controller.load('patient_choice', schema, {
      sectionName: 'Exam',
      blocks: [],
      fieldSchemas: { patient_choice: schema },
    });

    await new Promise((resolve: any) => setTimeout(resolve, 0));

    const presetLeaf = body.querySelector('.collection-tree-picker__leaf--preset');
    assert.ok(presetLeaf);
    presetLeaf.click();

    const result = controller.trySave();
    assert.ok(result);
    assert.equal(result.schema.sourceCollection, 'patient');
    assert.equal(result.schema.sourcePresetId, '21');
  });

  it('saves sourcePresetId when a Directus bookmark preset is selected', async () => {
    installDom();
    const body = document.createElement('div');
    document.body.appendChild(body);

    const controller = createSchemaEditorController({
      body,
      getRemoteListCollections: async () => ({
        bookmarks: [],
        tree: [
          {
            id: 'patient',
            label: 'Patient',
            kind: 'collection',
            collectionId: 'patient',
            children: [
              {
                id: 'preset:21',
                label: 'new',
                kind: 'preset',
                collectionId: 'patient',
                presetId: '21',
              },
            ],
          },
        ],
      }),
      getRemoteListLabelFields: async () => [{ id: 'name', label: 'Name' }],
    });

    const schema = {
      type: 'list',
      name: 'PatientList',
      label: 'Patient',
      multi: true,
      listSource: 'remote',
      sourceCollection: 'patient',
      sourcePresetId: '21',
      sourceLabelField: 'name',
      itemLayout: 'inline',
      itemPrefix: '',
      defaultValue: [],
    };

    controller.load('patient_list', schema, {
      sectionName: 'Exam',
      blocks: [],
      fieldSchemas: { patient_list: schema },
    });

    await new Promise((resolve: any) => setTimeout(resolve, 0));

    const presetInput = body.querySelector('[data-field="sourcePresetId"]');
    assert.ok(presetInput);
    assert.equal(presetInput.value, '21');

    const result = controller.trySave();
    assert.ok(result);
    assert.equal(result.schema.sourcePresetId, '21');
  });
});

describe('schema-editor-controller readonly', () => {
  it('saves readonly when checkbox is checked', () => {
    installDom();
    const body = document.createElement('div');
    document.body.appendChild(body);

    const controller = createSchemaEditorController({ body });
    const schema = {
      type: 'text',
      name: 'PatientName',
      label: 'Patient name',
      defaultText: '',
    };

    controller.load('patient_name', schema, {
      sectionName: 'Header',
      blocks: [],
      fieldSchemas: { patient_name: schema },
    });

    const checkbox = body.querySelector('[data-field="readonly"]');
    assert.ok(checkbox);
    checkbox.checked = true;

    const result = controller.trySave();
    assert.ok(result);
    assert.equal(result.schema.readonly, true);
  });

  it('removes readonly from saved schema when checkbox is unchecked', () => {
    installDom();
    const body = document.createElement('div');
    document.body.appendChild(body);

    const controller = createSchemaEditorController({ body });
    const schema = {
      type: 'text',
      name: 'PatientName',
      label: 'Patient name',
      defaultText: '',
      readonly: true,
    };

    controller.load('patient_name', schema, {
      sectionName: 'Header',
      blocks: [],
      fieldSchemas: { patient_name: schema },
    });

    const checkbox = body.querySelector('[data-field="readonly"]');
    assert.ok(checkbox);
    checkbox.checked = false;

    const result = controller.trySave();
    assert.ok(result);
    assert.equal('readonly' in result.schema, false);
  });
});
