import type { PdfFontSetup } from './types.js';
import { BROWSER_FONT_PRESETS } from './fonts-browser.js';
import { buildFontRegistry as buildRegistry } from './fonts-registry.js';

export function buildFontRegistry(fontSetup?: PdfFontSetup) {
  return buildRegistry(BROWSER_FONT_PRESETS as any, fontSetup);
}

export { BROWSER_FONT_PRESETS };
