import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcSvg = join(root, 'src/nodes/DocEngine/docengine.svg');
const destDir = join(root, 'dist/nodes/DocEngine');
const destSvg = join(destDir, 'docengine.svg');

mkdirSync(destDir, { recursive: true });
copyFileSync(srcSvg, destSvg);
console.log('copied docengine.svg');
