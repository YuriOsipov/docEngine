/**
 * Build Salesforce Static Resource artifacts and copy into apps/salesforce/force-app.
 *
 * Produces:
 *   packages/editor/dist/editor-lwc.css  (editor + bridge + SLDS)
 *   packages/editor/dist/editor-lwc.js   (IIFE, window.DocEditor, EditorJS inlined)
 *   packages/editor/dist/pdf-viewer/    (zipped → DocEnginePdfViewer)
 *
 * Copies into:
 *   apps/salesforce/force-app/main/default/staticresources/DocEngineCss.resource
 *   apps/salesforce/force-app/main/default/staticresources/DocEngineBundle.resource
 *   apps/salesforce/force-app/main/default/staticresources/DocEnginePdfViewer.resource
 *
 * Usage: node scripts/build-sf.mjs
 * Or:    npm run build:sf
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  rmSync,
  cpSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'packages/editor/dist');
const staticDir = path.join(root, 'apps/salesforce/force-app/main/default/staticresources');
const viewerSrcDir = path.join(root, 'packages/editor/src/sf-pdf-viewer');
const viewerDistDir = path.join(dist, 'pdf-viewer');

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function writeMeta(name, contentType) {
  const metaPath = path.join(staticDir, `${name}.resource-meta.xml`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
    <cacheControl>Public</cacheControl>
    <contentType>${contentType}</contentType>
</StaticResource>
`;
  writeFileSync(metaPath, xml, 'utf8');
}

console.log('→ Building LWC CSS bundle…');
run('node', ['scripts/build-lwc-styles.mjs']);

console.log('→ Building Salesforce IIFE JS bundle…');
run('npx', ['vite', 'build', '--config', 'vite.config.sf.js']);

console.log('→ Building DocEnginePdfViewer Static Resource…');
rmSync(viewerDistDir, { recursive: true, force: true });
mkdirSync(viewerDistDir, { recursive: true });
copyFileSync(path.join(viewerSrcDir, 'viewer.html'), path.join(viewerDistDir, 'viewer.html'));
run('npx', [
  'esbuild',
  path.join(viewerSrcDir, 'main.ts'),
  '--bundle',
  '--format=iife',
  '--platform=browser',
  `--outfile=${path.join(viewerDistDir, 'viewer.js')}`,
  '--minify',
]);

const cssSrc = path.join(dist, 'editor-lwc.css');
const jsSrc = path.join(dist, 'editor-lwc.js');

if (!existsSync(cssSrc)) {
  console.error(`Missing ${cssSrc}`);
  process.exit(1);
}
if (!existsSync(jsSrc)) {
  console.error(`Missing ${jsSrc}`);
  process.exit(1);
}

mkdirSync(staticDir, { recursive: true });

const cssDest = path.join(staticDir, 'DocEngineCss.resource');
const jsDest = path.join(staticDir, 'DocEngineBundle.resource');
const viewerZip = path.join(staticDir, 'DocEnginePdfViewer.resource');
const viewerZipTmp = path.join(dist, 'DocEnginePdfViewer.zip');

copyFileSync(cssSrc, cssDest);
copyFileSync(jsSrc, jsDest);
writeMeta('DocEngineCss', 'text/css');
writeMeta('DocEngineBundle', 'application/javascript');

rmSync(viewerZipTmp, { force: true });
rmSync(viewerZip, { force: true });
const zipResult = spawnSync(
  'powershell',
  [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${viewerDistDir}\\*' -DestinationPath '${viewerZipTmp}' -Force`,
  ],
  { cwd: root, stdio: 'inherit' },
);
if (zipResult.status !== 0) {
  process.exit(zipResult.status ?? 1);
}
cpSync(viewerZipTmp, viewerZip);
writeMeta('DocEnginePdfViewer', 'application/zip');

const cssKb = (readFileSync(cssSrc).length / 1024).toFixed(1);
const jsKb = (readFileSync(jsSrc).length / 1024).toFixed(1);
const viewerKb = (readFileSync(viewerZip).length / 1024).toFixed(1);

console.log(`✓ DocEngineCss        → ${cssDest} (${cssKb} KB)`);
console.log(`✓ DocEngineBundle     → ${jsDest} (${jsKb} KB)`);
console.log(`✓ DocEnginePdfViewer  → ${viewerZip} (${viewerKb} KB)`);
console.log('Done. Deploy with: sf project deploy start --source-dir apps/salesforce/force-app');
