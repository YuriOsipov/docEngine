import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseTableColumnWidth,
  tableColumnWidthsFromSchema,
} from './table-column-width.js';

describe('parseTableColumnWidth', () => {
  it('maps auto and empty to star width', () => {
    assert.equal(parseTableColumnWidth(''), '*');
    assert.equal(parseTableColumnWidth('auto'), '*');
  });

  it('preserves percentage widths', () => {
    assert.equal(parseTableColumnWidth('80%'), '80%');
    assert.equal(parseTableColumnWidth('20.5%'), '20.5%');
  });

  it('converts px to pdfmake points', () => {
    assert.equal(parseTableColumnWidth('120px'), 90);
  });

  it('accepts pt values', () => {
    assert.equal(parseTableColumnWidth('72pt'), 72);
  });
});

describe('tableColumnWidthsFromSchema', () => {
  it('maps each column width from schema', () => {
    assert.deepEqual(
      tableColumnWidthsFromSchema([
        { key: 'name', width: '80%' },
        { key: 'amount', width: '20%' },
      ]),
      ['80%', '20%'],
    );
  });
});
