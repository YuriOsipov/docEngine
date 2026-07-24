import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { parseHTML } from 'linkedom';
import {
  applyPercentWidthsToColumns,
  clampColumnWidthPx,
  redistributeAdjacentWidths,
  widthsPxToPercents,
  wireTableColumnResize,
} from './wire-table-column-resize.js';
import { buildTableElement } from './table-field.js';

before(() => {
  const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  globalThis.document = window.document;
  globalThis.Node = window.Node;
  globalThis.window = window;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.CSS = { escape: (value: any) => String(value).replace(/"/g, '\\"') } as any;
});

describe('wire-table-column-resize helpers', () => {
  it('clamps column widths to the minimum', () => {
    assert.equal(clampColumnWidthPx(12), 40);
    assert.equal(clampColumnWidthPx(120.6), 121);
  });

  it('maps measured pixel widths onto percent column defs of the table width', () => {
    // Data columns are 234+234 with a 32px actions column → table 500.
    const next = applyPercentWidthsToColumns(
      [
        { key: 'a', label: 'A', width: 'auto' },
        { key: 'b', label: 'B' },
      ],
      [234, 234],
      500,
    );
    assert.equal(next[0].width, '46.8%');
    assert.equal(next[1].width, '46.8%');
    assert.deepEqual(widthsPxToPercents([140, 120], 400), [35, 30]);
  });

  it('keeps adjacent pair total constant when redistributing', () => {
    assert.deepEqual(redistributeAdjacentWidths([100, 100], 0, 40), [140, 60]);
    assert.deepEqual(redistributeAdjacentWidths([100, 100], 0, -40), [60, 140]);
    assert.deepEqual(redistributeAdjacentWidths([100, 100], 1, 40), [60, 140]);
  });
});

describe('table column resize handles', () => {
  const tableId = 'resize_table';
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
    },
    [`${tableId}_row1_id`]: { type: 'text', label: 'id' },
    [`${tableId}_row1_items`]: { type: 'text', label: 'items' },
  };

  it('adds resizer handles in design mode', () => {
    const table = buildTableElement(tableId, {}, {
      designMode: true,
      fieldSchemas,
      tableRows: [{ key: 'row1', label: '' }],
    });
    const handles = table.querySelectorAll('.vision-table__col-resizer');
    assert.equal(handles.length, 2);
    assert.equal((handles[0] as HTMLElement).dataset.colIndex, '0');
    assert.equal((handles[1] as HTMLElement).dataset.colIndex, '1');
    assert.equal(table.dataset.colResizeWired, 'true');
  });

  it('offers resize handles when the header is hidden for preview', () => {
    const schemas = {
      ...fieldSchemas,
      [tableId]: { ...fieldSchemas[tableId], hideHeader: true },
    };
    const table = buildTableElement(tableId, {}, {
      designMode: true,
      fieldSchemas: schemas,
      tableRows: [{ key: 'row1', label: '' }],
    });
    assert.ok(table.querySelector('thead'));
    assert.match(table.querySelector('thead')?.textContent ?? '', /id/);
    assert.equal(table.querySelectorAll('.vision-table__col-resizer').length, 2);
    assert.equal(table.dataset.colResizeWired, 'true');
  });

  it('persists dragged widths as percents of the table width', () => {
    /** @type {Record<string, any>} */
    let schemas = structuredClone(fieldSchemas);
    const registry = {
      getFieldSchemas: () => schemas,
      updateFieldSchema(id: any, schema: any) {
        schemas = { ...schemas, [id]: schema };
      },
    };

    const table = document.createElement('table');
    table.className = 'vision-table';
    table.getBoundingClientRect = () => ({
      width: 400,
      height: 40,
      top: 0,
      left: 0,
      right: 400,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON() {},
    });
    const colgroup = document.createElement('colgroup');
    const col0 = document.createElement('col');
    const col1 = document.createElement('col');
    colgroup.appendChild(col0);
    colgroup.appendChild(col1);
    table.appendChild(colgroup);

    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    const th0 = document.createElement('th');
    th0.innerHTML = '<span class="vision-table__col-resizer" data-col-index="0"></span>';
    const th1 = document.createElement('th');
    th1.innerHTML = '<span class="vision-table__col-resizer" data-col-index="1"></span>';
    tr.appendChild(th0);
    tr.appendChild(th1);
    thead.appendChild(tr);
    table.appendChild(thead);
    document.body.appendChild(table);

    [col0, col1].forEach((col: any, index: any) => {
      col.getBoundingClientRect = () => ({
        width: 100 + index * 20,
        height: 20,
        top: 0,
        left: 0,
        right: 100,
        bottom: 20,
        x: 0,
        y: 0,
        toJSON() {},
      });
    });

    let committed: any = null;
    wireTableColumnResize(table, {
      tableId,
      getRegistry: () => registry,
      onTableColumnWidthsChange: (id: any, columns: any) => {
        committed = { id, columns };
      },
    });

    const handle = table.querySelector('.vision-table__col-resizer[data-col-index="0"]');
    assert.ok(handle);

    function fire(target: any, type: any, clientX: any) {
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'button', { value: 0 });
      Object.defineProperty(event, 'clientX', { value: clientX });
      target.dispatchEvent(event);
    }

    fire(handle, 'mousedown', 50);
    fire(document, 'mousemove', 90);
    fire(document, 'mouseup', 90);

    // Start 100+120; drag +40 → 140+80 on a 400px table → 35% + 20%.
    assert.equal((schemas[tableId].columns[0] as any).width, '35%');
    assert.equal((schemas[tableId].columns[1] as any).width, '20%');
    assert.equal(committed?.id, tableId);
    assert.equal(committed?.columns[0].width, '35%');
    assert.equal(col0.style.width, '35%');
    assert.equal(col1.style.width, '20%');
    table.remove();
  });
});
