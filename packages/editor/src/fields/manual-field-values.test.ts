import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectTreeLeafPaths,
  formatListItemLabel,
  formatManualEditText,
  mergePartitioned,
  parseCustomEntriesText,
  parseManualEditText,
  partitionChoiceValue,
  partitionListValue,
  partitionTreeValue,
  splitManualEditLines,
  syncCatalogWithTextareaEntries,
  syncManualEditTextareaOrder,
} from './manual-field-values.js';

const sampleTree = [
  {
    label: 'Parent',
    children: [
      { label: 'Child A' },
      { label: 'Child B' },
    ],
  },
  { label: 'Leaf root' },
];

describe('manual-field-values', () => {
  it('collectTreeLeafPaths returns space-joined leaf paths', () => {
    assert.deepEqual(collectTreeLeafPaths(sampleTree), [
      'Parent Child A',
      'Parent Child B',
      'Leaf root',
    ]);
  });

  it('partitionTreeValue splits known and custom paths', () => {
    const value = ['Parent Child A', 'Custom note', 'Leaf root'];
    assert.deepEqual(partitionTreeValue(value, sampleTree), {
      known: ['Parent Child A', 'Leaf root'],
      custom: ['Custom note'],
    });
  });

  it('partitionListValue splits known and custom labels', () => {
    const items = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta', code: 'B1' },
    ];
    assert.deepEqual(
      partitionListValue(['Alpha', 'Other'], items, false),
      { known: ['Alpha'], custom: ['Other'] },
    );
    assert.deepEqual(
      partitionListValue(['B1 — Beta'], items, true),
      { known: ['B1 — Beta'], custom: [] },
    );
  });

  it('partitionChoiceValue detects catalog and custom values', () => {
    const items = [{ id: 'a', label: 'Alpha' }];
    assert.deepEqual(partitionChoiceValue('Alpha', items), { known: 'Alpha', custom: '' });
    assert.deepEqual(partitionChoiceValue('Free text', items), { known: '', custom: 'Free text' });
  });

  it('mergePartitioned dedupes while preserving order', () => {
    assert.deepEqual(
      mergePartitioned(['A', 'B'], ['B', 'C']),
      ['A', 'B', 'C'],
    );
    assert.equal(mergePartitioned('', 'Custom'), 'Custom');
    assert.equal(mergePartitioned('Alpha', ''), 'Alpha');
  });

  it('formatManualEditText and parseManualEditText round-trip list/tree values', () => {
    const original = ['One', 'Two'];
    const text = formatManualEditText(original, 'list');
    assert.equal(text, 'One; Two');
    assert.deepEqual(parseManualEditText(text, 'list'), original);
    assert.equal(parseManualEditText('  solo  ', 'choice'), 'solo');
  });

  it('formatManualEditText accepts legacy semicolon-separated strings', () => {
    assert.equal(formatManualEditText('One; Two', 'tree'), 'One; Two');
    assert.equal(formatManualEditText('solo', 'list'), 'solo');
  });

  it('parseCustomEntriesText splits semicolon-separated entries', () => {
    assert.deepEqual(parseCustomEntriesText('A; B ; '), ['A', 'B']);
  });

  it('formatListItemLabel mirrors list modal formatting', () => {
    assert.equal(formatListItemLabel({ label: 'Beta', code: 'B1' }, true), 'B1 — Beta');
    assert.equal(formatListItemLabel({ label: 'Beta', code: 'B1' }, false), 'Beta');
  });

  it('syncCatalogWithTextareaEntries preserves custom lines outside catalog', () => {
    const catalogSet = new Set(['Parent Child A', 'Parent Child B', 'Leaf root']);
    assert.deepEqual(
      syncCatalogWithTextareaEntries(
        ['Parent Child A'],
        ['Parent Child A', 'Custom note', 'Leaf root'],
        catalogSet,
      ),
      ['Parent Child A', 'Custom note'],
    );
  });

  it('splitManualEditLines separates catalog paths from free text', () => {
    const catalogSet = new Set(['Parent Child A', 'Parent Child B', 'Leaf root']);
    assert.deepEqual(
      splitManualEditLines('Parent Child A; Custom note; Leaf root', catalogSet, 'tree'),
      {
        catalog: ['Parent Child A', 'Leaf root'],
        freeText: ['Custom note'],
      },
    );
    assert.deepEqual(
      splitManualEditLines('Alpha', new Set(['Alpha']), 'choice'),
      { catalog: ['Alpha'], freeText: [] },
    );
  });

  it('syncManualEditTextareaOrder preserves line order and syncs catalog selections', () => {
    const catalogSet = new Set(['Parent Child A', 'Без особливостей']);
    assert.deepEqual(
      syncManualEditTextareaOrder(
        ['Checking /// note', 'Без особливостей'],
        ['Без особливостей'],
        catalogSet,
      ),
      ['Checking /// note', 'Без особливостей'],
    );
    assert.deepEqual(
      syncManualEditTextareaOrder(
        ['Checking /// note', 'Без особливостей'],
        [],
        catalogSet,
      ),
      ['Checking /// note'],
    );
    assert.deepEqual(
      syncManualEditTextareaOrder(
        ['Checking /// note'],
        ['Без особливостей'],
        catalogSet,
      ),
      ['Checking /// note', 'Без особливостей'],
    );
  });
});
