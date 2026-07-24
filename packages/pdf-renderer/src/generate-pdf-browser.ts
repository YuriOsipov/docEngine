import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js';
import type { EditorDocument, PdfFontFamilyFiles, PdfRenderOptions } from './types.js';
import { DEJAVU_BROWSER_VFS } from './fonts-browser-vfs.js';
import { renderDocumentToPdfDefinition } from './document-pdf-definition-browser.js';
import { renderDocumentToPdfDefinitionFromPreview } from './document-pdf-definition-preview-browser.js';
import { hasMultipageRepeatableContent, shouldUseLegacyPdfExport } from './multipage-renderer.js';
import { prefetchImagesFromDom } from './image-prefetch.js';

const vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).vfs ?? pdfFonts;
(pdfMake as any).vfs = { ...vfs, ...DEJAVU_BROWSER_VFS };

export function generatePdfBuffer(
  docDefinition: TDocumentDefinitions,
  fonts: Record<string, PdfFontFamilyFiles & { bold: string; italics: string; bolditalics: string }>,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      const pdf = (pdfMake as any).createPdf(docDefinition, undefined, fonts, (pdfMake as any).vfs);
      pdf.getBuffer((buffer: ArrayBuffer | Uint8Array) => {
        resolve(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
      });
    } catch (err) {
      reject(err);
    }
  });
}

export async function generateDocumentPdf(
  doc: EditorDocument,
  options: PdfRenderOptions = {},
): Promise<Uint8Array> {
  const { docDefinition, fonts } = renderDocumentToPdfDefinition(doc, options);
  return generatePdfBuffer(docDefinition, fonts);
}

export async function generateDocumentPdfFromPreview(
  doc: EditorDocument,
  previewRoot: HTMLElement,
  options: PdfRenderOptions = {},
): Promise<Uint8Array> {
  const imageMap = await prefetchImagesFromDom(previewRoot);
  const { docDefinition, fonts } = renderDocumentToPdfDefinitionFromPreview(previewRoot, doc, {
    ...options,
    imageMap,
  });
  return generatePdfBuffer(docDefinition, fonts);
}

export { hasMultipageRepeatableContent, shouldUseLegacyPdfExport };
