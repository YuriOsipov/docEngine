import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { parseHTML } from 'linkedom';
import { wireColumnsResize } from './wire-columns-resize.js';

before(() => {
  const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  globalThis.document = window.document;
  globalThis.Node = window.Node;
  globalThis.window = window;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.CSS = { escape: (value: any) => String(value).replace(/"/g, '\\"') } as any;
});

function createColumnsDom() {
  const { document } = parseHTML(`
    <div class="document-columns">
      <div class="document-columns__grid document-columns__grid--design">
        <div class="document-columns__col" data-column="0"></div>
        <span class="document-columns__col-resizer" data-col-index="0"></span>
        <div class="document-columns__col" data-column="1"></div>
      </div>
    </div>
  `);
  return {
    columnsEl: document.querySelector('.document-columns'),
    handle: document.querySelector('.document-columns__col-resizer'),
  };
}

describe('wire-columns-resize', () => {
  it('wires a columns block once and exposes a resize handle', () => {
    const { columnsEl, handle } = createColumnsDom();
    wireColumnsResize(columnsEl);
    assert.equal(columnsEl.dataset.columnsResizeWired, 'true');
    assert.ok(handle);
    wireColumnsResize(columnsEl);
    assert.equal(columnsEl.dataset.columnsResizeWired, 'true');
  });
});
