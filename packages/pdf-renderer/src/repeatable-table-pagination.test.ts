import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  chunkTableBodyRows,
  chunkTableBodyRowsVariable,
  estimateContentAreaHeightPt,
  estimateContentWidthPt,
  estimateContinuationChunkMaxBodyHeight,
  estimateFirstChunkMaxBodyHeight,
  estimateMaxBodyHeightPerChunk,
  estimatePdfContentHeightPt,
  estimateRowHeightPt,
  estimateWrappedLineCount,
} from './repeatable-table-pagination.js';

describe('repeatable-table-pagination', () => {
  it('estimates A4 content area height from page setup', () => {
    const height = estimateContentAreaHeightPt({ format: 'a4', margin: 15 });
    assert.ok(height > 700);
    assert.ok(height < 800);
  });

  it('estimates row height from line count', () => {
    const singleLine = estimateRowHeightPt([{ text: 'one line', fontSize: 13 }]);
    const multiLine = estimateRowHeightPt([{ text: 'line one\nline two\nline three', fontSize: 13 }]);
    assert.ok(multiLine > singleLine);
  });

  it('packs rows into chunks that fit max body height', () => {
    const rows = [
      [{ text: 'a' }],
      [{ text: 'b' }],
      [{ text: 'c' }],
      [{ text: 'd' }],
      [{ text: 'e' }],
    ];
    const rowHeight = estimateRowHeightPt(rows[0]);
    const chunks = chunkTableBodyRows(rows, rowHeight * 2 + 1);

    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].length, 2);
    assert.equal(chunks[1].length, 2);
    assert.equal(chunks[2].length, 1);
  });

  it('keeps a single tall row in its own chunk', () => {
    const tallRow = [{ text: 'line\n'.repeat(10), fontSize: 13 }];
    const rowHeight = estimateRowHeightPt(tallRow);
    const chunks = chunkTableBodyRows([tallRow, [{ text: 'short' }]], rowHeight - 1);

    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].length, 1);
    assert.equal(chunks[1].length, 1);
  });

  it('reserves section title and column header space per chunk', () => {
    const fullHeight = estimateContentAreaHeightPt({ format: 'a4', margin: 15 });
    const maxBody = estimateMaxBodyHeightPerChunk({ format: 'a4', margin: 15 });
    assert.ok(maxBody < fullHeight);
  });

  it('shrinks the first chunk when prior content is present', () => {
    const pageSetup = { format: 'a4', margin: 15 };
    const full = estimateMaxBodyHeightPerChunk(pageSetup);
    const prior = estimatePdfContentHeightPt([
      {
        stack: [
          { text: 'Anamnesis', style: 'sectionHeader', margin: [0, 8, 0, 4] },
          { text: 'Complaints: tearing.\nLife history: unremarkable.', margin: [0, 0, 0, 4] },
        ],
        margin: [0, 0, 0, 6],
      },
    ]);
    const first = estimateFirstChunkMaxBodyHeight(pageSetup, prior);
    assert.ok(first < full);
  });

  it('subtracts leading content height from the first chunk budget', () => {
    const pageSetup = { format: 'a4', margin: 15 };
    const full = estimateFirstChunkMaxBodyHeight(pageSetup);
    const withLeading = estimateFirstChunkMaxBodyHeight(pageSetup, 0, 220);
    assert.ok(withLeading < full);
  });

  it('uses a more conservative budget for continuation page chunks', () => {
    const pageSetup = { format: 'a4', margin: 15 };
    const continuation = estimateContinuationChunkMaxBodyHeight(pageSetup);
    const legacy = estimateMaxBodyHeightPerChunk(pageSetup);
    assert.equal(continuation, legacy);
    assert.ok(continuation < estimateContentAreaHeightPt(pageSetup));
  });

  it('uses a smaller first chunk limit when prior content reduces remaining page space', () => {
    const rows = Array.from({ length: 10 }, (_, index) => [{ text: `value-${index + 1}` }]);
    const rowHeight = estimateRowHeightPt(rows[0]);
    const fullMax = rowHeight * 8;
    const firstMax = rowHeight * 3;
    const chunks = chunkTableBodyRowsVariable(rows, firstMax, fullMax);

    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].length, 3);
    assert.equal(chunks[1].length, 7);
  });

  it('allows a larger first chunk when repeatable section content is in the page header', () => {
    const pageSetup = {
      format: 'a4',
      margin: 15,
      header: { height: 80, fromRepeatableSection: true },
    };
    const contentHeight = estimateContentAreaHeightPt(pageSetup);
    const capped = estimateFirstChunkMaxBodyHeight(pageSetup, 0, 30, false);
    const pageHeader = estimateFirstChunkMaxBodyHeight(pageSetup, 0, 30, true);

    assert.ok(capped <= contentHeight * 0.22 + 1);
    assert.ok(pageHeader > capped * 2);
  });

  it('estimates wrapped line count for long single-line prose', () => {
    const pageSetup = { format: 'a4', margin: 15 };
    const contentWidth = estimateContentWidthPt(pageSetup);
    const longLine = 'Complaints: Vision disturbance decreased acuity; Tearing; Redness JUST test , no more.';
    const wrapped = estimateWrappedLineCount(longLine, 15, contentWidth);
    const newlineOnly = Math.max(1, longLine.split('\n').length);

    assert.ok(contentWidth > 400);
    assert.ok(wrapped > newlineOnly);
  });

  it('uses wrapped line count when pageSetup is passed to estimatePdfContentHeightPt', () => {
    const pageSetup = { format: 'a4', margin: 15 };
    const longLine = 'Complaints: Vision disturbance decreased acuity; Tearing; Redness JUST test , no more. Additional symptoms and history notes for wrap estimation.';
    const withWrap = estimatePdfContentHeightPt([{ text: longLine, margin: [0, 0, 0, 4] }], pageSetup);
    const withoutWrap = estimatePdfContentHeightPt([{ text: longLine, margin: [0, 0, 0, 4] }]);

    assert.ok(withWrap > withoutWrap);
  });
});
