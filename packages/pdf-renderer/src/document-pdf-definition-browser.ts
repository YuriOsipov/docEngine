import { createRenderDocumentToPdfDefinition } from './document-pdf-definition-factory.js';
import { buildFontRegistry } from './fonts-browser-registry.js';

export const renderDocumentToPdfDefinition = createRenderDocumentToPdfDefinition(buildFontRegistry);
