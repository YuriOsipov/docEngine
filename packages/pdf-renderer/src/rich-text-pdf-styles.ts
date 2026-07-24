/** Default highlight background — matches editor.css `.document-section__body mark`. */
export const PDF_MARK_BACKGROUND = '#FFF59D';

/** Default inline-code background — matches editor.css `.document-section__body code`. */
export const PDF_INLINE_CODE_BACKGROUND = '#F0F0F0';

export const PDF_INLINE_CODE_FONT_SCALE = 0.92;

export function parseCssColor(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim();
  if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw.toUpperCase();

  const rgb = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`.toUpperCase();
  }

  return null;
}

/**
 * pdfmake inline style for `<mark>` highlight.
 */
export function pdfMarkStyle(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { background: PDF_MARK_BACKGROUND, ...overrides };
}

/**
 * pdfmake inline style for `<code>` inline code.
 */
export function pdfInlineCodeStyle(
  baseFontSizePt: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const fontSize = Math.round(Number(baseFontSizePt) * PDF_INLINE_CODE_FONT_SCALE * 10) / 10;
  return { background: PDF_INLINE_CODE_BACKGROUND, fontSize, ...overrides };
}
