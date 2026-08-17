/**
 * Salesforce Static Resource build — classic IIFE for lightning/platformResourceLoader.
 *
 * Output: packages/editor/dist/editor-lwc.js
 * Exposes: window.DocEditor (named exports from packages/editor/src/sf-entry.ts,
 * including ophthalmologyCatalogs for commonListId / commonTreeId templates)
 * Bundles: @editorjs/editorjs (must be inlined — loadScript cannot resolve bare imports)
 *
 * PDF: client-side pdfmake + font VFS are stubbed (exceed 5 MB Static Resource limit).
 * Use Apex / pdf-service for PDF; see integrations/salesforce/ARCHITECTURE.md.
 *
 * Usage: vite build --config vite.config.sf.js
 * Or:    npm run build:sf
 */
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorSrc = path.resolve(__dirname, 'packages/editor/src');
const pdfSrc = path.resolve(__dirname, 'packages/pdf-renderer/src');

/** Redirect heavy PDF modules to SF stubs (Static Resource 5 MB cap). */
function sfPdfStubPlugin() {
  return {
    name: 'sf-pdf-stub',
    enforce: 'pre',
    resolveId(id) {
      const normalized = id.replace(/\\/g, '/');
      if (
        /export\/document-pdf(\.ts|\.js)?$/.test(normalized) &&
        !normalized.includes('sf-stub')
      ) {
        return path.resolve(editorSrc, 'export/document-pdf.sf-stub.ts');
      }
      if (
        /fonts-browser-vfs(\.js)?$/.test(normalized) &&
        !normalized.includes('sf-stub')
      ) {
        return path.resolve(pdfSrc, 'fonts-browser-vfs.sf-stub.js');
      }
      if (/pdf-renderer\/src\/browser(\.ts|\.js)?$/.test(normalized)) {
        return path.resolve(pdfSrc, 'browser.sf-stub.ts');
      }
      if (normalized.includes('pdfmake/build/pdfmake') || normalized.includes('pdfmake/build/vfs_fonts')) {
        return path.resolve(pdfSrc, 'pdfmake.sf-stub.js');
      }
      return null;
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [sfPdfStubPlugin()],
  resolve: {
    alias: [
      {
        find: '@docengine/pdf-renderer/browser',
        replacement: path.resolve(pdfSrc, 'browser.sf-stub.ts'),
      },
      {
        find: '@docengine/field-date',
        replacement: path.resolve(__dirname, 'packages/field-date/src/index.ts'),
      },
      {
        find: '@docengine/pdf-renderer',
        replacement: path.resolve(pdfSrc, 'browser.sf-stub.ts'),
      },
      {
        find: '@docengine/engine',
        replacement: path.resolve(__dirname, 'packages/engine/src/index.ts'),
      },
      {
        find: '@docengine/editor/node',
        replacement: path.resolve(editorSrc, 'node.ts'),
      },
      {
        find: /^@docengine\/editor\/(.*)/,
        replacement: `${editorSrc}/$1`,
      },
      {
        find: '@docengine/editor',
        replacement: path.resolve(editorSrc, 'index.ts'),
      },
    ],
  },
  build: {
    lib: {
      entry: path.resolve(editorSrc, 'sf-entry.ts'),
      name: 'DocEditor',
      formats: ['iife'],
      fileName: () => 'editor-lwc.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        extend: true,
      },
    },
    outDir: path.resolve(__dirname, 'packages/editor/dist'),
    emptyOutDir: false,
    sourcemap: true,
    minify: true,
  },
});
