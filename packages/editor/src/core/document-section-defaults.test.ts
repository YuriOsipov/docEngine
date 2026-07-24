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
    assert.deepEqual(block.data.segments, []);
    assert.deepEqual(block.data.fieldValues, {});
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
});
