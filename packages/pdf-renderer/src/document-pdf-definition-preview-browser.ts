import { createRenderDocumentToPdfDefinitionFromPreview } from './document-pdf-definition-preview.js';
import { buildFontRegistry } from './fonts-browser-registry.js';

export const renderDocumentToPdfDefinitionFromPreview =
  createRenderDocumentToPdfDefinitionFromPreview(buildFontRegistry);
