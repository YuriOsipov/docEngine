/**
 * pdfmake table layout matching `.vision-table` in editor.css:
 * border: 1px solid #999; padding: 4px 8px.
 *
 * Table cells use lineHeight 1 (see TABLE_PDF_LINE_HEIGHT) so equal top/bottom
 * padding renders evenly; body prose keeps the document default line height.
 */
export const TABLE_PDF_LINE_HEIGHT = 1;

/** 4px and 8px at 96dpi → pt (×0.75). Symmetric vertical padding matches editor.css. */
export const TABLE_CELL_PAD_V = 3;
const PAD_H = 6;

export const VISION_TABLE_PDF_LAYOUT = {
  hLineWidth() {
    return 0.75;
  },
  vLineWidth() {
    return 0.75;
  },
  hLineColor() {
    return '#999999';
  },
  vLineColor() {
    return '#999999';
  },
  paddingLeft() {
    return PAD_H;
  },
  paddingRight() {
    return PAD_H;
  },
  paddingTop() {
    return TABLE_CELL_PAD_V;
  },
  paddingBottom() {
    return TABLE_CELL_PAD_V;
  },
};

/** Matches `.vision-table--borderless` — keep padding, drop grid lines. */
export const VISION_TABLE_BORDERLESS_PDF_LAYOUT = {
  hLineWidth() {
    return 0;
  },
  vLineWidth() {
    return 0;
  },
  hLineColor() {
    return '#999999';
  },
  vLineColor() {
    return '#999999';
  },
  paddingLeft() {
    return PAD_H;
  },
  paddingRight() {
    return PAD_H;
  },
  paddingTop() {
    return TABLE_CELL_PAD_V;
  },
  paddingBottom() {
    return TABLE_CELL_PAD_V;
  },
};

export function resolveVisionTablePdfLayout(presentation: { hideBorders?: boolean } = {}) {
  return presentation.hideBorders
    ? VISION_TABLE_BORDERLESS_PDF_LAYOUT
    : VISION_TABLE_PDF_LAYOUT;
}
