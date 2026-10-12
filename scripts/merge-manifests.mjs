// Merges per-platform manifest parts into the single build-manifest.json and
// checksums.sha256 of a coordinated release. Fails (publishes nothing) unless EVERY
// part names the same source commit, build number and version, and no platform repeats.
// Usage: node scripts/merge-manifests.mjs --expect-sha <sha> --expect-platforms android,linux --out build-manifest.json --sums checksums.sha256 part1.json part2.json ...
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const take = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
const expectSha = take('--expect-sha');
const expectPlatforms = (take('--expect-platforms') || '').split(',').filter(Boolean);
const out = take('--out');
const sums = take('--sums');
const parts = argv;
const fail = (m) => { console.error(`MERGE REFUSED: ${m}`); process.exit(1); };
if (!out || !sums || parts.length === 0) fail('usage: --out <file> --sums <file> <part.json>...');

const loaded = parts.map((p) => JSON.parse(readFileSync(p, 'utf8')));
const first = loaded[0];
for (const m of loaded) {
  for (const k of ['sourceCommit', 'buildNumber', 'appVersion', 'versionCode', 'runtimeVersion', 'gameTitle']) {
    if (m[k] !== first[k]) fail(`parts disagree on ${k}: ${JSON.stringify(first[k])} vs ${JSON.stringify(m[k])}`);
  }
}
if (expectSha && first.sourceCommit !== expectSha) fail(`source ${first.sourceCommit} != approved ${expectSha}`);
const artifacts = loaded.flatMap((m) => m.artifacts);
const platforms = artifacts.map((a) => a.platform);
if (new Set(platforms).size !== platforms.length) fail(`a platform appears twice: ${platforms.join(',')}`);
if (expectPlatforms.length) {
  const missing = expectPlatforms.filter((p) => !platforms.includes(p));
  const extra = platforms.filter((p) => !expectPlatforms.includes(p));
  if (missing.length || extra.length) fail(`platforms built [${platforms}] != requested [${expectPlatforms}] (partial coordinated release is not allowed)`);
}
const merged = { ...first, artifacts, toolchain: Object.assign({}, ...loaded.map((m) => m.toolchain)) };
writeFileSync(out, JSON.stringify(merged, null, 2) + '\n');
writeFileSync(sums, artifacts.map((a) => `${a.sha256}  ${a.file}`).join('\n') + '\n');
console.log(`merged ${artifacts.length} artifact(s) for ${first.sourceCommit.slice(0, 7)}: ${platforms.join(', ')}`);
