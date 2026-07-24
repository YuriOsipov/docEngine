import { createRenderDocumentToPdfDefinition } from './document-pdf-definition-factory.js';
import { buildFontRegistry } from './fonts.js';

export const renderDocumentToPdfDefinition = createRenderDocumentToPdfDefinition(buildFontRegistry);
