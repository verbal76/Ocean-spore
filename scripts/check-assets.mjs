// Asset integrity gate. Every GLB the game requires (src/render3d/assets.ts)
// plus colormap.png must exist and match assets/bundled-assets.sha256, which
// was generated from the files proven byte-identical to the ones inside the
// original build-39 APK. Fails on missing, changed, or unlisted-but-required
// assets, and on referenced-but-missing files.
//
//   node scripts/check-assets.mjs            verify
//   node scripts/check-assets.mjs --update   regenerate the manifest (deliberate asset change)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const MANIFEST = 'assets/bundled-assets.sha256';
const src = readFileSync('src/render3d/assets.ts', 'utf8');
const required = new Set(
  [...src.matchAll(/require\('\.\.\/\.\.\/(assets\/[^']+)'\)/g)].map((m) => m[1]),
);
required.add('assets/colormap.png');

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const problems = [];

for (const p of required) if (!existsSync(p)) problems.push(`missing: ${p}`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const current = [...required].sort().map((p) => `${sha(p)}  ${p}`);

if (process.argv.includes('--update')) {
  writeFileSync(MANIFEST, current.join('\n') + '\n');
  console.log(`wrote ${MANIFEST} (${current.length} assets)`);
  process.exit(0);
}

const expected = new Map(
  readFileSync(MANIFEST, 'utf8').trim().split('\n').map((l) => { const [h, p] = l.split(/\s+/); return [p, h]; }),
);
for (const line of current) {
  const [h, p] = line.split(/\s+/);
  if (!expected.has(p)) problems.push(`required but not in manifest: ${p}`);
  else if (expected.get(p) !== h) problems.push(`changed: ${p}`);
}
for (const p of expected.keys()) if (!required.has(p)) problems.push(`in manifest but no longer required: ${p}`);

if (problems.length) { console.error('ASSET CHECK FAILED\n' + problems.map((x) => ' - ' + x).join('\n')); process.exit(1); }
console.log(`asset check OK: ${current.length} bundled assets match the manifest`);
