import PdfPrinter from 'pdfmake';
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js';
import type { EditorDocument, PdfFontFamilyFiles, PdfGenerateInput, PdfRenderOptions } from './types.js';
import { renderDocumentToPdfDefinition } from './document-pdf-definition-node.js';
import { mergeTemplateAndDocument } from './merge-document.js';

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

export async function generateDocumentPdf(
  doc: EditorDocument,
  options: PdfRenderOptions = {},
): Promise<Buffer> {
  const { docDefinition, fonts } = renderDocumentToPdfDefinition(doc, options);
  return generatePdfBuffer(docDefinition, fonts);
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
