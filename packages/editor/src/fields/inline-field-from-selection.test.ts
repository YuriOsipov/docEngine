import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { parseHTML } from 'linkedom';
import { SchemaRegistry } from '../registry/schema-registry.js';
import { attachRegistryToHolder } from '../registry/registry-context.js';

let insertInlineField: any;
let resolveSelectedTextForFieldConversion: any;
let createFieldToken: any;

before(async () => {
  const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.Node = window.Node;
  globalThis.Range = window.Range;
  globalThis.DocumentFragment = window.DocumentFragment;

  if (!window.getSelection) {
    const win = window as any;
    win._testSelection = null;
    window.getSelection = () => {
      if (!win._testSelection) {
        win._testSelection = {
          _ranges: [],
          get rangeCount() {
            return this._ranges.length;
          },
          get isCollapsed() {
            return !this._ranges.length || this._ranges[0].collapsed;
          },
          get anchorNode() {
            return this._ranges[0]?.startContainer ?? null;
          },
          toString() {
            return this._ranges[0]?.toString?.() ?? '';
          },
          removeAllRanges() {
            this._ranges = [];
          },
          addRange(range: any) {
            this._ranges = [range];
          },
          getRangeAt(index: any) {
            return this._ranges[index];
          },
        };
      }
      return win._testSelection;
    };
  }

  const inline = await import('./inline-fields.js');
  insertInlineField = inline.insertInlineField;
  resolveSelectedTextForFieldConversion = inline.resolveSelectedTextForFieldConversion;
  createFieldToken = inline.createFieldToken;
});

function buildEditor() {
  const holder = document.createElement('div');
  holder.dataset.docEditor = '1';
  document.body.appendChild(holder);

  const section = document.createElement('div');
  section.className = 'document-section';
  section.dataset.sectionName = 'Examination';
  holder.appendChild(section);

  const body = document.createElement('div');
  body.className = 'document-section__body';
  body.contentEditable = 'true';
  section.appendChild(body);

  const registry = new SchemaRegistry();
  attachRegistryToHolder(holder, registry);
  return { holder, body, registry };
}

function mockTextRange(editable: any, textNode: any, { collapsed = false } = {}) {
  const text = String(textNode.textContent ?? '');
  const range: any = {
    collapsed,
    startContainer: textNode,
    startOffset: collapsed ? text.length : 0,
    endContainer: textNode,
    endOffset: collapsed ? text.length : text.length,
    commonAncestorContainer: editable,
    toString() {
      return collapsed ? '' : text;
    },
    cloneContents() {
      const frag = document.createDocumentFragment();
      if (!collapsed) frag.appendChild(document.createTextNode(text));
      return frag;
    },
    cloneRange() {
      return mockTextRange(editable, textNode, { collapsed: range.collapsed });
    },
    intersectsNode(node: any) {
      if (!node) return false;
      return node === textNode || editable.contains(node);
    },
    deleteContents() {
      if (!range.collapsed && textNode.parentNode) {
        textNode.remove();
      }
      range.collapsed = true;
      range.startOffset = 0;
      range.endOffset = 0;
    },
    insertNode(node: any) {
      editable.appendChild(node);
    },
    setStartAfter() {},
    collapse() {
      range.collapsed = true;
    },
  };
  return range;
}

function setSelection(range: any) {
  const sel = window.getSelection();
  sel!.removeAllRanges();
  sel!.addRange(range);
}

describe('resolveSelectedTextForFieldConversion', () => {
  it('returns trimmed selected text', () => {
    const { body } = buildEditor();
    const text = document.createTextNode('  Patient Name  ');
    body.appendChild(text);
    const range = mockTextRange(body, text);
    range.toString = () => '  Patient Name  ';
    assert.equal(resolveSelectedTextForFieldConversion(body, range), 'Patient Name');
  });

  it('returns empty when selection intersects a field token', () => {
    const { body } = buildEditor();
    const before = document.createTextNode('before ');
    body.appendChild(before);
    const token = createFieldToken('examination_existing', '', 'Existing', {});
    body.appendChild(token);
    body.appendChild(document.createTextNode(' after'));

    const range = {
      collapsed: false,
      commonAncestorContainer: body,
      toString: () => 'before Existing after',
      cloneContents() {
        const frag = document.createDocumentFragment();
        frag.appendChild(document.createTextNode('before Existing after'));
        return frag;
      },
      intersectsNode(node: any) {
        return node === token || body.contains(node);
      },
    };

    assert.equal(resolveSelectedTextForFieldConversion(body, range), '');
  });
});

describe('insertInlineField from selection', () => {
  it('uses selected text for field name and label and replaces the selection', async () => {
    const { body, registry } = buildEditor();
    const text = document.createTextNode('Patient Name');
    body.appendChild(text);
    const savedRange = mockTextRange(body, text);
    setSelection(savedRange);

    const { fieldId, schema, token } = await insertInlineField(body, 'text', {
      openEditor: false,
      preferredLabel: 'Patient Name',
      savedRange,
    });

    assert.equal(schema.label, 'Patient Name');
    assert.equal(schema.name, 'Patient Name');
    assert.equal(registry.getFieldSchemas()[fieldId].label, 'Patient Name');
    assert.equal(registry.getFieldSchemas()[fieldId].name, 'Patient Name');
    assert.ok(token.classList.contains('field-token'));
    assert.equal(body.contains(text), false);
    assert.ok(body.contains(token));
  });

  it('falls back to the type default label when caret is collapsed', async () => {
    const { body, registry } = buildEditor();
    const text = document.createTextNode('Keep me');
    body.appendChild(text);
    setSelection(mockTextRange(body, text, { collapsed: true }));

    const { schema, token } = await insertInlineField(body, 'text', { openEditor: false });

    assert.equal(schema.label, 'Text');
    assert.equal(schema.name, 'Text');
    const schemas = registry.getFieldSchemas();
    assert.equal(schemas[Object.keys(schemas)[0]].label, 'Text');
    assert.ok(body.contains(text));
    assert.ok(body.contains(token));
  });
});
