import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createEmptyDocumentSectionBlock,
  countDocumentSections,
  ensureAtLeastOneDocumentSection,
} from './document-section-defaults.js';

describe('document-section-defaults', () => {
  it('creates an empty document section block', () => {
    const block = createEmptyDocumentSectionBlock();
    assert.equal(block.type, 'documentSection');
    assert.equal(block.data.name, 'Untitled');
    assert.deepEqual(block.data.segments, []);
    assert.deepEqual(block.data.fieldValues, {});
  });

  it('allocates unique names when usedNames is provided', () => {
    const used = new Set(['Untitled']);
    const block = createEmptyDocumentSectionBlock(used);
    assert.equal(block.data.name, 'Untitled_2');
  });

  it('leaves existing sections unchanged', () => {
    const blocks = [
      { type: 'documentSection', data: { name: 'A', segments: [], fieldValues: {} } },
      { type: 'templateBlock', data: {} },
    ];
    const next = ensureAtLeastOneDocumentSection(blocks);
    assert.equal(countDocumentSections(next), 1);
    assert.equal(next[0].data.name, 'A');
    assert.equal(next.length, 2);
  });

  it('inserts a section when blocks are empty', () => {
    const next = ensureAtLeastOneDocumentSection([]);
    assert.equal(countDocumentSections(next), 1);
    assert.equal(next[0].type, 'documentSection');
  });

  it('inserts a section when only non-section blocks exist', () => {
    const next = ensureAtLeastOneDocumentSection([{ type: 'templateBlock', data: {} }]);
    assert.equal(countDocumentSections(next), 1);
    assert.equal(next[0].type, 'documentSection');
    assert.equal(next[1].type, 'templateBlock');
  });

  it('dedupes duplicate Untitled section names', () => {
    const next = ensureAtLeastOneDocumentSection([
      { type: 'documentSection', data: { name: '', label: '', segments: [], fieldValues: {} } },
      { type: 'documentSection', data: { name: '', label: '', segments: [], fieldValues: {} } },
    ]);
    assert.equal(next[0].data.name, 'Untitled');
    assert.equal(next[1].data.name, 'Untitled_2');
  });
});
