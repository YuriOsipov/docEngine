import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { PdfFontFamilyFiles, PdfFontSetup } from './types.js';
import { buildFontRegistry as buildRegistry } from './fonts-registry.js';

const require = createRequire(import.meta.url);
const dejavuRoot = dirname(require.resolve('dejavu-fonts-ttf/package.json'));

export const FONT_PRESETS: Record<string, PdfFontFamilyFiles & {
  bold: string;
  italics: string;
  bolditalics: string;
}> = {
  dejavu: {
    normal: join(dejavuRoot, 'ttf/DejaVuSans.ttf'),
    bold: join(dejavuRoot, 'ttf/DejaVuSans-Bold.ttf'),
    italics: join(dejavuRoot, 'ttf/DejaVuSans-Oblique.ttf'),
    bolditalics: join(dejavuRoot, 'ttf/DejaVuSans-BoldOblique.ttf'),
  },
};

export function buildFontRegistry(fontSetup?: PdfFontSetup) {
  return buildRegistry(FONT_PRESETS, fontSetup);
}
