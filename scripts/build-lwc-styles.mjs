/**
 * Concatenate editor + bridge + SLDS theme into one CSS file for LWC Static Resources.
 *
 * Usage: node scripts/build-lwc-styles.mjs
 * Output: packages/editor/dist/editor-lwc.css
 *
 * Strips npm-style @import '@fontsource/…' (and similar) — those resolve in Vite apps
 * but break lightning/platformResourceLoader when served as a Static Resource.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pkg = path.join(root, 'packages/editor');
const outDir = path.join(pkg, 'dist');
const outFile = path.join(outDir, 'editor-lwc.css');

const parts = [
  path.join(pkg, 'src/styles/editor.css'),
  path.join(pkg, 'src/themes/bridge.css'),
  path.join(pkg, 'src/themes/slds.css'),
];

/**
 * Drop package imports that cannot load from /resource/.../DocEngineCss.
 * Note: Inter is intentionally NOT bundled — the LWC uses the standard
 * Salesforce font (via --lwc-fontFamily) so it blends with Lightning.
 */
function sanitizeForStaticResource(css) {
  return css
    .replace(/^@import\s+['"][^'"]+['"]\s*;\s*\n?/gm, '')
    .replace(/^@import\s+url\([^)]+\)\s*;\s*\n?/gm, '');
}

const banner = `/* @docengine/editor LWC bundle — generated, do not edit */\n`;

mkdirSync(outDir, { recursive: true });

const css =
  banner +
  parts
    .map((file) => sanitizeForStaticResource(readFileSync(file, 'utf8')))
    .join('\n\n');
writeFileSync(outFile, css, 'utf8');

console.log(`Wrote ${outFile} (${(css.length / 1024).toFixed(1)} KB)`);
