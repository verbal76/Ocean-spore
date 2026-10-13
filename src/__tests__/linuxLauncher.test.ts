import { spawnSync } from 'child_process';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// The Linux launcher keeps the Chromium sandbox ON wherever the system can provide it
// and falls back (loudly) only when it cannot. Decisions are tested with fake `unshare`
// / `id` commands so every environment is reproducible without root or namespaces.
const LAUNCHER = join(__dirname, '../../desktop/launcher/ocean-spore.sh');

function run(opts: { uid: string; unshareWorks: boolean; setuidHelper?: boolean; env?: Record<string, string> }) {
  const dir = mkdtempSync(join(tmpdir(), 'launcher-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const fake = (name: string, body: string) => { writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`); chmodSync(join(bin, name), 0o755); };
  fake('id', `echo ${opts.uid}`);
  fake('unshare', opts.unshareWorks ? 'exit 0' : 'exit 1');
  const app = join(dir, 'app');
  mkdirSync(app);
  writeFileSync(join(app, 'ocean-spore.sh'), require('fs').readFileSync(LAUNCHER, 'utf8'));
  chmodSync(join(app, 'ocean-spore.sh'), 0o755);
  writeFileSync(join(app, 'OceanSpore'), '#!/bin/sh\n');
  if (opts.setuidHelper) { writeFileSync(join(app, 'chrome-sandbox'), ''); chmodSync(join(app, 'chrome-sandbox'), 0o4755); }
  const r = spawnSync('/bin/sh', [join(app, 'ocean-spore.sh'), '--fullscreen'], {
    encoding: 'utf8',
    env: { PATH: `${bin}:/usr/bin:/bin`, OCEAN_SPORE_DRY_RUN: '1', ...(opts.env ?? {}) },
  });
  rmSync(dir, { recursive: true, force: true });
  return r;
}

describe('Linux launcher sandbox policy', () => {
  test('normal user with user namespaces: sandbox stays ON, no bypass flag', () => {
    const r = run({ uid: '1000', unshareWorks: true });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/decision=sandbox/);
    expect(r.stdout).not.toMatch(/--no-sandbox/);
    expect(r.stdout).toMatch(/--fullscreen/);                         // arguments pass through
    expect(r.stderr).toBe('');
  });
  test('a setuid chrome-sandbox helper also keeps the sandbox on', () => {
    const r = run({ uid: '1000', unshareWorks: false, setuidHelper: true });
    expect(r.stdout).toMatch(/decision=sandbox/);
  });
  test('running as root: falls back and says why', () => {
    const r = run({ uid: '0', unshareWorks: true });
    expect(r.stdout).toMatch(/decision=no-sandbox/);
    expect(r.stdout).toMatch(/--no-sandbox/);
    expect(r.stderr).toMatch(/WITHOUT the Chromium sandbox: running as root/);
  });
  test('user namespaces unavailable (container / locked-down kernel): falls back and says why', () => {
    const r = run({ uid: '1000', unshareWorks: false });
    expect(r.stdout).toMatch(/decision=no-sandbox/);
    expect(r.stderr).toMatch(/user namespaces are not available/);
  });
  test('OCEAN_SPORE_SANDBOX=required refuses to start without a sandbox (exit 78)', () => {
    const r = run({ uid: '1000', unshareWorks: false, env: { OCEAN_SPORE_SANDBOX: 'required' } });
    expect(r.status).toBe(78);
    expect(r.stdout).not.toMatch(/exec=/);
    expect(r.stderr).toMatch(/sandbox is required but unavailable/);
  });
  test('OCEAN_SPORE_SANDBOX=required does not interfere when the sandbox works', () => {
    expect(run({ uid: '1000', unshareWorks: true, env: { OCEAN_SPORE_SANDBOX: 'required' } }).status).toBe(0);
  });
  test('the explicit opt-out is honoured and announced', () => {
    const r = run({ uid: '1000', unshareWorks: true, env: { OCEAN_SPORE_NO_SANDBOX: '1' } });
    expect(r.stdout).toMatch(/decision=no-sandbox/);
    expect(r.stderr).toMatch(/OCEAN_SPORE_NO_SANDBOX=1/);
  });
  test('the packager ships this exact launcher and the shell never disables security features globally', () => {
    const pkg = require('fs').readFileSync(join(__dirname, '../../scripts/desktop-package.mjs'), 'utf8');
    expect(pkg).toMatch(/launcher.*ocean-spore\.sh/s);
    const main = require('fs').readFileSync(join(__dirname, '../../desktop/main.js'), 'utf8');
    expect(main).not.toMatch(/no-sandbox|disable-web-security|disable-site-isolation|ignore-certificate|allow-running-insecure/);
    const launcherText = require('fs').readFileSync(LAUNCHER, 'utf8');
    expect(launcherText).not.toMatch(/disable-web-security|disable-site-isolation|disable-gpu-sandbox/);
  });
});
