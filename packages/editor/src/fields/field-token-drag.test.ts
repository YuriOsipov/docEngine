import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { parseHTML } from 'linkedom';

let createFieldToken: any;
let wireDesignFieldToken: any;
let updateFieldToken: any;
let readTokenValue: any;

before(async () => {
  const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.Node = window.Node;
  globalThis.Range = window.Range;
  globalThis.CSS = {
    escape: (value: string) =>
      String(value).replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, (ch) => `\\${ch}`),
  } as any;

  const inline = await import('./inline-fields.js');
  createFieldToken = inline.createFieldToken;
  wireDesignFieldToken = inline.wireDesignFieldToken;
  updateFieldToken = inline.updateFieldToken;
  readTokenValue = inline.readTokenValue;
});

describe('design field token drag handle', () => {
  it('makes only the grip draggable, not the whole token', () => {
    const token = createFieldToken('f1', 'Hello', 'Label');
    wireDesignFieldToken(token, {});

    assert.equal(token.draggable, false);
    const handle = token.querySelector(':scope > .editor-drag-handle');
    assert.ok(handle);
    assert.equal(handle.draggable, true);
    assert.equal(handle.dataset.action, 'drag-field');
  });

  it('keeps the grip after updateFieldToken and does not pollute value text', () => {
    const token = createFieldToken('f1', 'Hello', 'Label');
    wireDesignFieldToken(token, {});
    const handleBefore = token.querySelector(':scope > .editor-drag-handle');

    updateFieldToken(token, 'World', 'Label');

    const handleAfter = token.querySelector(':scope > .editor-drag-handle');
    assert.equal(handleAfter, handleBefore);
    assert.equal(token.draggable, false);
    assert.equal(handleAfter.draggable, true);
    assert.equal(readTokenValue(token), 'World');
  });

  it('falls back to visible text when scalar dataset has replacement chars', () => {
    const token = createFieldToken('f2', 'Glassix +Plus Refill No 1: Ø1.2-Ø0.6', 'Label');
    token.dataset.value = 'Glassix +Plus Refill No 1: \uFFFD1.2-\uFFFD0.6';
    assert.equal(readTokenValue(token), 'Glassix +Plus Refill No 1: Ø1.2-Ø0.6');
  });

  it('falls back to visible text for common mojibake scalar patterns', () => {
    const token = createFieldToken('f3', 'Glassix +Plus Refill No 1: Ø1.2-Ø0.6', 'Label');
    token.dataset.value = 'Glassix +Plus Refill No 1: Ã˜1.2-Ã˜0.6';
    assert.equal(readTokenValue(token), 'Glassix +Plus Refill No 1: Ø1.2-Ø0.6');
  });
});
