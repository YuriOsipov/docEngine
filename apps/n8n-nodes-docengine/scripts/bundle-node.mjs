import * as esbuild from 'esbuild';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** CJS bundles have no import.meta.url; createRequire() accepts __filename. */
const cjsImportMetaUrlPlugin = {
  name: 'cjs-import-meta-url',
  setup(build) {
    build.onLoad({ filter: /[\\/]pdf-renderer[\\/]dist[\\/]fonts\.js$/ }, async (args) => ({
      contents: (await readFile(args.path, 'utf8')).replaceAll('import.meta.url', '__filename'),
      loader: 'js',
    }));
  },
};

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['src/nodes/DocEngine/DocEngine.node.ts'],
  outfile: 'dist/nodes/DocEngine/DocEngine.node.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: false,
  logLevel: 'info',
  plugins: [cjsImportMetaUrlPlugin],
  // n8n loads community nodes with require(); keep host + native/fs packages external.
  external: ['n8n-workflow', 'pdfmake', 'dejavu-fonts-ttf', 'linkedom'],
  define: {
    'import.meta.env.VITE_UPLOAD_BASE_URL': '""',
    'import.meta.env.VITE_IMAGE_UPLOAD_STUB': 'true',
  },
});

console.log('bundled DocEngine.node.cjs');
