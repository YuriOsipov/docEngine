import { cssFontSizeToPdfPt } from './style-mapper.js';

const PERCENT_RE = /^(\d+(?:\.\d+)?)%$/;

/**
 * Map a table column width from schema or DOM to a pdfmake table width.
 */
export function parseTableColumnWidth(width: string | number | null | undefined): number | string {
  const raw = String(width ?? '').trim();
  if (!raw || raw === 'auto') return '*';

  const percent = raw.match(PERCENT_RE);
  if (percent) return `${percent[1]}%`;

  const px = raw.match(/^(\d+(?:\.\d+)?)px$/i);
  if (px) {
    const pt = cssFontSizeToPdfPt(raw);
    return pt ?? '*';
  }

  const ptMatch = raw.match(/^(\d+(?:\.\d+)?)\s*pt$/i);
  if (ptMatch) return Number.parseFloat(ptMatch[1]);

  return '*';
}

/**
 * Scale percent-only width lists so they fill the table. Templates saved while
 * a wide row-actions column existed often sum to ~75–90% and leave a gap.
 */
export function scalePercentWidthsToFill(widths: Array<number | string>): Array<number | string> {
  if (!widths.length) return widths;
  const percents: number[] = [];
  for (const width of widths) {
    if (typeof width !== 'string') return widths;
    const match = width.trim().match(PERCENT_RE);
    if (!match) return widths;
    percents.push(Number(match[1]));
  }
  const sum = percents.reduce((total, value) => total + value, 0);
  if (!(sum > 0) || Math.abs(sum - 100) < 0.15) return widths;
  return percents.map((value) => `${Math.round((value / sum) * 100 * 10) / 10}%`);
}

export function tableColumnWidthsFromSchema(
  columns: Array<{ width?: string; [key: string]: unknown }> | null | undefined,
): Array<number | string> {
  return scalePercentWidthsToFill(
    (columns ?? []).map((col) => parseTableColumnWidth(col?.width)),
  );
}

export function tableColumnWidthsFromColElements(
  colEls: Iterable<{
    style?: { width?: string };
    getAttribute?: (name: string) => string | null;
  }>,
): Array<number | string> {
  const widths: Array<number | string> = [];
  for (const col of colEls) {
    const fromStyle = col.style?.width ?? '';
    const fromAttr = col.getAttribute?.('width') ?? '';
    widths.push(parseTableColumnWidth(fromStyle || fromAttr));
  }
  return scalePercentWidthsToFill(widths);
}
