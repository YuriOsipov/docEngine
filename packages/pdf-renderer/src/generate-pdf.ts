import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js';
import type { EditorDocument, PdfFontFamilyFiles, PdfGenerateInput, PdfRenderOptions } from './types.js';
import { renderDocumentToPdfDefinition } from './document-pdf-definition-node.js';
import { renderDocumentToPdfDefinitionFromPreview } from './document-pdf-definition-preview-node.js';
import { mergeTemplateAndDocument } from './merge-document.js';
import { ensureDomEnvironment } from './html-environment.js';
import { shouldUseLegacyPdfExport } from './multipage-renderer.js';
import { prefetchImagesFromDom } from './image-prefetch.js';
import { ensurePreviewFieldPlugins } from './preview-field-plugins.js';

export function generatePdfBuffer(
  docDefinition: TDocumentDefinitions,
  fonts: Record<string, PdfFontFamilyFiles & { bold: string; italics: string; bolditalics: string }>,
): Promise<Buffer> {
  const printer = new PdfPrinter(fonts);
  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

/**
 * Same HTML preview as View as HTML, converted to pdfmake.
 * Multipage repeatable instance layouts still use the document renderer.
 */
export async function renderPreviewDocumentToPdfDefinition(
  doc: EditorDocument,
  options: PdfRenderOptions = {},
) {
  await ensureDomEnvironment();
  ensurePreviewFieldPlugins();
  const { renderDocumentPreview } = await import('@docengine/editor/node');
  const previewRoot = renderDocumentPreview(doc as any, {
    pageSetup: options.pageSetup ?? (doc as any).pageSetup,
    fieldValueStyle: options.fieldValueStyle,
    fieldHighlight: options.fieldHighlight,
    hideEmptyValues: options.hideEmptyValues === true,
  });
  const imageMap = await prefetchImagesFromDom(previewRoot as HTMLElement);
  return renderDocumentToPdfDefinitionFromPreview(previewRoot as HTMLElement, doc, {
    ...options,
    imageMap,
  });
}

export async function generateDocumentPdf(
  doc: EditorDocument,
  options: PdfRenderOptions = {},
): Promise<Buffer> {
  const { docDefinition, fonts } = shouldUseLegacyPdfExport(doc)
    ? renderDocumentToPdfDefinition(doc, options)
    : await renderPreviewDocumentToPdfDefinition(doc, options);
  return generatePdfBuffer(docDefinition as TDocumentDefinitions, fonts);
}

export async function generatePdfFromTemplate(input: PdfGenerateInput): Promise<Buffer> {
  const doc = mergeTemplateAndDocument(input.template, input.document);
  const templatePageSetup = (input.template as any)?.pageSetup ?? {};
  const requestPageSetup = input.pageSetup ?? {};
  return generateDocumentPdf(doc, {
    pageSetup: {
      ...templatePageSetup,
      ...requestPageSetup,
      header: { ...templatePageSetup.header, ...requestPageSetup.header },
      footer: { ...templatePageSetup.footer, ...requestPageSetup.footer },
    },
    fonts: input.fonts,
    fieldValueStyle: input.fieldValueStyle,
    fieldHighlight: input.fieldHighlight,
    hideEmptyValues: input.hideEmptyValues === true,
  });
}
