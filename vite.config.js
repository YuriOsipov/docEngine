import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname),
  resolve: {
    alias: [
      {
        find: '@docengine/field-date',
        replacement: path.resolve(__dirname, 'packages/field-date/src/index.ts'),
      },
      {
        find: '@docengine/editor/styles.css',
        replacement: path.resolve(__dirname, 'packages/editor/src/styles/editor.css'),
      },
      {
        find: '@docengine/pdf-renderer/browser',
        replacement: path.resolve(__dirname, 'packages/pdf-renderer/src/browser.ts'),
      },
      {
        find: '@docengine/pdf-renderer',
        replacement: path.resolve(__dirname, 'packages/pdf-renderer/src/index.ts'),
      },
      {
        find: '@docengine/editor/node',
        replacement: path.resolve(__dirname, 'packages/editor/src/node.ts'),
      },
      {
        find: '@docengine/editor',
        replacement: path.resolve(__dirname, 'packages/editor/src/index.ts'),
      },
      {
        find: /^@docengine\/editor\/(.*)/,
        replacement: `${path.resolve(__dirname, 'packages/editor/src')}/$1`,
      },
    ],
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'packages/editor/src/index.ts'),
      name: 'DocEditor',
      formats: ['es'],
      fileName: 'editor',
    },
    rollupOptions: {
      external: ['@editorjs/editorjs'],
      output: {
        inlineDynamicImports: true,
        globals: {
          '@editorjs/editorjs': 'EditorJS',
        },
      },
    },
    outDir: path.resolve(__dirname, 'packages/editor/dist'),
    emptyOutDir: true,
  },
});
