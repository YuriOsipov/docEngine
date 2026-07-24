import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { parseHTML } from 'linkedom';
import {
  addTableRowsFromText,
  buildTableElement,
  buildPreviewTableElement,
  parseTableRowLabelsText,
  readTableRowsFromDom,
  syncTableRowsDataset,
} from './table-field.js';
import { SchemaRegistry } from '../registry/schema-registry.js';

before(() => {
  const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  globalThis.document = window.document;
  globalThis.Node = window.Node;
  globalThis.CSS = { escape: (value: any) => String(value).replace(/"/g, '\\"') } as any;
});

describe('table presentation options', () => {
  const tableId = 'exam_table';
  const fieldSchemas = {
    [tableId]: {
      type: 'table',
      label: 'Table',
      name: 'Table',
      columns: [
        { key: 'id', label: 'id' },
        { key: 'items', label: 'items' },
      ],
      rows: [{ key: 'row1', label: '' }],
      hideHeader: true,
      hideBorders: true,
    },
    [`${tableId}_row1_id`]: { type: 'text', label: 'id' },
    [`${tableId}_row1_items`]: { type: 'text', label: 'items' },
  };

  it('shows header and borders in design mode even when hide options are set', () => {
    const table = buildTableElement(tableId, {}, {
      designMode: true,
      fieldSchemas,
      tableRows: [{ key: 'row1', label: '' }],
    });
    assert.equal(table.classList.contains('vision-table--borderless'), false);
    assert.equal(table.classList.contains('vision-table--no-header'), false);
    const thead = table.querySelector('thead');
    assert.ok(thead);
    assert.equal(thead.classList.contains('vision-table__resize-head'), false);
    assert.match(thead.textContent ?? '', /id/);
    // Design mode header is always shown, so column resize stays available.
    assert.equal(table.querySelectorAll('.vision-table__col-resizer').length, 2);
    assert.ok(table.querySelector('tbody tr'));
  });

  it('omits thead and adds presentation classes in preview table render', () => {
    const table = buildPreviewTableElement(tableId, {
      [`${tableId}_row1_id`]: '1',
      [`${tableId}_row1_items`]: 'a',
    }, { fieldSchemas });
    assert.ok(table);
    assert.equal(table.classList.contains('vision-table--borderless'), true);
    assert.equal(table.classList.contains('vision-table--no-header'), true);
    assert.equal(table.querySelector('thead'), null);
  });

  it('styles empty design-mode cells like fill-mode highlights (no value color)', () => {
    const table = buildTableElement(tableId, {}, {
      designMode: true,
      fieldSchemas,
      tableRows: [{ key: 'row1', label: '' }],
      fieldValueStyle: { default: { color: '#ff0000', fontStyle: 'italic' } },
    });
    const emptyCell = table.querySelector('.field-token--cell.field-token--design.field-token--empty');
    assert.ok(emptyCell);
    // Highlight CSS owns color/weight; inline value color must not stick.
    assert.notEqual(emptyCell.style.color, '#ff0000');
    assert.ok(!emptyCell.style.color || emptyCell.style.color === '');
    assert.ok(!emptyCell.style.fontWeight || emptyCell.style.fontWeight === '');
  });
});

describe('addTableRowsFromText', () => {
  it('parses one label per non-empty line', () => {
    assert.deepEqual(parseTableRowLabelsText('OD\nOS\n\nOU\n'), ['OD', 'OS', 'OU']);
  });

  it('appends labeled rows from pasted text', () => {
    const tableId = 'va_table';
    const fieldSchemas = {
      [tableId]: {
        type: 'table',
        label: 'VA',
        name: 'VA',
        showRowLabels: true,
        columns: [
          { key: 'vis', label: 'VIS' },
          { key: 'sph', label: 'SPH' },
        ],
        rows: [
          { key: 'od', label: 'OD' },
          { key: 'os', label: 'OS' },
        ],
      },
      [`${tableId}_od_vis`]: { type: 'text', label: 'VIS' },
      [`${tableId}_od_sph`]: { type: 'text', label: 'SPH' },
      [`${tableId}_os_vis`]: { type: 'text', label: 'VIS' },
      [`${tableId}_os_sph`]: { type: 'text', label: 'SPH' },
    };
    const registry = new SchemaRegistry({ fieldSchemas });
    const wrapper = document.createElement('div');
    wrapper.className = 'document-table';
    wrapper.dataset.tableId = tableId;
    syncTableRowsDataset(wrapper, [
      { key: 'od', label: 'OD' },
      { key: 'os', label: 'OS' },
    ]);
    const table = buildTableElement(tableId, {}, {
      designMode: true,
      getRegistry: () => registry,
      tableRows: [
        { key: 'od', label: 'OD' },
        { key: 'os', label: 'OS' },
      ],
    });
    wrapper.appendChild(table);

    const added = addTableRowsFromText(wrapper, 'OU\nGlasses\n', {
      designMode: true,
      getRegistry: () => registry,
    });

    assert.deepEqual(added, [
      { key: 'ou', label: 'OU' },
      { key: 'glasses', label: 'Glasses' },
    ]);
    assert.deepEqual(readTableRowsFromDom(wrapper), [
      { key: 'od', label: 'OD' },
      { key: 'os', label: 'OS' },
      { key: 'ou', label: 'OU' },
      { key: 'glasses', label: 'Glasses' },
    ]);
    assert.equal(wrapper.querySelectorAll('.vision-table tbody tr').length, 4);
    assert.match(wrapper.textContent ?? '', /OU/);
    assert.match(wrapper.textContent ?? '', /Glasses/);
  });
});
