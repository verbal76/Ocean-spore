import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Behavioural tests for the release source guard and the branch audit, against
// throwaway git repositories (no network, no real history required).

const ROOT = join(__dirname, '../..');
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
};

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
