import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import {
  countTreeNodes,
  exportListItemsText,
  exportTreeNodesText,
  normalizeListItems,
  normalizeTreeNodes,
  parseListItemsText,
  parseTreeNodesText,
  createListItemsEditor,
  createTreeNodesEditor,
} from './schema-items-designer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mammologyTemplate = JSON.parse(
  readFileSync(join(__dirname, '../../../../examples/mammology-document-template.json'), 'utf8'),
);

function installDom() {
  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  globalThis.document = document;
  globalThis.window = { document } as any;
  globalThis.HTMLElement = document.defaultView.HTMLElement;
  globalThis.Event = document.defaultView.Event;
  return document;
}

describe('schema-items-designer text import/export', () => {
  it('normalizes list items with internal ids only', () => {
    const items = normalizeListItems([
      { label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { label: '  ' },
    ]);
    assert.deepEqual(items, [
      { id: 'item_1', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ]);
  });

  it('round-trips list options as plain text', () => {
    const items = normalizeListItems([{ label: 'Alpha' }, { label: 'Beta' }]);
    const text = exportListItemsText(items);
    assert.equal(text, 'Alpha\nBeta\n');
    assert.deepEqual(parseListItemsText(text), items);
  });

  it('normalizes tree nodes without ids', () => {
    const tree = normalizeTreeNodes([
      { id: 'ignored', label: 'Root', children: [{ id: 'x', label: 'Child' }] },
    ]);
    assert.deepEqual(tree, [{ label: 'Root', children: [{ label: 'Child' }] }]);
    assert.equal('id' in tree[0], false);
  });

  it('round-trips tree nodes as tab-indented plain text', () => {
    const tree = normalizeTreeNodes([
      { label: 'Патологія не виявлена' },
      {
        label: 'Утворення',
        children: [
          { label: 'права грудна залоза', children: [{ label: 'внутрішні квадранти' }] },
          { label: 'ліва грудна залоза' },
        ],
      },
    ]);
    const text = exportTreeNodesText(tree);
    assert.match(text, /^Патологія не виявлена\n/);
    assert.match(text, /^Утворення\n/m);
    assert.match(text, /^\tправа грудна залоза\n/m);
    assert.match(text, /^\t\tвнутрішні квадранти\n/m);
    assert.doesNotMatch(text, /"id"/);
    assert.deepEqual(parseTreeNodesText(text), tree);
    assert.equal(countTreeNodes(tree), 5);
  });

  it('rejects invalid tree depth jumps', () => {
    assert.throws(
      () => parseTreeNodesText('Root\n\t\tToo deep\n'),
      /Invalid indentation at line 2/,
    );
  });

  it('imports mammology focalPalpation tree snippet from text', () => {
    const schemaTree = mammologyTemplate.fieldSchemas.focalPalpation.tree;
    const text = exportTreeNodesText(schemaTree);
    const imported = parseTreeNodesText(text);
    assert.deepEqual(imported, normalizeTreeNodes(schemaTree));
  });
});

describe('schema-items-designer editors', () => {
  it('collects list items from the editor DOM', () => {
    installDom();
    const host = document.createElement('div');
    document.body.appendChild(host);

    const editor = createListItemsEditor(host, [{ label: 'One' }, { label: 'Two' }]);
    assert.deepEqual(editor.getItems(), [
      { id: 'item_1', label: 'One' },
      { id: 'item_2', label: 'Two' },
    ]);

    editor.setItems([{ label: 'Updated' }]);
    assert.deepEqual(editor.getItems(), [{ id: 'item_1', label: 'Updated' }]);
  });

  it('preserves row order after DOM reorder', () => {
    installDom();
    const host = document.createElement('div');
    document.body.appendChild(host);

    const editor = createListItemsEditor(host, [
      { label: 'First' },
      { label: 'Second' },
      { label: 'Third' },
    ]);
    const rows = host.querySelectorAll('.schema-items__row');
    assert.equal(rows.length, 3);
    rows[2].parentElement.insertBefore(rows[2], rows[0]);

    assert.deepEqual(
      editor.getItems().map((item: any) => item.label),
      ['Third', 'First', 'Second'],
    );
  });

  it('collects tree nodes from the editor DOM without ids', () => {
    installDom();
    const host = document.createElement('div');
    document.body.appendChild(host);

    const editor = createTreeNodesEditor(host, [
      { label: 'Root', children: [{ label: 'Leaf' }] },
    ]);
    const tree = editor.getTree();
    assert.equal(tree.length, 1);
    assert.equal(tree[0].label, 'Root');
    assert.equal(tree[0].children?.[0]?.label, 'Leaf');
    assert.equal('id' in tree[0], false);
    assert.equal('id' in tree[0].children[0], false);
  });
});
