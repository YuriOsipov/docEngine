import { createRenderDocumentToPdfDefinitionFromPreview } from './document-pdf-definition-preview.js';
import { buildFontRegistry } from './fonts.js';

export const renderDocumentToPdfDefinitionFromPreview =
  createRenderDocumentToPdfDefinitionFromPreview(buildFontRegistry);
