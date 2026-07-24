// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildSectionedDocumentFromValues,
  expandSectionedDocument,
  extractRepeatableSectionInstances,
  buildRepeatableInstancesFromEditor,
  resolveRepeatablePagePlan,
  findAdjacentTableBlock,
  isSectionInstanceArray,
} from './sectioned-document-io.js';
import { ROOT_SECTION_KEY } from '../field-id.js';
import { cellFieldId } from '../field-schemas.js';

const tableId = 'examination_table_test';
const tableSchema = {
  type: 'table',
  name: 'Test table',
  label: 'Table',
  columns: [
    { key: 'col1', label: 'Column 1' },
    { key: 'col2', label: 'Column 2' },
  ],
  cellType: 'text',
};

describe('buildSectionedDocumentFromValues', () => {
  it('groups values by section name and field name', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          label: 'Examination',
          segments: [
            { type: 'field', id: 'examination_orbit_od' },
            { type: 'table', id: tableId, rows: [{ key: 'row1', label: '' }] },
          ],
          fieldValues: {
            examination_orbit_od: 'norm',
            [cellFieldId(tableId, 'row1', 'col1')]: 'a',
            [cellFieldId(tableId, 'row1', 'col2')]: 'b',
          },
        },
      },
    ];
    const fieldSchemas = {
      examination_orbit_od: { type: 'choice', name: 'Orbit OD', label: 'OD' },
      [tableId]: tableSchema,
    };
    const flat = {
      examination_orbit_od: 'norm',
      [cellFieldId(tableId, 'row1', 'col1')]: 'a',
      [cellFieldId(tableId, 'row1', 'col2')]: 'b',
    };

    const sections = buildSectionedDocumentFromValues(blocks, fieldSchemas, flat);
    assert.equal(sections.Examination['Orbit OD'], 'norm');
    assert.deepEqual(sections.Examination['Test table'], [{ col1: 'a', col2: 'b' }]);
  });

  it('puts visionTable under _root', () => {
    const visionId = '_root_visual_acuity';
    const blocks = [
      {
        type: 'visionTable',
        data: {
          fieldId: visionId,
          cells: {
            [cellFieldId(visionId, 'od', 'vis')]: '0.8',
          },
        },
      },
    ];
    const fieldSchemas = {
      [visionId]: {
        type: 'table',
        name: 'Visual acuity',
        label: 'Visual acuity',
        columns: [{ key: 'vis', label: 'vis' }],
        rows: [{ key: 'od', label: 'OD' }],
      },
    };
    const flat = {
      [cellFieldId(visionId, 'od', 'vis')]: '0.8',
    };
    const sections = buildSectionedDocumentFromValues(blocks, fieldSchemas, flat);
    assert.deepEqual(sections[ROOT_SECTION_KEY]['Visual acuity'], [{ vis: '0.8' }]);
  });

  it('uses section name not display label for export keys', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          name: 'Anamnesis',
          label: 'Анамнез',
          segments: [{ type: 'field', id: 'anamnesis_complaints' }],
          fieldValues: { anamnesis_complaints: ['Tearing'] },
        },
      },
    ];
    const fieldSchemas = {
      anamnesis_complaints: { type: 'tree', name: 'Complaints', label: 'Complaints' },
    };
    const sections = buildSectionedDocumentFromValues(
      blocks,
      fieldSchemas,
      { anamnesis_complaints: ['Tearing'] },
    );
    assert.ok(sections.Anamnesis);
    assert.deepEqual(sections.Anamnesis.Complaints, ['Tearing']);
    assert.equal(sections['Анамнез'], undefined);
  });
});

describe('expandSectionedDocument', () => {
  it('resolves section field names to internal ids', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          label: 'Examination',
          segments: [{ type: 'field', id: 'examination_orbit_od' }],
        },
      },
    ];
    const fieldSchemas = {
      examination_orbit_od: { type: 'choice', name: 'Orbit OD', label: 'OD' },
    };
    const flat = expandSectionedDocument(
      { Examination: { 'Orbit OD': 'norm' } },
      blocks,
      fieldSchemas,
    );
    assert.equal(flat.examination_orbit_od, 'norm');
  });

  it('resolves fields by section name when label differs', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          name: 'Anamnesis',
          label: 'Анамнез',
          segments: [{ type: 'field', id: 'anamnesis_complaints' }],
        },
      },
    ];
    const fieldSchemas = {
      anamnesis_complaints: { type: 'tree', name: 'Complaints', label: 'Complaints' },
    };
    const flat = expandSectionedDocument(
      { Anamnesis: { Complaints: ['Tearing'] } },
      blocks,
      fieldSchemas,
    );
    assert.deepEqual(flat.anamnesis_complaints, ['Tearing']);
  });

  it('loads flat repeater values by field name', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          name: 'Anamnesis',
          label: 'Anamnesis',
          segments: [
            { type: 'field', id: 'anamnesis_shippingAddress' },
            { type: 'field', id: 'anamnesis_billingAddress' },
          ],
        },
      },
    ];
    const fieldSchemas = {
      anamnesis_shippingAddress: {
        type: 'child',
        name: 'shippingAddress',
        label: 'Shipping address',
        fieldSchemas: {
          street: { type: 'text', name: 'Street', label: 'Street' },
          city: { type: 'text', name: 'City', label: 'City' },
        },
      },
      anamnesis_billingAddress: {
        type: 'child',
        name: 'billingAddress',
        label: 'Billing address',
        fieldSchemas: {
          street: { type: 'text', name: 'Street', label: 'Street' },
          city: { type: 'text', name: 'City', label: 'City' },
        },
      },
    };
    const flat = expandSectionedDocument(
      {
        Anamnesis: {
          shippingAddress: { street: '123 Main', city: 'Boston' },
          billingAddress: { street: '456 Oak', city: 'Cambridge' },
        },
      },
      blocks,
      fieldSchemas,
    );
    assert.deepEqual(flat.anamnesis_shippingAddress, { street: '123 Main', city: 'Boston' });
    assert.deepEqual(flat.anamnesis_billingAddress, { street: '456 Oak', city: 'Cambridge' });
  });

  it('uses the first instance when section value is an array', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          name: 'Items',
          label: 'Items',
          repeatable: true,
          segments: [{ type: 'field', id: 'items_name' }],
        },
      },
    ];
    const fieldSchemas = {
      items_name: { type: 'text', name: 'Name', label: 'Name' },
    };
    const flat = expandSectionedDocument(
      {
        Items: [{ Name: 'First' }, { Name: 'Second' }],
      },
      blocks,
      fieldSchemas,
    );
    assert.equal(flat.items_name, 'First');
  });
});

describe('repeatable section instances', () => {
  it('detects section instance arrays', () => {
    assert.equal(isSectionInstanceArray([{ Name: 'A' }]), true);
    assert.equal(isSectionInstanceArray({ Name: 'A' }), false);
  });

  it('extracts repeatable section instances from document sections', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          name: 'Items',
          label: 'Items',
          repeatable: true,
          segments: [{ type: 'field', id: 'items_name' }],
        },
      },
    ];
    const instances = extractRepeatableSectionInstances(
      {
        Items: [{ Name: 'A' }, { Name: 'B' }],
      },
      blocks,
    );
    assert.deepEqual(instances.Items, [{ Name: 'A' }, { Name: 'B' }]);
  });

  it('builds instances from multi-row tables in the editor', () => {
    const tableId = 'anamnesis_acuity';
    const blocks = [
      {
        type: 'documentSection',
        data: {
          name: 'Anamnesis',
          label: 'Anamnesis',
          repeatable: true,
          segments: [
            { type: 'field', id: 'anamnesis_complaints' },
            { type: 'table', id: tableId, rows: [{ key: 'row1', label: '' }] },
          ],
          fieldValues: {
            anamnesis_complaints: 'Headache',
            [cellFieldId(tableId, 'row1', 'vis')]: '0.8',
            [cellFieldId(tableId, 'row2', 'vis')]: '0.9',
            [cellFieldId(tableId, 'row3', 'vis')]: '1.0',
          },
        },
      },
    ];
    const fieldSchemas = {
      anamnesis_complaints: { type: 'text', name: 'Complaints', label: 'Complaints' },
      [tableId]: {
        type: 'table',
        name: 'Acuity',
        label: 'Acuity',
        columns: [{ key: 'vis', label: 'vis' }],
        rows: [{ key: 'row1', label: '' }],
        cellType: 'text',
      },
    };
    const flat = {
      anamnesis_complaints: 'Headache',
      [cellFieldId(tableId, 'row1', 'vis')]: '0.8',
      [cellFieldId(tableId, 'row2', 'vis')]: '0.9',
      [cellFieldId(tableId, 'row3', 'vis')]: '1.0',
    };

    const instances = buildRepeatableInstancesFromEditor(blocks, fieldSchemas, flat);
    assert.equal(instances.Anamnesis.length, 3);
    assert.equal(instances.Anamnesis[0].Complaints, 'Headache');
    assert.deepEqual(instances.Anamnesis[0].Acuity, [{ vis: '0.8' }]);
    assert.deepEqual(instances.Anamnesis[2].Acuity, [{ vis: '1.0' }]);
  });

  it('builds instances from the vision table block after a repeatable section', () => {
    const tableId = 'visionTable';
    const blocks = [
      {
        type: 'documentSection',
        data: {
          name: 'Anamnesis',
          label: 'Anamnesis',
          repeatable: true,
          segments: [
            { type: 'field', id: 'complaints' },
          ],
          fieldValues: { complaints: ['Tearing'] },
        },
      },
      {
        type: 'visionTable',
        data: {
          cells: {
            [cellFieldId(tableId, 'od', 'vis')]: '0.8',
            [cellFieldId(tableId, 'os', 'vis')]: '0.9',
          },
        },
      },
    ];
    const fieldSchemas = {
      complaints: { type: 'tree', name: 'Complaints', label: 'Complaints' },
      [tableId]: {
        type: 'table',
        name: 'Visual acuity',
        label: 'Visual acuity',
        columns: [{ key: 'vis', label: 'vis' }],
        rows: [{ key: 'od', label: 'OD' }, { key: 'os', label: 'OS' }],
        cellType: 'choice',
      },
    };
    const flat = {
      complaints: ['Tearing'],
      [cellFieldId(tableId, 'od', 'vis')]: '0.8',
      [cellFieldId(tableId, 'os', 'vis')]: '0.9',
    };

    const plan = resolveRepeatablePagePlan(blocks, fieldSchemas, flat, null);
    assert.equal(plan, null);
  });

  it('returns a plan only for explicit document instance arrays', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          name: 'Items',
          label: 'Items',
          repeatable: true,
          segments: [{ type: 'field', id: 'items_name' }],
        },
      },
    ];
    const fieldSchemas = {
      items_name: { type: 'text', name: 'Name', label: 'Name' },
    };

    const plan = resolveRepeatablePagePlan(blocks, fieldSchemas, {}, {
      Items: [{ Name: 'A' }, { Name: 'B' }],
    });
    assert.ok(plan);
    assert.equal(plan.instances.length, 2);
    assert.deepEqual(plan.instances, [{ Name: 'A' }, { Name: 'B' }]);
  });

  it('finds a vision table block after other non-section blocks', () => {
    const blocks = [
      { type: 'documentSection', data: { name: 'Anamnesis', repeatable: true, segments: [] } },
      { type: 'templateBlock', data: { fieldType: 'text', fieldId: 'note', value: 'x' } },
      { type: 'visionTable', data: { fieldId: 'visionTable', cells: {} } },
    ];
    const adjacent = findAdjacentTableBlock(blocks, 0);
    assert.ok(adjacent);
    assert.equal(adjacent.tableId, 'visionTable');
    assert.equal(adjacent.index, 2);
    assert.equal(adjacent.blockKind, 'vision');
  });

  it('skips an empty vision table and finds the next section table', () => {
    const tableId = 'items_table';
    const blocks = [
      { type: 'documentSection', data: { name: 'Anamnesis', repeatable: true, segments: [] } },
      { type: 'visionTable', data: { fieldId: 'visionTable', cells: {} } },
      {
        type: 'documentSection',
        data: {
          name: 'items',
          label: 'Items',
          segments: [{ type: 'table', id: tableId, rows: [{ key: 'row1', label: '' }] }],
          fieldValues: {
            [cellFieldId(tableId, 'row1', 'col1')]: '111',
          },
        },
      },
    ];
    const fieldSchemas = {
      [tableId]: {
        type: 'table',
        name: 'Results',
        label: 'Results',
        columns: [{ key: 'col1', label: 'Column 1' }],
        rows: [{ key: 'row1', label: '' }],
        cellType: 'text',
      },
    };
    const flat = {
      ...blocks[2].data.fieldValues,
    };

    const adjacent = findAdjacentTableBlock(blocks, 0, {
      shouldUse: (candidate) => {
        if (candidate.blockKind === 'vision') return false;
        return true;
      },
    });

    assert.ok(adjacent);
    assert.equal(adjacent.tableId, tableId);
    assert.equal(adjacent.index, 2);
    assert.equal(adjacent.blockKind, 'section');
  });

  it('finds a table inside the next section block', () => {
    const tableId = 'untitled_table';
    const blocks = [
      {
        type: 'documentSection',
        data: { name: 'Anamnesis', repeatable: true, segments: [{ type: 'field', id: 'complaints' }] },
      },
      {
        type: 'documentSection',
        data: {
          name: 'Untitled',
          label: 'Untitled section',
          segments: [{ type: 'table', id: tableId, rows: [{ key: 'row1', label: '' }] }],
          fieldValues: {
            [cellFieldId(tableId, 'row1', 'col1')]: '1',
            [cellFieldId(tableId, 'row2', 'col1')]: '2',
            [cellFieldId(tableId, 'row3', 'col1')]: '3',
          },
        },
      },
      {
        type: 'documentSection',
        data: { name: 'Examination', segments: [{ type: 'text', content: 'Long exam text' }] },
      },
    ];
    const fieldSchemas = {
      complaints: { type: 'text', name: 'Complaints', label: 'Complaints' },
      [tableId]: {
        type: 'table',
        name: 'Results',
        label: 'Results',
        columns: [{ key: 'col1', label: 'Column 1' }],
        rows: [{ key: 'row1', label: '' }],
        cellType: 'text',
      },
    };
    const flat = {
      complaints: 'Tearing',
      ...blocks[1].data.fieldValues,
    };

    const plan = resolveRepeatablePagePlan(blocks, fieldSchemas, flat, null);
    assert.equal(plan, null);
  });

  it('does not build a page plan from inline table cell values alone', () => {
    const tableId = 'anamnesis_acuity';
    const blocks = [
      {
        type: 'documentSection',
        data: {
          name: 'Anamnesis',
          label: 'Anamnesis',
          repeatable: true,
          segments: [{ type: 'field', id: 'anamnesis_complaints' }],
          fieldValues: {
            anamnesis_complaints: 'Headache',
            [cellFieldId(tableId, 'row1', 'vis')]: '1',
            [cellFieldId(tableId, 'row2', 'vis')]: '2',
            [cellFieldId(tableId, 'row3', 'vis')]: '2',
          },
        },
      },
    ];
    const fieldSchemas = {
      anamnesis_complaints: { type: 'text', name: 'Complaints', label: 'Complaints' },
      [tableId]: {
        type: 'table',
        name: 'Acuity',
        label: 'Acuity',
        columns: [{ key: 'vis', label: 'vis' }],
        rows: [{ key: 'row1', label: '' }],
        cellType: 'text',
      },
    };
    const flat = blocks[0].data.fieldValues;

    const plan = resolveRepeatablePagePlan(blocks, fieldSchemas, flat, null);
    assert.equal(plan, null);
  });

  it('does not build a page plan from multi-row inline tables', () => {
    const tableId = 'items_table';
    const fieldValues = {
      [cellFieldId(tableId, 'row1', 'col1')]: '111',
      [cellFieldId(tableId, 'row1', 'col2')]: 'aaa',
      [cellFieldId(tableId, 'row2', 'col1')]: '222',
      [cellFieldId(tableId, 'row2', 'col2')]: 'bbb',
    };
    for (let index = 3; index <= 11; index += 1) {
      const rowKey = `row${index}`;
      fieldValues[cellFieldId(tableId, rowKey, 'col1')] = 'Column 1';
      fieldValues[cellFieldId(tableId, rowKey, 'col2')] = 'Column 2';
    }

    const blocks = [
      {
        type: 'documentSection',
        data: {
          name: 'items',
          label: 'items',
          repeatable: true,
          segments: [
            {
              type: 'table',
              id: tableId,
              rows: Array.from({ length: 11 }, (_, index) => ({
                key: `row${index + 1}`,
                label: '',
              })),
            },
          ],
          fieldValues,
        },
      },
    ];
    const fieldSchemas = {
      [tableId]: {
        type: 'table',
        name: 'Results',
        label: 'Results',
        columns: [
          { key: 'col1', label: 'Column 1' },
          { key: 'col2', label: 'Column 2' },
        ],
        cellType: 'text',
      },
    };

    const plan = resolveRepeatablePagePlan(blocks, fieldSchemas, fieldValues, null);
    assert.equal(plan, null);
  });
});
