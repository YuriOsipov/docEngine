import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ─── DejaVu (from npm package) ──────────────────────────────────────────────
const dejavuRoot = path.dirname(require.resolve('dejavu-fonts-ttf/package.json'));
const ttfDir = path.join(dejavuRoot, 'ttf');

const dejavuFiles = [
  'DejaVuSans.ttf',
  'DejaVuSans-Bold.ttf',
  'DejaVuSans-Oblique.ttf',
  'DejaVuSans-BoldOblique.ttf',
];

// ─── Inter (downloaded from Google Fonts) ───────────────────────────────────
/** Cache directory for downloaded Inter TTF files. */
const interCacheDir = path.join(__dirname, '../fonts/inter');

/**
 * Map of VFS filename → explicit ital,wght axis spec for Google Fonts CSS v2.
 * ital=0 → normal, ital=1 → italic.
 */
const INTER_VARIANTS = [
  { file: 'Inter-Regular.ttf',    ital: 0, wght: 400 },
  { file: 'Inter-Bold.ttf',       ital: 0, wght: 700 },
  { file: 'Inter-Italic.ttf',     ital: 1, wght: 400 },
  { file: 'Inter-BoldItalic.ttf', ital: 1, wght: 700 },
];

/**
 * Fetch a URL and return the body as a Buffer.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Node.js/build-script' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(fetchBuffer(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Parse a Google Fonts CSS2 response and return the TTF src URL for the
 * @font-face block matching the given ital (0=normal, 1=italic) and wght.
 * @param {string} css
 * @param {0 | 1} ital
 * @param {number} wght
 * @returns {string | null}
 */
function parseTtfUrl(css, ital, wght) {
  // Split on @font-face blocks and find the one matching our style/weight.
  const blocks = css.split(/@font-face\s*\{/);
  const targetStyle = ital === 1 ? 'italic' : 'normal';
  const targetWeight = String(wght);

  for (const block of blocks) {
    const styleMatch = block.match(/font-style:\s*(\w+)/i);
    const weightMatch = block.match(/font-weight:\s*(\d+)/i);
    if (!styleMatch || !weightMatch) continue;
    if (styleMatch[1].toLowerCase() !== targetStyle) continue;
    if (weightMatch[1] !== targetWeight) continue;

    const urlMatch = block.match(/src:\s*url\(([^)]+\.ttf)\)/i);
    if (urlMatch) return urlMatch[1];
  }
  return null;
}

/**
 * Download an Inter TTF variant and cache it locally.
 * @param {{ file: string, ital: 0 | 1, wght: number }} variant
 * @returns {Promise<string>} path to the cached file
 */
async function downloadInterVariant(variant) {
  const cachePath = path.join(interCacheDir, variant.file);
  if (fs.existsSync(cachePath)) {
    // Validate by re-fetching if the file seems too small (likely wrong variant).
    const existing = fs.readFileSync(cachePath);
    if (existing.length > 10000) {
      console.log(`  ✓ cached  ${variant.file}`);
      return cachePath;
    }
    console.log(`  ! re-fetching ${variant.file} (cached file may be wrong variant)`);
  }

  console.log(`  ↓ fetching ${variant.file} (ital=${variant.ital} wght=${variant.wght}) …`);
  // Use Google Fonts CSS v2 API with explicit ital,wght axes.
  const spec = `ital,wght@${variant.ital},${variant.wght}`;
  const cssUrl = `https://fonts.googleapis.com/css2?family=Inter:${encodeURIComponent(spec)}`;
  const css = (await fetchBuffer(cssUrl)).toString('utf-8');
  const ttfUrl = parseTtfUrl(css, variant.ital, variant.wght);
  if (!ttfUrl) throw new Error(`Could not find TTF URL for ital=${variant.ital} wght=${variant.wght} in: ${css.slice(0, 300)}`);

  const buf = await fetchBuffer(ttfUrl);
  fs.mkdirSync(interCacheDir, { recursive: true });
  fs.writeFileSync(cachePath, buf);
  console.log(`  ✓ saved   ${variant.file} (${(buf.length / 1024).toFixed(1)} kB)`);
  return cachePath;
}

// ─── Build VFS ──────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, '../src/fonts-browser-vfs.js');

/** @type {Record<string, string>} */
const vfs = {};

// Embed DejaVu
for (const fileName of dejavuFiles) {
  const buf = fs.readFileSync(path.join(ttfDir, fileName));
  vfs[fileName] = buf.toString('base64');
}
console.log(`DejaVu: embedded ${dejavuFiles.length} fonts`);

// Embed Inter
console.log('Inter: downloading TTF variants from Google Fonts …');
let interOk = true;
try {
  for (const variant of INTER_VARIANTS) {
    const filePath = await downloadInterVariant(variant);
    const buf = fs.readFileSync(filePath);
    vfs[variant.file] = buf.toString('base64');
  }
  console.log(`Inter: embedded ${INTER_VARIANTS.length} fonts`);
} catch (err) {
  interOk = false;
  console.warn(`Inter: skipped (${err.message}). Only DejaVu will be embedded.`);
}

const source = `// Generated by scripts/build-browser-vfs.mjs — do not edit
export const DEJAVU_BROWSER_VFS = ${JSON.stringify(vfs)};
export const INTER_AVAILABLE = ${interOk};
`;

fs.writeFileSync(outPath, source);
console.log(`\nWrote ${outPath} (${Object.keys(vfs).length} fonts total)`);
