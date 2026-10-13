// Release body from the merged manifest: what is in the release and exactly how far
// each platform was verified. Honest by construction: only claims what the workflow does.
import { readFileSync } from 'node:fs';

const [manifestPath] = process.argv.slice(2);
const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
const VERIFIED = {
  android: 'APK qualified in CI (package id, versionCode, target SDK 36, permission allowlist, 16 KB, signing identity). Not tested on a physical device.',
  linux: 'Packaged native x86-64 build launched under a virtual display in CI (software rendering): title -> play -> pause with keyboard input, 15/15 models rendered, save written, clean exit. Not tested on a Steam Deck or a physical PC.',
  windows: 'Packaged Windows x86-64 build (PE executable verified). NOT launched on Windows: execution is unverified.',
};
const lines = [
  `${m.gameTitle} Build ${m.buildNumber}`, '',
  `Source: \`${m.sourceCommit}\``,
  `Runtime: \`${m.runtimeVersion}\``, '',
  '| Platform | File | SHA-256 | Verification |', '|---|---|---|---|',
  ...m.artifacts.map((a) => `| ${a.platform} | ${a.file} | \`${a.sha256}\` | ${VERIFIED[a.platform] ?? ''} |`),
  '',
  'Playtest build. Not an OTA; nothing is pushed to installed apps. Android is signed with the Expo debug keystore (not a Play upload key). See `build-manifest.json` and `checksums.sha256`.',
];
console.log(lines.join('\n'));
