export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4;
}

export function ptToMm(pt: number): number {
  return (pt * 25.4) / 72;
}

export function normalizeMarginMm(
  margin: number | [number, number, number, number] | null | undefined,
): [number, number, number, number] {
  if (margin == null) return [15, 15, 15, 15];
  if (typeof margin === 'number') return [margin, margin, margin, margin];
  return margin;
}

export function marginMmToPt(
  marginMm: number | [number, number, number, number],
): [number, number, number, number] {
  const [top, right, bottom, left] = normalizeMarginMm(marginMm);
  return [mmToPt(left), mmToPt(top), mmToPt(right), mmToPt(bottom)];
}

export function resolvePageSize(format: 'a4' | 'letter' | 'A4' | 'LETTER' | string | null | undefined): 'A4' | 'LETTER' {
  const key = String(format ?? 'a4').toLowerCase();
  if (key === 'letter') return 'LETTER';
  return 'A4';
}

export function resolvePageOrientation(
  orientation: 'portrait' | 'landscape' | string | null | undefined,
): 'portrait' | 'landscape' {
  return String(orientation ?? 'portrait').toLowerCase() === 'landscape' ? 'landscape' : 'portrait';
}
