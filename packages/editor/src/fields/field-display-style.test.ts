import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cellFieldId } from '../core/field-schemas.js';
import { DOCUMENT_TABLE_HEADER_STYLE, DOCUMENT_TABLE_TEXT_STYLE, DEFAULT_DOCUMENT_BODY_STYLE, EDITOR_FONT_FAMILY } from '../core/document-display-defaults.js';
import {
  normalizeFieldDisplayStyle,
  resolveTableCellDisplayStyle,
  resolveTableColumnDisplayStyle,
  resolveTokenDisplayStyle,
} from './field-display-style.js';
import { normalizeFontFamily } from './rich-text.js';

describe('normalizeFontFamily', () => {
  it('preserves comma-separated font stacks', () => {
    assert.equal(
      normalizeFontFamily(EDITOR_FONT_FAMILY),
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    );
  });

  it('preserves legacy Tahoma stacks', () => {
    assert.equal(
      normalizeFontFamily("Tahoma, 'Segoe UI', Geneva, Verdana, sans-serif"),
      'Tahoma, "Segoe UI", Geneva, Verdana, sans-serif',
    );
  });

  it('quotes multi-word family names', () => {
    assert.equal(normalizeFontFamily('Times New Roman'), '"Times New Roman"');
  });

  it('repairs legacy whole-stack values wrapped in quotes', () => {
    assert.equal(
      normalizeFontFamily('"Tahoma, \'Segoe UI\', Geneva, Verdana, sans-serif"'),
      'Tahoma, "Segoe UI", Geneva, Verdana, sans-serif',
    );
  });
});

describe('resolveTableColumnDisplayStyle', () => {
  it('uses document body text defaults for headers even when cells have column styles', () => {
    const tableId = 'exam_table';
    const row2Cell = cellFieldId(tableId, 'row2', 'col2');
    const fieldSchemas = {
      [tableId]: {
        type: 'table',
        columns: [
          { key: 'col1', label: 'Column 1' },
          { key: 'col2', label: 'Column 2' },
        ],
        rows: [
          { key: 'row1', label: 'Row 1' },
          { key: 'row2', label: 'Row 2' },
        ],
      },
      [row2Cell]: {
        type: 'choice',
        label: 'Column 2',
        displayStyle: { fontFamily: 'Times New Roman', textAlign: 'right' },
      },
    };

    const headerDefault = normalizeFieldDisplayStyle(DOCUMENT_TABLE_HEADER_STYLE);
    const style = resolveTableColumnDisplayStyle(tableId, 'col2', fieldSchemas);
    assert.equal(style.fontFamily, headerDefault.fontFamily);
    assert.equal(style.fontSize, headerDefault.fontSize);
    assert.equal(style.fontWeight, 'normal');
    assert.equal(style.textAlign, 'center');
    assert.equal(style.fontStyle, undefined);
  });

  it('applies Page setup text style to table headers', () => {
    const tableId = 'exam_table';
    const fieldSchemas = {
      [tableId]: {
        type: 'table',
        columns: [{ key: 'col1', label: 'Column 1' }],
        rows: [{ key: 'row1', label: 'Row 1' }],
      },
      [cellFieldId(tableId, 'row1', 'col1')]: { type: 'choice', label: 'Column 1' },
    };

    const style = resolveTableColumnDisplayStyle(tableId, 'col1', fieldSchemas, {
      default: { fontFamily: 'Courier New', fontSize: '12px' },
    }, {
      fontFamily: 'Tahoma',
      fontSize: '15px',
      fontWeight: 'normal',
    });
    assert.equal(style.fontSize, '15px');
    assert.equal(style.fontFamily, 'Tahoma');
    assert.equal(style.fontWeight, 'normal');
    assert.equal(style.textAlign, 'center');
  });
});

describe('resolveTableCellDisplayStyle', () => {
  it('uses display style from any row in the column, not only the first row', () => {
    const tableId = 'exam_table';
    const row1Cell = cellFieldId(tableId, 'row1', 'col2');
    const row2Cell = cellFieldId(tableId, 'row2', 'col2');
    const fieldSchemas = {
      [tableId]: {
        type: 'table',
        columns: [
          { key: 'col1', label: 'Column 1' },
          { key: 'col2', label: 'Column 2' },
        ],
        rows: [
          { key: 'row1', label: 'Row 1' },
          { key: 'row2', label: 'Row 2' },
        ],
      },
      [row1Cell]: { type: 'choice', label: 'Column 2' },
      [row2Cell]: {
        type: 'choice',
        label: 'Column 2',
        displayStyle: { fontFamily: 'Times New Roman' },
      },
    };

    const style = resolveTableCellDisplayStyle(tableId, 'col2', fieldSchemas[row1Cell], fieldSchemas);
    assert.equal(style.fontFamily, '"Times New Roman"');
  });

  it('uses column textAlign from any cell in the column', () => {
    const tableId = 'exam_table';
    const row2Cell = cellFieldId(tableId, 'row2', 'col2');
    const fieldSchemas = {
      [tableId]: {
        type: 'table',
        columns: [
          { key: 'col1', label: 'Column 1' },
          { key: 'col2', label: 'Column 2' },
        ],
        rows: [
          { key: 'row1', label: 'Row 1' },
          { key: 'row2', label: 'Row 2' },
        ],
      },
      [row2Cell]: {
        type: 'text',
        label: 'Column 2',
        displayStyle: { textAlign: 'right' },
      },
    };

    const style = resolveTableCellDisplayStyle(tableId, 'col2', fieldSchemas[row2Cell], fieldSchemas);
    assert.equal(style.textAlign, 'right');
  });
});

describe('resolveTokenDisplayStyle', () => {
  function mockToken(classes: any = []): any {
    const set = new Set(classes);
    return {
      classList: {
        contains: (name: any) => set.has(name),
      },
      closest: () => null as any,
    };
  }

  it('uses table defaults for table cells', () => {
    const tableDefault = normalizeFieldDisplayStyle(DOCUMENT_TABLE_TEXT_STYLE);
    const style = resolveTokenDisplayStyle(
      { type: 'choice', label: 'Column 1' },
      { fontFamily: 'Tahoma', fontSize: '15px' },
      true,
    );
    assert.equal(style.fontSize, tableDefault.fontSize);
    assert.equal(style.fontFamily, tableDefault.fontFamily);
  });

  it('omits color and underline when fill-mode highlight is active on empty fields', () => {
    const style = resolveTokenDisplayStyle(
      { type: 'text', label: 'Note', displayStyle: { color: '#333333', textDecoration: 'underline' } },
      { color: '#000000', fontWeight: 'bold' },
      false,
      { default: { color: '#000000' } },
      { fillModeFieldHighlight: true },
      mockToken(['field-token--empty']),
    );
    assert.equal(style.color, undefined);
    assert.equal(style.textDecoration, undefined);
    assert.equal(style.fontWeight, undefined);
    assert.equal(style.fontSize, DEFAULT_DOCUMENT_BODY_STYLE.fontSize);
  });

  it('omits highlight-controlled styles for empty design-mode fields', () => {
    const style = resolveTokenDisplayStyle(
      { type: 'text', label: 'Note', displayStyle: { color: '#333333' } },
      { color: '#000000', fontWeight: 'bold' },
      false,
      { default: { color: '#000000' } },
      { fillModeFieldHighlight: false },
      mockToken(['field-token--empty', 'field-token--design']),
    );
    assert.equal(style.color, undefined);
    assert.equal(style.textDecoration, undefined);
    assert.equal(style.fontWeight, undefined);
  });

  it('omits highlight-controlled styles for empty mapping-mode fields', () => {
    const style = resolveTokenDisplayStyle(
      { type: 'text', label: 'Note', displayStyle: { color: '#333333' } },
      { color: '#000000', fontWeight: 'bold' },
      false,
      { default: { color: '#000000' } },
      { fillModeFieldHighlight: false, mappingMode: true },
      mockToken(['field-token--empty']),
    );
    assert.equal(style.color, undefined);
    assert.equal(style.textDecoration, undefined);
    assert.equal(style.fontWeight, undefined);
  });

  it('keeps value color when fill-mode highlight is active but field is populated', () => {
    const style = resolveTokenDisplayStyle(
      { type: 'text', label: 'Note' },
      { color: '#000000', fontWeight: 'bold' },
      false,
      { default: { color: '#000000' } },
      { fillModeFieldHighlight: true },
      mockToken([]),
    );
    assert.equal(style.color, '#000000');
    assert.equal(style.fontWeight, 'bold');
  });

  it('does not force underline in populated inline style so fill-mode CSS can apply', () => {
    const style = resolveTokenDisplayStyle(
      { type: 'text', label: 'Note' },
      { color: '#000000', textDecoration: 'none' },
      false,
      { default: { textDecoration: 'none' } },
      { fillModeFieldHighlight: true },
      mockToken([]),
    );
    assert.equal(style.textDecoration, 'none');
  });
});
