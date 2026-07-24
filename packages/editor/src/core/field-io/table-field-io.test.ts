// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assignRowKeysForImport,
  collectTableInstancesInBlocks,
  collapseTablesInValues,
  expandTableArraysInValues,
  filterTableRowsWithContent,
  flatValuesToTableRows,
  isTableRowArray,
  tableRowsToFlatValues,
} from './table-field-io.js';
import { cellFieldId } from '../field-schemas.js';

const tableId = 'test';
const tableSchema = {
  type: 'table',
  name: 'Test table',
  label: 'Test table',
  columns: [
    { key: 'first', label: 'First' },
    { key: 'second', label: 'Second' },
  ],
  cellType: 'text',
};

const fixedRowSchema = {
  ...tableSchema,
  rows: [
    { key: 'od', label: 'OD' },
    { key: 'os', label: 'OS' },
  ],
};

describe('isTableRowArray', () => {
  it('accepts array of row objects', () => {
    assert.equal(isTableRowArray([{ first: '1' }]), true);
    assert.equal(isTableRowArray([]), true);
  });

  it('rejects string arrays and scalars', () => {
    assert.equal(isTableRowArray(['a', 'b']), false);
    assert.equal(isTableRowArray('text'), false);
  });
});

describe('assignRowKeysForImport', () => {
  it('uses schema row keys when available', () => {
    assert.deepEqual(assignRowKeysForImport(fixedRowSchema, 2), ['od', 'os']);
  });

  it('generates row keys for dynamic tables', () => {
    assert.deepEqual(assignRowKeysForImport(tableSchema, 2), ['row1', 'row2']);
  });
});

describe('tableRowsToFlatValues', () => {
  it('maps row array to flat cell keys', () => {
    const flat = tableRowsToFlatValues(
      tableId,
      [{ first: '123', second: '1234' }],
      tableSchema,
    );
    assert.equal(flat[cellFieldId(tableId, 'row1', 'first')], '123');
    assert.equal(flat[cellFieldId(tableId, 'row1', 'second')], '1234');
  });

  it('maps multiple rows', () => {
    const flat = tableRowsToFlatValues(
      tableId,
      [
        { first: '1', second: '2' },
        { first: '3', second: '4' },
      ],
      tableSchema,
    );
    assert.equal(flat[cellFieldId(tableId, 'row1', 'first')], '1');
    assert.equal(flat[cellFieldId(tableId, 'row2', 'second')], '4');
  });
});

describe('flatValuesToTableRows', () => {
  it('maps flat cell keys to row array', () => {
    const flat = {
      [cellFieldId(tableId, 'row1', 'first')]: '123',
      [cellFieldId(tableId, 'row1', 'second')]: '1234',
    };
    const rows = flatValuesToTableRows(tableId, flat, tableSchema, [{ key: 'row1', label: '' }]);
    assert.deepEqual(rows, [{ first: '123', second: '1234' }]);
  });

  it('omits empty cells', () => {
    const flat = {
      [cellFieldId(tableId, 'row1', 'first')]: '123',
      [cellFieldId(tableId, 'row1', 'second')]: '',
    };
    const rows = flatValuesToTableRows(tableId, flat, tableSchema, [{ key: 'row1', label: '' }]);
    assert.deepEqual(rows, [{ first: '123' }]);
  });
});

describe('expandTableArraysInValues', () => {
  it('expands table array to flat keys', () => {
    const fieldSchemas = { [tableId]: tableSchema };
    const expanded = expandTableArraysInValues(
      { [tableId]: [{ first: '123', second: '1234' }] },
      fieldSchemas,
    );
    assert.equal(expanded[tableId], undefined);
    assert.equal(expanded[cellFieldId(tableId, 'row1', 'first')], '123');
    assert.equal(expanded[cellFieldId(tableId, 'row1', 'second')], '1234');
  });

  it('prefers array over existing flat keys for the same table', () => {
    const fieldSchemas = { [tableId]: tableSchema };
    const expanded = expandTableArraysInValues(
      {
        [tableId]: [{ first: 'new' }],
        [cellFieldId(tableId, 'row1', 'first')]: 'old',
      },
      fieldSchemas,
    );
    assert.equal(expanded[cellFieldId(tableId, 'row1', 'first')], 'new');
  });

  it('maps fixed schema rows by index', () => {
    const fieldSchemas = { [tableId]: fixedRowSchema };
    const expanded = expandTableArraysInValues(
      { [tableId]: [{ first: '20/20' }, { first: '20/25' }] },
      fieldSchemas,
    );
    assert.equal(expanded[cellFieldId(tableId, 'od', 'first')], '20/20');
    assert.equal(expanded[cellFieldId(tableId, 'os', 'first')], '20/25');
  });
});

describe('collapseTablesInValues', () => {
  it('collapses flat cell keys into table array', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          segments: [{ type: 'table', id: tableId, rows: [{ key: 'row1', label: '' }] }],
          fieldValues: {},
        },
      },
    ];
    const fieldSchemas = { [tableId]: tableSchema };
    const collapsed = collapseTablesInValues(
      {
        [cellFieldId(tableId, 'row1', 'first')]: '123',
        [cellFieldId(tableId, 'row1', 'second')]: '1234',
        otherField: 'plain',
      },
      fieldSchemas,
      blocks,
    );
    assert.deepEqual(collapsed[tableId], [{ first: '123', second: '1234' }]);
    assert.equal(collapsed[cellFieldId(tableId, 'row1', 'first')], undefined);
    assert.equal(collapsed.otherField, 'plain');
  });
});

describe('round-trip', () => {
  it('preserves table data through expand and collapse', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          segments: [
            {
              type: 'table',
              id: tableId,
              rows: [
                { key: 'row1', label: '' },
                { key: 'row2', label: '' },
              ],
            },
          ],
          fieldValues: {},
        },
      },
    ];
    const fieldSchemas = { [tableId]: tableSchema };
    const flat = {
      [cellFieldId(tableId, 'row1', 'first')]: 'a',
      [cellFieldId(tableId, 'row1', 'second')]: 'b',
      [cellFieldId(tableId, 'row2', 'first')]: 'c',
      [cellFieldId(tableId, 'row2', 'second')]: 'd',
    };

    const collapsed = collapseTablesInValues(flat, fieldSchemas, blocks);
    const expanded = expandTableArraysInValues(collapsed, fieldSchemas);

    assert.equal(expanded[cellFieldId(tableId, 'row1', 'first')], 'a');
    assert.equal(expanded[cellFieldId(tableId, 'row2', 'second')], 'd');
  });
});

describe('filterTableRowsWithContent', () => {
  it('ignores rows that only contain column-label placeholder values', () => {
    const rows = [
      { col1: '111', col2: 'aaa' },
      { col1: '222', col2: 'bbb' },
      { col1: 'Column 1', col2: 'Column 2' },
      { col1: '', col2: '' },
    ];
    const filtered = filterTableRowsWithContent(rows, {
      type: 'table',
      columns: [
        { key: 'col1', label: 'Column 1' },
        { key: 'col2', label: 'Column 2' },
      ],
    });
    assert.equal(filtered.length, 2);
    assert.deepEqual(filtered[0], { col1: '111', col2: 'aaa' });
  });
});

describe('collectTableInstancesInBlocks', () => {
  it('finds inline table segments', () => {
    const blocks = [
      {
        type: 'documentSection',
        data: {
          segments: [{ type: 'table', id: tableId, rows: [{ key: 'row1', label: '' }] }],
        },
      },
    ];
    const instances = collectTableInstancesInBlocks(blocks, { [tableId]: tableSchema });
    assert.equal(instances.length, 1);
    assert.equal(instances[0].tableId, tableId);
  });

  it('finds vision table blocks without an explicit fieldId', () => {
    const blocks = [{ type: 'visionTable', data: { cells: {} } }];
    const instances = collectTableInstancesInBlocks(blocks, { visionTable: tableSchema });
    assert.equal(instances.length, 1);
    assert.equal(instances[0].tableId, 'visionTable');
  });
});
