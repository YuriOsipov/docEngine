import {
  DOCUMENT_BODY_LINE_HEIGHT,
  evaluateSectionVisibility,
  filterSegmentsForPreview,
  findRepeatableSectionBlock,
} from '@docengine/editor/node';
import type { EditorDocument, PdfPageSetup, PdfRenderOptions } from './types.js';
import { DEFAULT_BODY_FONT_PT } from './style-mapper.js';
import { estimatePdfContentHeightPt } from './repeatable-table-pagination.js';
import {
  createPdfRenderContext,
  renderSegmentsToPdfProseBlocks,
  buildPdfSectionTitleNode,
} from './segment-renderer.js';
import { ptToMm } from './units.js';

const BODY_LINE_HEIGHT_PT = DEFAULT_BODY_FONT_PT * DOCUMENT_BODY_LINE_HEIGHT;
const HEADER_STACK_GAP_PT = 3;

/** Base padding on top of content estimate. */
export const HEADER_HEIGHT_BUFFER_PT = 6;

/** Extra slack (~3/4 line) so the last header line is not clipped by pdfmake. */
export const HEADER_LINE_SLACK_PT = BODY_LINE_HEIGHT_PT * 0.75;

export function usesRepeatablePageHeader(pageSetup: PdfPageSetup | undefined): boolean {
  return !!pageSetup?.header?.fromRepeatableSection;
}

function buildRepeatableSectionHeaderTitleNode(
  sectionLabel: string,
  sectionHeaderStyle: Record<string, unknown>,
) {
  return buildPdfSectionTitleNode(sectionLabel, sectionHeaderStyle, [0, 0, 0, 0]);
}

export function computeRepeatableHeaderBandHeightPt(
  stack: Array<Record<string, unknown>>,
  pageSetup?: PdfPageSetup,
): number {
  const contentPt = estimatePdfContentHeightPt(stack, pageSetup);
  const stackGapPt = Math.max(0, stack.length - 1) * HEADER_STACK_GAP_PT;
  return contentPt + stackGapPt + HEADER_LINE_SLACK_PT + HEADER_HEIGHT_BUFFER_PT;
}

export function estimateRepeatableHeaderHeightMm(
  stack: Array<Record<string, unknown>>,
  pageSetup?: PdfPageSetup,
): number {
  return ptToMm(computeRepeatableHeaderBandHeightPt(stack, pageSetup));
}

export type PdfHeaderRenderOptions = PdfRenderOptions & {
  resolveFontName: (name?: string | null) => string;
  defaultFont: string;
};

export function buildRepeatableSectionPageHeader(
  doc: EditorDocument,
  options: PdfHeaderRenderOptions,
): { stack: Array<Record<string, unknown>>; heightPt: number; heightMm: number } | null {
  const repeatable = findRepeatableSectionBlock((doc as any).blocks);
  if (!repeatable) return null;

  const pageSetup = { ...((doc as any).pageSetup ?? {}), ...(options.pageSetup ?? {}) };
  const ctx = createPdfRenderContext(doc, options);
  const data = (repeatable as any).block.data ?? {};
  if (!evaluateSectionVisibility(data.visibility, ctx.fieldValues, ctx.fieldSchemas)) return null;
  const sectionLabel = String(data.label ?? '').trim();
  const segmentSource = structuredClone(data.segments ?? []);
  const filtered = options.hideEmptyValues === true
    ? filterSegmentsForPreview(
      segmentSource,
      ctx.fieldValues,
      ctx.fieldSchemas,
    )
    : segmentSource;
  const nonTableSegments = filtered.filter((seg: any) => seg.type !== 'table');
  const bodyBlocks = renderSegmentsToPdfProseBlocks(nonTableSegments, ctx);

  if (!sectionLabel && !bodyBlocks.length) return null;

  const stack: Array<Record<string, unknown>> = [];
  if (sectionLabel) {
    const titleNode = buildRepeatableSectionHeaderTitleNode(sectionLabel, ctx.sectionHeaderPdfStyle);
    if (titleNode) stack.push(titleNode as Record<string, unknown>);
  }
  stack.push(...(bodyBlocks as Array<Record<string, unknown>>));

  const heightPt = computeRepeatableHeaderBandHeightPt(stack, pageSetup);
  const heightMm = ptToMm(heightPt);

  return {
    stack,
    heightPt,
    heightMm,
  };
}
