// Builds the desktop packages from the SAME source tree as the Android build:
//   1. expo export --platform web      (the unmodified game, shared src/)
//   2. @electron/packager              (linux-x64 and/or win32-x64 folders)
//   3. archive with the studio names   "Ocean Spore Build N Linux.tar.gz" / "... EXE.zip"
// Usage: node scripts/desktop-package.mjs --platform linux|windows|all --out <dir> [--skip-export]
// Nothing is published; output stays in <dir>. Run `npm ci` in desktop/ first.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, chmodSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { currentVersion } = require('./version.js');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const platform = arg('platform', 'linux');
const out = resolve(arg('out', 'dist-desktop'));
if (!['linux', 'windows', 'all'].includes(platform)) { console.error(`unknown --platform ${platform}`); process.exit(2); }

const root = resolve('.');
const desk = join(root, 'desktop');
const v = currentVersion();
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });

if (!existsSync(join(desk, 'node_modules', '@electron', 'packager'))) {
  console.error('desktop/ dependencies missing: run `npm ci` inside desktop/'); process.exit(1);
}

// 1. The game: same source, web target.
const appDir = join(desk, 'app');
if (!process.argv.includes('--skip-export')) {
  rmSync(appDir, { recursive: true, force: true });
  run('node', ['scripts/write-build-info.mjs']);
  run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', appDir], { env: { ...process.env, EXPO_NO_TELEMETRY: '1' } });
}
if (!existsSync(join(appDir, 'index.html'))) { console.error('web export missing'); process.exit(1); }
if (existsSync(join(root, 'build-provenance.json'))) cpSync(join(root, 'build-provenance.json'), join(appDir, 'build-provenance.json'));

// 2. Package.
const { packager } = await import(join(desk, 'node_modules', '@electron', 'packager', 'dist', 'index.js'));
const electronVersion = JSON.parse(readFileSync(join(desk, 'node_modules', 'electron', 'package.json'), 'utf8')).version;
const targets = platform === 'all' ? ['linux', 'windows'] : [platform];
const pkgOut = join(out, 'packages');
mkdirSync(pkgOut, { recursive: true });
const results = [];

for (const t of targets) {
  const electronPlatform = t === 'windows' ? 'win32' : 'linux';
  const [dir] = await packager({
    dir: desk, out: pkgOut, name: 'Ocean Spore', executableName: 'OceanSpore',
    platform: electronPlatform, arch: 'x64', electronVersion, overwrite: true, prune: true,
    ignore: [/^\/node_modules($|\/)/, /^\/launcher($|\/)/, /^\/package-lock\.json$/, /^\/\.gitignore$/],
    asar: false,                                    // plain files: easy to inspect/diff, no unpack steps
    quiet: true,
  });
  if (t === 'linux') {
    // The sandbox-aware launcher (desktop/launcher/ocean-spore.sh): sandbox ON where the system allows it.
    cpSync(join(desk, 'launcher', 'ocean-spore.sh'), join(dir, 'ocean-spore.sh'));
    chmodSync(join(dir, 'ocean-spore.sh'), 0o755);
    chmodSync(join(dir, 'OceanSpore'), 0o755);
  }
  results.push({ target: t, dir });
}

// 3. Archive with the standard names.
const files = [];
for (const { target, dir } of results) {
  const base = dir.split('/').pop();
  if (target === 'linux') {
    const name = v.linuxFileName;
    run('tar', ['--sort=name', '--owner=0', '--group=0', '--numeric-owner', '-czf', join(out, name), '-C', pkgOut, base]);
    files.push({ platform: 'linux', name });
  } else {
    const name = v.exeFileName;
    rmSync(join(out, name), { force: true });
    run('zip', ['-qr', join(out, name), base], { cwd: pkgOut });
    files.push({ platform: 'windows', name });
  }
}
console.log(JSON.stringify({ out, files }, null, 2));
void readdirSync;
