// Kopiert die Excalidraw-Schriften nach public/excalidraw, damit Boards offline gleich aussehen.
// Die große chinesische Schrift (Xiaolai) bleibt draußen; dafür springt die Systemschrift ein.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const source = 'node_modules/@excalidraw/excalidraw/dist/prod/fonts';
const target = 'public/excalidraw/fonts';
if (!existsSync(source)) throw new Error('Excalidraw ist nicht installiert (npm install)');
rmSync('public/excalidraw', { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const family of readdirSync(source)) {
  if (family === 'Xiaolai') continue;
  cpSync(join(source, family), join(target, family), { recursive: true });
}
console.log('Excalidraw-Schriften kopiert');
