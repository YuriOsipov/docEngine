import type { PdfFontFamilyFiles, PdfFontSetup } from './types.js';

type FontFiles = PdfFontFamilyFiles & {
  bold: string;
  italics: string;
  bolditalics: string;
};

const PDF_FONT_ALIASES: Record<string, string> = {
  inter: 'Inter',
  'ui-sans-serif': 'Inter',
  'system-ui': 'Inter',
  '-apple-system': 'Inter',
  blinkmacsystemfont: 'Inter',
  'helvetica neue': 'Inter',
  helvetica: 'Inter',
  tahoma: 'Inter',
  'segoe ui': 'Inter',
  arial: 'Inter',
  sans: 'Inter',
  'sans-serif': 'Inter',
  dejavu: 'dejavu',
  'dejavu sans': 'dejavu',
  roboto: 'Roboto',
};

/**
 * First family from a CSS font-family stack (quotes stripped, lowercased).
 */
export function primaryFontFamily(value: string | null | undefined): string {
  let raw = String(value ?? '').trim();
  if (!raw) return '';

  if (raw.includes(',')) {
    raw = raw.split(',')[0].trim();
  }

  if (/^['"].*['"]$/.test(raw)) {
    raw = raw.slice(1, -1).trim();
  }

  return raw.toLowerCase();
}

function lookupPdfFont(
  name: string,
  fonts: Record<string, FontFiles>,
  defaultFont: string,
): string {
  const raw = String(name ?? '').trim().toLowerCase();
  if (!raw) return defaultFont;

  const alias = PDF_FONT_ALIASES[raw];
  if (alias && fonts[alias]) return alias;
  if (fonts[raw]) return raw;
  for (const key of Object.keys(fonts)) {
    if (key.toLowerCase() === raw) return key;
  }
  return defaultFont;
}

export function buildFontRegistry(
  presets: Record<string, FontFiles>,
  fontSetup: PdfFontSetup = {},
) {
  const requestedPreset = String(fontSetup.preset ?? 'Inter');
  const requestedLower = requestedPreset.toLowerCase();
  // Case-insensitive preset lookup so 'Inter', 'inter', 'Roboto', 'roboto' all resolve correctly.
  const presetEntry = Object.entries(presets).find(([k]) => k.toLowerCase() === requestedLower);
  const preset = presetEntry?.[1] ?? presets.Roboto ?? presets.dejavu;
  const defaultFont = fontSetup.defaultFont ?? (presetEntry ? presetEntry[0] : 'Roboto');

  const fonts: Record<string, FontFiles> = {
    [defaultFont]: { ...preset },
  };

  if (fontSetup.families) {
    for (const [family, files] of Object.entries(fontSetup.families)) {
      fonts[family] = {
        normal: files.normal,
        bold: files.bold ?? files.normal,
        italics: files.italics ?? files.normal,
        bolditalics: files.bolditalics ?? files.bold ?? files.normal,
      };
    }
  }

  function resolveFontName(name?: string | null): string {
    const raw = String(name ?? '').trim();
    if (!raw) return defaultFont;

    const primary = primaryFontFamily(raw);
    if (primary) {
      const resolved = lookupPdfFont(primary, fonts, defaultFont);
      if (resolved !== defaultFont || PDF_FONT_ALIASES[primary] || fonts[primary]) {
        return resolved;
      }
    }

    return lookupPdfFont(raw.toLowerCase(), fonts, defaultFont);
  }

  return { fonts, defaultFont, resolveFontName };
}
