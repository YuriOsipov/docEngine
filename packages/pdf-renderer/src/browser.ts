import {
  DEFAULT_DOCUMENT_BODY_STYLE,
  DEFAULT_FIELD_VALUE_STYLE_OPTIONS,
} from '@docengine/editor/node';
import type { EditorDocument } from './types.js';
import type { PdfRenderOptions } from './types.js';
import { renderDocumentToPdfDefinition } from './document-pdf-definition-browser.js';
import { renderDocumentToPdfDefinitionFromPreview } from './document-pdf-definition-preview-browser.js';
import { generateDocumentPdf, generateDocumentPdfFromPreview, generatePdfBuffer } from './generate-pdf-browser.js';
import { renderDocumentToPdfContent, hasMultipageRepeatableContent, shouldUseLegacyPdfExport } from './multipage-renderer.js';
import { mmToPt, marginMmToPt, normalizeMarginMm, resolvePageOrientation, resolvePageSize } from './units.js';

export {
  renderDocumentToPdfDefinition,
  renderDocumentToPdfDefinitionFromPreview,
  generateDocumentPdf,
  generateDocumentPdfFromPreview,
  generatePdfBuffer,
  renderDocumentToPdfContent,
  hasMultipageRepeatableContent,
  shouldUseLegacyPdfExport,
  mmToPt,
  marginMmToPt,
  normalizeMarginMm,
  resolvePageOrientation,
  resolvePageSize,
  DEFAULT_FIELD_VALUE_STYLE_OPTIONS,
};

export { previewDomToPdfContent } from './preview-dom-to-pdf.js';
export { buildFontRegistry, BROWSER_FONT_PRESETS } from './fonts-browser-registry.js';
export { createRenderDocumentToPdfDefinitionFromPreview } from './document-pdf-definition-preview.js';

export type EditorPdfOptions = PdfRenderOptions & {
  format?: string;
  margin?: number | number[];
  title?: string;
  fieldValueStyle?: any;
};

export function mapEditorPdfOptions(
  doc: EditorDocument,
  editorOptions: EditorPdfOptions = {},
): PdfRenderOptions {
  const docPageSetup = (doc as any)?.pageSetup ?? {};
  const optionsPageSetup = editorOptions.pageSetup ?? {};
  return {
    pageSetup: {
      ...docPageSetup,
      ...optionsPageSetup,
      format: editorOptions.format ?? optionsPageSetup.format ?? docPageSetup.format,
      margin: editorOptions.margin ?? optionsPageSetup.margin ?? docPageSetup.margin,
      title: editorOptions.title ?? optionsPageSetup.title ?? docPageSetup.title,
    },
    fonts: editorOptions.fonts ?? { preset: 'Inter' },
    fieldHighlight:
      editorOptions.fieldHighlight ?? optionsPageSetup.fieldHighlight ?? docPageSetup.fieldHighlight,
    fieldValueStyle: {
      default: {
        ...DEFAULT_DOCUMENT_BODY_STYLE,
        ...editorOptions.fieldValueStyle?.default,
      },
    },
  };
}

export async function generateDocumentPdfBlobFromPreview(
  doc: EditorDocument,
  previewRoot: HTMLElement,
  options: EditorPdfOptions = {},
): Promise<Blob> {
  const bytes = await generateDocumentPdfFromPreview(doc, previewRoot, mapEditorPdfOptions(doc, options));
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export async function generateDocumentPdfBlob(
  doc: EditorDocument,
  options: EditorPdfOptions = {},
): Promise<Blob> {
  const bytes = await generateDocumentPdf(doc, mapEditorPdfOptions(doc, options));
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}
