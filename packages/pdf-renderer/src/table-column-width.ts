import { cssFontSizeToPdfPt } from './style-mapper.js';

/**
 * Map a table column width from schema or DOM to a pdfmake table width.
 */
export function parseTableColumnWidth(width: string | number | null | undefined): number | string {
  const raw = String(width ?? '').trim();
  if (!raw || raw === 'auto') return '*';

  const percent = raw.match(/^(\d+(?:\.\d+)?)%$/);
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

export function tableColumnWidthsFromSchema(
  columns: Array<{ width?: string; [key: string]: unknown }> | null | undefined,
): Array<number | string> {
  return (columns ?? []).map((col) => parseTableColumnWidth(col?.width));
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
  return widths;
}
