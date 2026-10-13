import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync , readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';


// Behavioural tests for the release source guard and the branch audit, against
// throwaway git repositories (no network, no real history required).

const ROOT = join(__dirname, '../..');
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};
 
const yaml = require('js-yaml');
const wfSteps = (file: string, job: string) => yaml.load(readFileSync(join(ROOT, '.github/workflows', file), 'utf8')).jobs[job].steps;

let dir = '';
const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { env: GIT_ENV, encoding: 'utf8' }).trim();
const commit = (msg: string) => { writeFileSync(join(dir, 'f.txt'), msg + Math.random()); git('add', '-A'); git('commit', '-qm', msg); return git('rev-parse', 'HEAD'); };
/** Pretend a local branch is a pushed origin branch. */
const publish = (branch: string, sha: string) => git('update-ref', `refs/remotes/origin/${branch}`, sha);

function writeConfig(extra: Record<string, unknown> = {}) {
  const cfg = {
    authoritativeLine: { branches: ['line'] },
    forbiddenBuildRefs: [{ ref: 'legacy', why: 'auto-OTA' }],
    historicalBaselines: [],
    ledger: [],
    ...extra,
  };
  const p = join(dir, '..', `cfg-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(p, JSON.stringify(cfg));
  return p;
}
const guard = (args: string[], env: Record<string, string> = {}, cfg = writeConfig()) =>
  spawnSync('python3', [join(ROOT, 'scripts/check-source-line.py'), '--repo', dir, '--config', cfg, ...args],
    { env: { ...GIT_ENV, GITHUB_HEAD_REF: '', GITHUB_REF_NAME: '', BUILD_REF: '', APPROVED_SHA: '', ...env }, encoding: 'utf8' });
const audit = (args: string[] = [], cfg = writeConfig()) =>
  spawnSync('python3', [join(ROOT, 'scripts/audit-branches.py'), '--repo', dir, '--config', cfg, ...args],
    { env: { ...GIT_ENV, GITHUB_ACTIONS: '' }, encoding: 'utf8' });

let base = '', tip = '', side = '';
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'srcline-'));
  git('init', '-q', '-b', 'line');
  base = commit('base');
  tip = commit('line tip');
  publish('line', tip);
  git('checkout', '-q', '-b', 'exp', base);          // an unrelated experimental branch
  side = commit('experiment');
  publish('exp', side);
  git('checkout', '-q', 'line');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('release source authorization (exact SHA)', () => {
  test('accepts the approved SHA when HEAD is exactly it and it is on the line', () => {
    const r = guard(['--release', '--approved-sha', tip]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/release source OK/);
  });
  test('accepts an approved SHA that is an ancestor of the line tip (recovery/maintenance builds)', () => {
    git('checkout', '-q', base);
    expect(guard(['--release', '--approved-sha', base]).status).toBe(0);
  });
  test('rejects a checkout whose HEAD differs from the approved SHA', () => {
    const r = guard(['--release', '--approved-sha', base]);          // HEAD is tip
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/!= approved SHA/);
  });
  test('rejects a commit that is not on the authorized line, even if it shares history', () => {
    git('checkout', '-q', 'exp');
    const r = guard(['--release', '--approved-sha', side]);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/not on the authorized development line/);
  });
  test('never substitutes a branch for an explicit SHA (names and short SHAs rejected)', () => {
    for (const bad of ['line', 'origin/line', tip.slice(0, 7), '']) {
      const r = guard(['--release', '--approved-sha', bad]);
      expect(r.status).toBe(1);
      expect(r.stdout).toMatch(/full 40-hex/);
    }
  });
  test('rejects a forbidden build ref even with a valid SHA', () => {
    const r = guard(['--release', '--approved-sha', tip], { BUILD_REF: 'legacy' });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/forbidden/);
  });
  test('shallow clones cannot be authorized', () => {
    const shallow = mkdtempSync(join(tmpdir(), 'srcline-sh-'));
    try {
      execFileSync('git', ['clone', '-q', '--depth', '1', `file://${dir}`, shallow], { env: GIT_ENV });
      const sha = execFileSync('git', ['-C', shallow, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      const r = spawnSync('python3', [join(ROOT, 'scripts/check-source-line.py'), '--repo', shallow, '--config', writeConfig(), '--release', '--approved-sha', sha],
        { env: { ...GIT_ENV, BUILD_REF: '', GITHUB_HEAD_REF: '', GITHUB_REF_NAME: '' }, encoding: 'utf8' });
      expect(r.status).toBe(1);
      expect(r.stdout).toMatch(/shallow/);
    } finally { rmSync(shallow, { recursive: true, force: true }); }
  });
  test('line membership is configurable without rewriting history (add a branch later)', () => {
    git('checkout', '-q', 'exp');
    const cfg = writeConfig({ authoritativeLine: { branches: ['line', 'exp'] } });
    expect(guard(['--release', '--approved-sha', side], {}, cfg).status).toBe(0);
  });
});

describe('manifest / release metadata provenance', () => {
  const manifest = (over: Record<string, unknown> = {}) => {
    const p = join(dir, '..', `m-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(p, JSON.stringify({ sourceCommit: tip, approvedSha: tip, artifacts: [{ platform: 'android', sha256: 'ab', file: 'a.apk' }], ...over }));
    return p;
  };
  test('accepts a manifest naming the approved SHA', () => {
    expect(guard(['--verify-manifest', manifest(), '--approved-sha', tip]).status).toBe(0);
  });
  test('rejects a manifest for a different commit', () => {
    const r = guard(['--verify-manifest', manifest({ sourceCommit: base }), '--approved-sha', tip]);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/sourceCommit/);
  });
  test('rejects a manifest whose approvedSha differs, an empty artifact list, and an unreadable file', () => {
    expect(guard(['--verify-manifest', manifest({ approvedSha: base }), '--approved-sha', tip]).status).toBe(1);
    expect(guard(['--verify-manifest', manifest({ artifacts: [] }), '--approved-sha', tip]).status).toBe(1);
    expect(guard(['--verify-manifest', join(dir, 'nope.json'), '--approved-sha', tip]).status).toBe(1);
  });
});

describe('release immutability (build numbers are not reused)', () => {
  const unused = (v: string) => spawnSync('python3', [join(ROOT, 'scripts/check-version-unused.py'), v, '--repo', dir], { encoding: 'utf8' });
  test('an unreleased build number passes', () => {
    expect(unused('42').status).toBe(0);
  });
  test('the standard build-N tag is refused too', () => {
    git('tag', 'build-50', tip);
    expect(unused('50').status).toBe(1);
  });
  test('a build number whose tag exists is refused', () => {
    git('tag', 'v41', tip);
    const r = unused('41');
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/ALREADY RELEASED/);
    expect(unused('42').status).toBe(0);
  });
  test('the APK build runs the check before any expensive step, and OTA publishing is gated to the line', () => {
    const apk = JSON.parse(JSON.stringify(wfSteps('android-build.yml', 'build-android')));
    const names = apk.map((s: any) => s.name);
    expect(names.indexOf('Build number valid and unused')).toBeGreaterThan(-1);
    expect(names.indexOf('Build number valid and unused')).toBeLessThan(names.indexOf('Install dependencies'));
    const eas = wfSteps('eas-update.yml', 'update').map((s: any) => s.name);
    expect(eas.indexOf('Verify approved source SHA')).toBeGreaterThan(-1);
    expect(eas.indexOf('Verify approved source SHA')).toBeLessThan(eas.indexOf('Publish update'));
  });
});

describe('manifest verified against the packaged files', () => {
  const sha = (b: string) => require('crypto').createHash('sha256').update(b).digest('hex');
  const setup = (content = 'apk-bytes', fileOverride?: string) => {
    const d = mkdtempSync(join(tmpdir(), 'rel-'));
    writeFileSync(join(d, 'Game Build 1 APK.apk'), fileOverride ?? content);
    const m = { sourceCommit: tip, approvedSha: tip, artifacts: [{ platform: 'android', file: 'Game Build 1 APK.apk', bytes: content.length, sha256: sha(content) }] };
    writeFileSync(join(d, 'build-manifest.json'), JSON.stringify(m));
    writeFileSync(join(d, 'checksums.sha256'), `${sha(content)}  Game Build 1 APK.apk\n`);
    return d;
  };
  const run = (d: string) => guard(['--verify-manifest', join(d, 'build-manifest.json'), '--files-dir', d, '--approved-sha', tip]);
  test('matching files, sizes and checksums pass', () => {
    const d = setup();
    try { expect(run(d).status).toBe(0); } finally { rmSync(d, { recursive: true, force: true }); }
  });
  test('a file altered after the manifest was written is rejected', () => {
    const d = setup('apk-bytes', 'apk-BYTES');
    try { const r = run(d); expect(r.status).toBe(1); expect(r.stdout).toMatch(/SHA-256 differs/); } finally { rmSync(d, { recursive: true, force: true }); }
  });
  test('a missing artifact or checksums file is rejected', () => {
    const d = setup();
    rmSync(join(d, 'checksums.sha256'));
    try { expect(run(d).stdout).toMatch(/checksums\.sha256 missing/); } finally { rmSync(d, { recursive: true, force: true }); }
    const e = setup();
    rmSync(join(e, 'Game Build 1 APK.apk'));
    try { expect(run(e).stdout).toMatch(/artifact missing/); } finally { rmSync(e, { recursive: true, force: true }); }
  });
});

describe('branch audit is separate: reports, never gates', () => {
  test('an unaccounted branch does NOT block a release...', () => {
    expect(guard(['--release', '--approved-sha', tip]).status).toBe(0);
  });
  test('...but the audit still detects it (warning; --strict fails)', () => {
    const r = audit();
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/origin\/exp has 1 commit\(s\) outside the line and is not in the ledger/);
    expect(r.stdout).toMatch(/UNACCOUNTED/);
    expect(audit(['--strict']).status).toBe(1);
  });
  test('ledgered branches are quiet; a ledgered branch that moves is flagged', () => {
    const ledgered = writeConfig({ ledger: [{ ref: 'origin/exp', tip: side, classification: 'x', disposition: 'y' }] });
    expect(audit(['--strict'], ledgered).status).toBe(0);
    git('checkout', '-q', 'exp');
    publish('exp', commit('experiment moved'));
    git('checkout', '-q', 'line');
    const r = audit(['--strict'], ledgered);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/moved .* since it was ledgered/);
  });
  test('missing historical baselines are reported', () => {
    const r = audit([], writeConfig({ historicalBaselines: [{ name: 'gone', sha: 'f'.repeat(40) }] }));
    expect(r.stdout).toMatch(/historical baseline missing/);
  });
  test('the real repository ledger is currently clean', () => {
    const r = spawnSync('python3', [join(ROOT, 'scripts/audit-branches.py')], { cwd: ROOT, encoding: 'utf8' });
    expect(r.stdout).toMatch(/branch audit:/);
  });
});

describe('coordinated multi-platform manifests (one SHA, no partial releases)', () => {
  const { mkdtempSync: mk, writeFileSync: wr, readFileSync: rd, rmSync: rm } = require('fs');
  const part = (platform: string, over: Record<string, unknown> = {}) => ({
    schema: 2, gameTitle: 'Ocean Spore', buildNumber: 42, sourceCommit: 'a'.repeat(40), appVersion: '42', versionCode: 42,
    runtimeVersion: '2.1.0', toolchain: { node: 'v22' },
    artifacts: [{ platform, file: `Ocean Spore Build 42 ${platform}.bin`, bytes: 3, sha256: platform.padEnd(64, '0') }], ...over,
  });
  const merge = (parts: object[], extra: string[] = []) => {
    const d = mk(join(tmpdir(), 'merge-'));
    const files = parts.map((p, i) => { const f = join(d, `p${i}.json`); wr(f, JSON.stringify(p)); return f; });
    const r = spawnSync('node', [join(ROOT, 'scripts/merge-manifests.mjs'), '--out', join(d, 'm.json'), '--sums', join(d, 's.txt'), ...extra, ...files], { encoding: 'utf8' });
    const merged = r.status === 0 ? JSON.parse(rd(join(d, 'm.json'), 'utf8')) : null;
    const sums = r.status === 0 ? rd(join(d, 's.txt'), 'utf8') : '';
    rm(d, { recursive: true, force: true });
    return { r, merged, sums };
  };
  const SHA = 'a'.repeat(40);

  test('three platforms from one SHA merge into one manifest + checksums', () => {
    const { r, merged, sums } = merge([part('android'), part('windows'), part('linux')], ['--expect-sha', SHA, '--expect-platforms', 'android,windows,linux']);
    expect(r.status).toBe(0);
    expect(merged.artifacts.map((a: any) => a.platform).sort()).toEqual(['android', 'linux', 'windows']);
    expect(sums.trim().split('\n')).toHaveLength(3);
  });
  test('a part built from a different commit is refused (no silent source substitution)', () => {
    const r = merge([part('android'), part('linux', { sourceCommit: 'b'.repeat(40) })], ['--expect-sha', SHA]);
    expect(r.r.status).toBe(1);
    expect(r.r.stderr).toMatch(/disagree on sourceCommit/);
  });
  test('the approved SHA must match', () => {
    expect(merge([part('android')], ['--expect-sha', 'c'.repeat(40)]).r.status).toBe(1);
  });
  test('a missing platform is a partial release and is refused', () => {
    const r = merge([part('android')], ['--expect-platforms', 'android,windows,linux']);
    expect(r.r.status).toBe(1);
    expect(r.r.stderr).toMatch(/partial coordinated release/);
  });
  test('an unrequested extra platform is refused too', () => {
    expect(merge([part('android'), part('linux')], ['--expect-platforms', 'android']).r.status).toBe(1);
  });
  test('parts with different build numbers or duplicate platforms are refused', () => {
    expect(merge([part('android'), part('linux', { buildNumber: 43 })]).r.status).toBe(1);
    expect(merge([part('android'), part('android')]).r.status).toBe(1);
  });
});
