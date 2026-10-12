// Proves the desktop work cannot leak into the Android build: the exported Android
// bundle must contain none of the desktop-only code or assets, and no glyph image.
// Usage: node scripts/check-android-isolation.mjs <expo android export dir>   (CI: dist-ci)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';

const dir = process.argv[2];
if (!dir || !existsSync(dir)) { console.error('usage: check-android-isolation.mjs <android export dir>'); process.exit(2); }

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(dir);
const bundles = files.filter((f) => /AppEntry-.*\.(hbc|js)$/.test(f));
if (bundles.length === 0) { console.error('no Android bundle found'); process.exit(1); }

// Strings that exist only in desktop modules (platform extensions .web.ts/.web.tsx).
// ('NumpadEnter' / 'gamepadconnected' only exist in the shared desktop input modules.)
const FORBIDDEN = ['hotAttic', 'GLYPH_ASSETS', 'T_X_A_Color', 'T_P5_Cross_Color', 'Key_White', 'hat-focus-style', 'hat-focus',
  'ocean-spore-desktop-prefs', 'loadSaveCandidates', '__oceanSporeStatus', 'NumpadEnter', 'gamepadconnected'];
const problems = [];
for (const b of bundles) {
  const data = readFileSync(b);
  for (const f of FORBIDDEN) if (data.includes(Buffer.from(f, 'latin1'))) problems.push(`${b.split('/').pop()} contains desktop-only string "${f}"`);
}
const glyphAssets = files.filter((f) => /glyphs|T_X_|T_P5_|Key_White/.test(f));
for (const g of glyphAssets) problems.push(`Android export contains a glyph asset: ${g}`);
if (readFileSync(join(dir, 'metadata.json'), 'utf8').includes('glyphs')) problems.push('metadata.json references glyphs');

if (problems.length) { console.error('ANDROID ISOLATION FAILED\n - ' + problems.join('\n - ')); process.exit(1); }
console.log(`android isolation OK: ${bundles.length} bundle(s), ${files.length} files, no desktop code or glyph assets`);
