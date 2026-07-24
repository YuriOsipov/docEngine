import { renderDocumentPreview } from '../fields/document-preview.js';
import {
  applyPageFormatCssVars,
  resolvePageContentWidthMm,
} from '../core/page-setup-styles.js';

/**
 * Mount an offscreen preview DOM tree for PDF conversion (browser only).
 * Sheet width matches the printable content area from pageSetup (format − side margins),
 * so DOM layout matches pdfmake's content box instead of a hardcoded 180mm.
 *
 * @param {import('../types.js').EditorDocument} doc
 * @param {import('../types.js').PdfExportOptions} [options]
 * @returns {{ preview: HTMLElement, cleanup: () => void }}
 */
export function mountPreviewDocumentForPdf(doc: any, options: any = {}) {
  const pageSetup = options.pageSetup ?? doc?.pageSetup ?? {};
  const contentWidthMm = resolvePageContentWidthMm(pageSetup);

  const mount = document.createElement('div');
  mount.className = 'preview-pdf-export';
  mount.setAttribute('aria-hidden', 'true');
  mount.style.position = 'fixed';
  mount.style.left = '-10000px';
  mount.style.top = '0';
  mount.style.opacity = '0';
  mount.style.pointerEvents = 'none';

  const sheet = document.createElement('div');
  sheet.className = 'preview-pdf-export__sheet';
  applyPageFormatCssVars(sheet, pageSetup);
  sheet.style.setProperty('--doc-page-content-width', `${contentWidthMm}mm`);
  sheet.style.width = `${contentWidthMm}mm`;
  sheet.style.maxWidth = `${contentWidthMm}mm`;

  const preview = renderDocumentPreview(doc, options);
  preview.classList.add('preview-document--pdf');
  sheet.appendChild(preview);
  mount.appendChild(sheet);
  document.body.appendChild(mount);

  return {
    preview,
    cleanup: () => {
      mount.remove();
    },
  };
}
