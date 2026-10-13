// Launches the REAL desktop shell (unpackaged `electron .` or a packaged Linux build)
// under a virtual display, plays through title -> ship select -> gameplay -> pause with
// the keyboard, and records frame pacing, memory, a screenshot and the save file.
// Software-rendered (SwiftShader) in CI-less environments: numbers show it works, not
// hardware performance. Usage:
//   node scripts/desktop-smoke.mjs [--packaged <dir containing OceanSpore>] [--out <dir>] [--seconds 150]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const packaged = arg('packaged');
const out = resolve(arg('out', 'dist-desktop/smoke'));
const limit = Number(arg('seconds', '150'));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const userData = mkdtempSync(join(tmpdir(), 'ocean-spore-smoke-'));
mkdirSync(join(userData, 'saves'), { recursive: true });
writeFileSync(join(userData, 'saves', 'ocean-spore-save.json'), JSON.stringify({
  unlockedShips: ['raft'], highScore: 0, totalKills: 0, totalParts: 0, lastShip: 'raft',
  captainName: 'Smoke Tester', soundEnabled: true, schemaVersion: 2,
}));

// Chromium refuses to run its sandbox as root, so the harness bypasses it ONLY then (this
// is a property of the root test environment, not of the product launcher).
const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
if (asRoot) console.log('[smoke] running as root: Chromium sandbox bypassed for this test run only');
const flags = [...(asRoot ? ['--no-sandbox'] : []), '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  `--user-data-dir=${userData}`, `--smoke=${out}`];
const bin = packaged ? join(resolve(packaged), 'OceanSpore') : resolve('desktop/node_modules/.bin/electron');
const args = packaged ? flags : [resolve('desktop'), ...flags];
if (!existsSync(bin)) { console.error(`missing ${bin}`); process.exit(2); }
const useXvfb = !process.env.DISPLAY;
const cmd = useXvfb ? 'xvfb-run' : bin;
const cmdArgs = useXvfb ? ['-a', '-s', '-screen 0 1280x800x24', bin, ...args] : args;

const child = spawn(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', (d) => { log += d; });
child.stderr.on('data', (d) => { log += d; });
const timer = setTimeout(() => { console.error('smoke timed out'); child.kill('SIGKILL'); }, limit * 1000);
child.on('exit', (code, signal) => {
  clearTimeout(timer);
  writeFileSync(join(out, 'smoke.log'), log);
  for (const l of log.split('\n')) if (l.includes('[smoke]')) console.log(l.slice(0, 300));
  const rep0 = join(out, 'smoke-report.json');
  if (!existsSync(rep0)) {
    // No report means the app died before the smoke ran: show why (CI only prints this script's stdout).
    console.log(`[smoke] no report written (exit=${code}, signal=${signal}); last application output:`);
    console.log(log.split('\n').slice(-60).join('\n'));
  }
  const rep = join(out, 'smoke-report.json');
  const ok = existsSync(rep) && JSON.parse(readFileSync(rep, 'utf8')).ok === true;
  const saved = existsSync(join(userData, 'saves', 'ocean-spore-save.json'));
  console.log(`exit=${code} report.ok=${ok} saveFilePresent=${saved}`);
  rmSync(userData, { recursive: true, force: true });
  process.exit(ok && code === 0 ? 0 : 1);
});
