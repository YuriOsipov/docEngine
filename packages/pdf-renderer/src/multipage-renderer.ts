import {
  applySectionInstanceToBlocks,
  collectAllValues,
  resolveRepeatablePagePlan,
} from '@docengine/editor/node';
import type { EditorDocument, PdfRenderOptions } from './types.js';
import { renderSinglePagePdfContent } from './segment-renderer.js';

function resolveDocPagePlan(doc: EditorDocument): any | null {
  if ((doc as any).repeatablePagePlan?.instances?.length > 1) {
    return (doc as any).repeatablePagePlan;
  }

  const blocks = (doc as any).blocks ?? [];
  const fieldSchemas = (doc as any).fieldSchemas ?? {};
  const flatValues = collectAllValues(blocks);
  const fresh = resolveRepeatablePagePlan(
    blocks,
    fieldSchemas,
    flatValues,
    (doc as any).repeatableSectionInstances ?? null,
  );
  if ((fresh?.instances?.length ?? 0) > 1) {
    return fresh;
  }

  return null;
}

export function hasMultipageRepeatableContent(doc: EditorDocument): boolean {
  const plan = resolveDocPagePlan(doc);
  return !!plan && plan.instances.length > 1;
}

/**
 * Route PDF export through the legacy segment renderer only for multipage instance layouts.
 * Single-instance repeatable section page headers are handled natively by the preview-first renderer.
 */
export function shouldUseLegacyPdfExport(doc: EditorDocument): boolean {
  return hasMultipageRepeatableContent(doc);
}

export type PdfMultipageRenderOptions = PdfRenderOptions & {
  resolveFontName: (name?: string | null) => string;
  defaultFont: string;
};

export function renderMultipagePdfContent(
  doc: EditorDocument,
  options: PdfMultipageRenderOptions,
): Array<Record<string, unknown>> {
  const plan = resolveDocPagePlan(doc);
  if (!plan || plan.instances.length <= 1) {
    return renderSinglePagePdfContent(doc, options);
  }

  const blocks = (doc as any).blocks ?? [];
  const fieldSchemas = (doc as any).fieldSchemas ?? {};
  const beforeBlocks = blocks.slice(0, plan.repeatableBlockIndex);
  const repeatBlock = blocks[plan.repeatableBlockIndex];
  const afterBlocks = blocks.slice(plan.repeatableBlockIndex + 1);

  const content: Array<Record<string, unknown>> = [];
  const pageOptions = { ...options, skipRepeatablePageHeader: true };

  for (let i = 0; i < plan.instances.length; i += 1) {
    if (i > 0) {
      content.push({ text: '', pageBreak: 'before' });
    }

    const instanceFieldMap = plan.instances[i];
    let pageFieldSchemas = fieldSchemas;
    let pageBlocks = [...beforeBlocks];

    const applied = applySectionInstanceToBlocks(
      [repeatBlock],
      fieldSchemas,
      0,
      instanceFieldMap,
    );
    pageBlocks.push({ ...repeatBlock, data: applied.blocks[0]?.data ?? repeatBlock.data });
    pageFieldSchemas = applied.fieldSchemas;

    if (i === plan.instances.length - 1) {
      pageBlocks = [...pageBlocks, ...afterBlocks];
    }

    const pageDoc = {
      time: (doc as any).time,
      fieldSchemas: pageFieldSchemas,
      blocks: pageBlocks,
    };
    content.push(...renderSinglePagePdfContent(pageDoc, pageOptions));
  }

  if (!content.length) {
    content.push({ text: 'No filled content to export.', style: 'empty' });
  }

  return content;
}

export function renderDocumentToPdfContent(
  doc: EditorDocument,
  options: PdfMultipageRenderOptions,
): Array<Record<string, unknown>> {
  if (hasMultipageRepeatableContent(doc)) {
    return renderMultipagePdfContent(doc, options);
  }
  return renderSinglePagePdfContent(doc, options);
}
