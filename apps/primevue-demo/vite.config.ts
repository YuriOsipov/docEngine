import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: [
      {
        find: '@docengine/field-date',
        replacement: path.resolve(__dirname, '../../packages/field-date/src/index.ts'),
      },
      {
        find: '@docengine/engine',
        replacement: path.resolve(__dirname, '../../packages/engine/src/index.ts'),
      },
      {
        find: '@docengine/editor/styles.css',
        replacement: path.resolve(__dirname, '../../packages/editor/src/styles/editor.css'),
      },
      {
        find: '@docengine/editor/themes/bridge.css',
        replacement: path.resolve(__dirname, '../../packages/editor/src/themes/bridge.css'),
      },
      {
        find: '@docengine/editor/themes/prime.css',
        replacement: path.resolve(__dirname, '../../packages/editor/src/themes/prime.css'),
      },
      {
        find: '@docengine/editor/themes/slds.css',
        replacement: path.resolve(__dirname, '../../packages/editor/src/themes/slds.css'),
      },
      {
        find: '@docengine/editor/node',
        replacement: path.resolve(__dirname, '../../packages/editor/src/node.ts'),
      },
      {
        find: '@docengine/editor/ui/field-form-modal',
        replacement: path.resolve(
          __dirname,
          '../../packages/editor/src/ui/field-form-modal.ts',
        ),
      },
      {
        find: '@docengine/editor/ui/wire-modal-palette',
        replacement: path.resolve(
          __dirname,
          '../../packages/editor/src/ui/wire-modal-palette.ts',
        ),
      },
      {
        find: /^@docengine\/editor\/(.*)/,
        replacement: `${path.resolve(__dirname, '../../packages/editor/src')}/$1`,
      },
      {
        find: '@docengine/editor',
        replacement: path.resolve(__dirname, '../../packages/editor/src/index.ts'),
      },
    ],
  },
  server: {
    port: 5174,
  },
});
