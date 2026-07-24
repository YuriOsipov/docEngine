// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseHTML } from 'linkedom';
import {
  insertIntoTextarea,
  renderFormulaFieldPicker,
  wrapSelectionWithFunction,
} from './formula-field-picker.js';

function setupDom() {
  const { window, document } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.window = window;
  globalThis.document = document;
  globalThis.Event = window.Event;
  return { window, document };
}

function dispatchActivate(el) {
  const event = new Event('mousedown', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'button', { value: 0 });
  el.dispatchEvent(event);
}

/** linkedom textareas do not track selection; mirror the mapping-result-helper pattern. */
function createFormulaTextarea(document, initial = '') {
  const el = document.createElement('textarea');
  el.setAttribute('data-field', 'formula');
  let value = initial;
  let selectionStart = initial.length;
  let selectionEnd = initial.length;
  Object.defineProperties(el, {
    value: {
      get() {
        return value;
      },
      set(next) {
        value = String(next ?? '');
      },
    },
    selectionStart: {
      get() {
        return selectionStart;
      },
      set(next) {
        selectionStart = Number(next) || 0;
      },
    },
    selectionEnd: {
      get() {
        return selectionEnd;
      },
      set(next) {
        selectionEnd = Number(next) || 0;
      },
    },
    focus: { value() {} },
  });
  return el;
}

describe('formula-field-picker', () => {
  it('inserts field refs on mousedown without requiring a click', () => {
    const { document } = setupDom();
    const host = document.createElement('div');
    const textarea = createFormulaTextarea(document, 'sum()');
    textarea.selectionStart = 4;
    textarea.selectionEnd = 4;
    document.body.append(textarea, host);

    renderFormulaFieldPicker(host, {
      blocks: [
        {
          type: 'documentSection',
          data: {
            name: 'Products',
            label: 'Products',
            segments: [{ type: 'field', id: 'products_line_items' }],
          },
        },
      ],
      fieldSchemas: {
        products_line_items: {
          type: 'table',
          name: 'Line Items',
          label: 'Line Items',
          columns: [{ key: 'total', name: 'Total', label: 'Total' }],
        },
      },
      getFormulaTextarea: () => textarea,
    });

    const leaf = host.querySelector('.formula-field-picker__leaf');
    assert.ok(leaf);
    dispatchActivate(leaf);

    assert.equal(textarea.value, 'sum({Products.Line Items.Total})');
  });

  it('wraps selection from mousedown on aggregate buttons', () => {
    const { document } = setupDom();
    const host = document.createElement('div');
    const textarea = createFormulaTextarea(document, '{Products.Line Items.Total}');
    textarea.selectionStart = 0;
    textarea.selectionEnd = textarea.value.length;
    document.body.append(textarea, host);

    renderFormulaFieldPicker(host, {
      blocks: [],
      fieldSchemas: {},
      getFormulaTextarea: () => textarea,
    });

    const sumBtn = [...host.querySelectorAll('.formula-field-picker__fn')].find(
      (el) => el.textContent === 'sum',
    );
    assert.ok(sumBtn);
    dispatchActivate(sumBtn);

    assert.equal(textarea.value, 'sum({Products.Line Items.Total})');
  });

  it('insertIntoTextarea and wrapSelectionWithFunction helpers stay consistent', () => {
    setupDom();
    const textarea = {
      value: '',
      selectionStart: 0,
      selectionEnd: 0,
      focus() {},
      dispatchEvent() {},
    };
    insertIntoTextarea(textarea, 'sum()');
    assert.equal(textarea.value, 'sum()');
    textarea.selectionStart = 4;
    textarea.selectionEnd = 4;
    wrapSelectionWithFunction(textarea, 'avg');
    assert.equal(textarea.value, 'sum(avg())');
  });
});
