import {
  generateDocumentPdfBlob as legacyGenerateDocumentPdfBlob,
  generateDocumentPdfBlobFromPreview,
  shouldUseLegacyPdfExport,
} from '@docengine/pdf-renderer/browser';
import { saveBlobToDisk } from '../utils/save-blob.js';
import { resolvePreviewExportOptions } from './preview-export-options.js';
import { mountPreviewDocumentForPdf } from './preview-pdf-mount.js';

/** False in the Salesforce Static Resource build (pdfmake stubbed). */
export const isClientPdfAvailable = true;

/**
 * @param {import('../types.d.ts').EditorDocument} doc
 * @param {import('../types.d.ts').PdfExportOptions} [options]
 * @returns {Promise<Blob>}
 */
export async function generateDocumentPdfBlob(doc: any,options: any = {}) {
  try {
    const exportOptions = resolvePreviewExportOptions(doc, options);

    if (shouldUseLegacyPdfExport(doc)) {
      return await legacyGenerateDocumentPdfBlob(doc, exportOptions);
    }

    const { preview, cleanup } = mountPreviewDocumentForPdf(doc, exportOptions);
    try {
      return await generateDocumentPdfBlobFromPreview(doc, preview, exportOptions);
    } finally {
      cleanup();
    }
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message ? `PDF export failed: ${message}` : 'PDF export failed.');
  }
}

/**
 * @param {import('../types.d.ts').EditorDocument} doc
 * @param {import('../types.d.ts').PdfExportOptions} [options]
 */
export async function exportDocumentPdf(doc: any,options: any = {}) {
  const { download = true, filename = 'document.pdf' } = options;
  const blob = await generateDocumentPdfBlob(doc, options);

  if (download) {
    await saveBlobToDisk(blob, filename, 'application/pdf');
  }

  return blob;
}
