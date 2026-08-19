/**
 * Salesforce Static Resource stub — client-side PDF is not bundled.
 *
 * pdfmake + embedded fonts exceed the 5 MB Static Resource limit.
 * PDF generation for Salesforce should use Apex (DocEnginePdfController) or a
 * remote PDF service (apps/pdf-service). Hosts can pass `generatePdfBlob`
 * to createEditor for preview / export.
 */

/** Client pdfmake is not in the SF bundle. */
export const isClientPdfAvailable = false;

export async function generateDocumentPdfBlob(_doc, _options = {}) {
  throw new Error(
    'Client-side PDF is not available in the Salesforce bundle. ' +
      'Configure Named Credential DocEngine_Pdf (DocEngine.pro /api/v1/render/pdf) and use Apex DocEnginePdfController, ' +
      'or pass generatePdfBlob to createEditor.',
  );
}

export async function exportDocumentPdf(_doc, _options = {}) {
  return generateDocumentPdfBlob(_doc, _options);
}
