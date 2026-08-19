import { createRenderDocumentToPdfDefinition } from './document-pdf-definition-factory.js';
import { buildFontRegistry } from './fonts-browser-registry.js';
import { ensurePreviewFieldPlugins } from './preview-field-plugins.js';
import type { EditorDocument, PdfRenderOptions } from './types.js';

const render = createRenderDocumentToPdfDefinition(buildFontRegistry);

export function renderDocumentToPdfDefinition(
  doc: EditorDocument,
  options: PdfRenderOptions = {},
) {
  ensurePreviewFieldPlugins();
  return render(doc, options);
}
