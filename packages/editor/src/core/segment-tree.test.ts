// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findColumnsSegment, updateColumnsSegment } from './segment-tree.js';

describe('segment-tree columns helpers', () => {
  const segments = [
    { type: 'text', content: 'intro' },
    {
      type: 'columns',
      id: 'cols_outer',
      columns: [
        [
          {
            type: 'columns',
            id: 'cols_inner',
            widths: ['2fr', '1fr'],
            columns: [[{ type: 'field', id: 'weight' }], []],
          },
        ],
        [],
      ],
    },
  ];

  it('findColumnsSegment locates nested columns by id', () => {
    const found = findColumnsSegment(segments, 'cols_inner');
    assert.equal(found?.id, 'cols_inner');
    assert.deepEqual(found?.widths, ['2fr', '1fr']);
  });

  it('updateColumnsSegment updates nested columns', () => {
    const next = updateColumnsSegment(segments, 'cols_inner', (seg) => ({
      ...seg,
      widths: ['1fr', '2fr'],
    }));
    const found = findColumnsSegment(next, 'cols_inner');
    assert.deepEqual(found?.widths, ['1fr', '2fr']);
    assert.equal(findColumnsSegment(next, 'cols_outer')?.id, 'cols_outer');
  });
});
