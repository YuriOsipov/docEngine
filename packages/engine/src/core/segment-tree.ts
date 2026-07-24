import type { ColumnsSegment, Segment } from '../types.js';

export function walkSegments(segments: Segment[] | null | undefined, onSegment: (seg: Segment) => void): void {
  for (const seg of segments ?? []) {
    onSegment(seg);
    if (seg.type === 'columns') {
      for (const col of seg.columns ?? []) {
        walkSegments(col, onSegment);
      }
    }
  }
}

export function mapSegments(segments: Segment[] | null | undefined, mapSeg: (seg: Segment) => Segment): Segment[] {
  return (segments ?? []).map((seg) => {
    const mapped = mapSeg(seg);
    if (mapped.type === 'columns') {
      return {
        ...mapped,
        columns: (mapped.columns ?? [[], []]).map((col) => mapSegments(col, mapSeg)) as [
          Segment[],
          Segment[],
        ],
      };
    }
    return mapped;
  });
}

export function findColumnsSegment(
  segments: Segment[] | null | undefined,
  columnsId: string,
): ColumnsSegment | null {
  let found: ColumnsSegment | null = null;
  walkSegments(segments, (seg) => {
    if (seg.type === 'columns' && seg.id === columnsId) {
      found = seg;
    }
  });
  return found;
}

export function updateColumnsSegment(
  segments: Segment[] | null | undefined,
  columnsId: string,
  updater: (seg: ColumnsSegment) => ColumnsSegment,
): Segment[] {
  return mapSegments(segments, (seg) => {
    if (seg.type === 'columns' && seg.id === columnsId) {
      return updater(seg);
    }
    return seg;
  });
}
