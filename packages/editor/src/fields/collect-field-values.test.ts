import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { parseHTML } from 'linkedom';

let createFieldToken: any;
let updateFieldToken: any;
let collectAllFieldValuesFromHolder: any;

before(async () => {
  const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.Node = window.Node;
  globalThis.CSS = {
    escape: (value: string) =>
      String(value).replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, (ch) => `\\${ch}`),
  } as any;

  const inline = await import('./inline-fields.js');
  createFieldToken = inline.createFieldToken;
  updateFieldToken = inline.updateFieldToken;
  collectAllFieldValuesFromHolder = inline.collectAllFieldValuesFromHolder;
});

describe('collectAllFieldValuesFromHolder', () => {
  it('prefers non-empty live DOM over stale stored fieldValues', () => {
    const holder = document.createElement('div');
    const section = document.createElement('div');
    section.className = 'document-section__body';
    const token = createFieldToken('products_line_items_r1_quantity', '5', 'Quantity');
    section.appendChild(token);
    holder.appendChild(section);

    const values = collectAllFieldValuesFromHolder(holder, {
      products_line_items_r1_quantity: '2',
    });

    assert.equal(values.products_line_items_r1_quantity, '5');
  });

  it('keeps stored value when DOM token is empty', () => {
    const holder = document.createElement('div');
    const section = document.createElement('div');
    section.className = 'document-section__body';
    const token = createFieldToken('header_order_number', '', 'Order #');
    section.appendChild(token);
    holder.appendChild(section);

    const values = collectAllFieldValuesFromHolder(holder, {
      header_order_number: 'ORD-100',
    });

    assert.equal(values.header_order_number, 'ORD-100');
  });

  it('reads updated table cell tokens after edit', () => {
    const holder = document.createElement('div');
    const section = document.createElement('div');
    section.className = 'document-section__body';
    const token = createFieldToken(
      'products_line_items_r1_product',
      'Old product',
      'Product',
    );
    token.classList.add('field-token--cell');
    section.appendChild(token);
    holder.appendChild(section);

    updateFieldToken(token, 'Glassix +Plus Refill No 1: Ø1.2-Ø0.6', 'Product');

    const values = collectAllFieldValuesFromHolder(holder, {
      products_line_items_r1_product: 'Old product',
    });

    assert.equal(values.products_line_items_r1_product, 'Glassix +Plus Refill No 1: Ø1.2-Ø0.6');
  });

  it('keeps a just-saved value when the live token is still stale', () => {
    const holder = document.createElement('div');
    const section = document.createElement('div');
    section.className = 'document-section__body';
    const token = createFieldToken('products_line_items_r3_quantity', '1', 'Quantity');
    token.classList.add('field-token--cell');
    section.appendChild(token);
    holder.appendChild(section);

    const values = collectAllFieldValuesFromHolder(
      holder,
      { products_line_items_r3_quantity: '2' },
      { changedFieldId: 'products_line_items_r3_quantity' },
    );

    assert.equal(values.products_line_items_r3_quantity, '2');
  });
});
