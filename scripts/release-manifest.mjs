// Writes the release manifest: one source SHA and every platform artifact built
// from it. Usage: node scripts/release-manifest.mjs <apk> <out.json>
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

const [apk, out] = process.argv.slice(2);
if (!apk || !out) { console.error('usage: release-manifest.mjs <apk> <out.json>'); process.exit(2); }

const prov = JSON.parse(readFileSync('build-provenance.json', 'utf8'));
if (prov.dirty) { console.error('refusing to write a manifest for a dirty tree'); process.exit(1); }
const expected = process.env.EXPECTED_SHA;
if (expected && expected !== prov.commit) {
  console.error(`source mismatch: building ${prov.commit} but release expects ${expected}`);
  process.exit(1);
}

const manifest = {
  schema: 1,
  sourceCommit: prov.commit,
  sourceBranch: prov.branch,
  appVersion: prov.appVersion,
  versionCode: prov.versionCode,
  runtimeVersion: prov.runtimeVersion,
  builtAt: prov.builtAt,
  toolchain: prov.toolchain,
  artifacts: [{
    platform: prov.platform,
    configuration: prov.buildConfiguration,
    file: basename(apk),
    bytes: statSync(apk).size,
    sha256: createHash('sha256').update(readFileSync(apk)).digest('hex'),
  }],
};
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log(`release manifest: ${manifest.sourceCommit.slice(0, 7)} -> ${manifest.artifacts.map((a) => a.file).join(', ')}`);
