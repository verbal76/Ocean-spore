// Writes ONE platform's manifest part (and its checksum line) for a built artifact:
// the source SHA, versions and the artifact's SHA-256 / size. Usage:
//   EXPECTED_SHA=<approved full sha> node scripts/release-manifest.mjs <artifact> <part.json> <checksums.sha256> [--platform android|linux|windows]
// With EXPECTED_SHA it also proves the artifact itself was built from that commit:
//   android: the APK's JS bundle embeds the SHA (BUILD_INFO)
//   linux / windows: the packaged build-provenance.json names the SHA
// scripts/merge-manifests.mjs then merges the parts into the single build-manifest.json.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

const args = process.argv.slice(2);
const pi = args.indexOf('--platform');
const platform = pi >= 0 ? args.splice(pi, 2)[1] : 'android';
const [artifact, out, sums] = args;
if (!artifact || !out || !sums || !['android', 'linux', 'windows'].includes(platform)) {
  console.error('usage: release-manifest.mjs <artifact> <part.json> <checksums.sha256> [--platform android|linux|windows]');
  process.exit(2);
}

const prov = JSON.parse(readFileSync('build-provenance.json', 'utf8'));
if (prov.dirty) { console.error('refusing to write a manifest for a dirty tree'); process.exit(1); }
const expected = process.env.EXPECTED_SHA;
if (expected && expected !== prov.commit) {
  console.error(`source mismatch: building ${prov.commit} but release expects ${expected}`);
  process.exit(1);
}

const extract = (cmd, a) => execFileSync(cmd, a, { maxBuffer: 512 * 1024 * 1024 });
if (expected) {
  if (platform === 'android') {
    const bundle = extract('unzip', ['-p', artifact, 'assets/index.android.bundle']);
    if (!bundle.includes(Buffer.from(expected, 'ascii'))) {
      console.error(`the APK bundle does not embed approved SHA ${expected.slice(0, 7)}`);
      process.exit(1);
    }
  } else {
    // The packaged app carries the provenance it was built from.
    let embedded = '';
    try {
      if (platform === 'linux') {
        const list = extract('tar', ['-tzf', artifact]).toString().split('\n');
        const entry = list.find((l) => l.endsWith('resources/app/app/build-provenance.json'));
        if (entry) embedded = extract('tar', ['-xzOf', artifact, entry]).toString();
      } else {
        const list = extract('unzip', ['-Z1', artifact]).toString().split('\n');
        const entry = list.find((l) => l.endsWith('resources/app/app/build-provenance.json'));
        if (entry) embedded = extract('unzip', ['-p', artifact, entry]).toString();
      }
    } catch (e) { console.error(`cannot inspect ${artifact}: ${e.message}`); process.exit(1); }
    let commit = '';
    try { commit = JSON.parse(embedded).commit; } catch { /* handled below */ }
    if (commit !== expected) {
      console.error(`the ${platform} package does not carry approved SHA ${expected.slice(0, 7)} (found ${String(commit).slice(0, 7) || 'none'})`);
      process.exit(1);
    }
  }
}

const sha256 = createHash('sha256').update(readFileSync(artifact)).digest('hex');
const part = {
  schema: 2,
  gameTitle: process.env.GAME_TITLE || 'Ocean Spore',
  buildNumber: prov.versionCode,
  sourceCommit: prov.commit,
  approvedSha: expected || null,
  sourceBranch: prov.branch,
  appVersion: prov.appVersion,
  versionCode: prov.versionCode,
  runtimeVersion: prov.runtimeVersion,
  builtAt: prov.builtAt,
  toolchain: prov.toolchain,
  artifacts: [{
    platform,
    configuration: prov.buildConfiguration,
    file: basename(artifact),
    bytes: statSync(artifact).size,
    sha256,
  }],
};
writeFileSync(out, JSON.stringify(part, null, 2) + '\n');
writeFileSync(sums, `${sha256}  ${basename(artifact)}\n`);
console.log(`manifest part: ${platform} ${part.sourceCommit.slice(0, 7)} -> ${part.artifacts[0].file}`);
