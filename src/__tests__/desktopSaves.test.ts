import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chooseSave } from '../state/saveCandidates';
import { defaultSave, SAVE_SCHEMA_VERSION } from '../state/saveSchema';

// Desktop save storage: the Electron main-process store (plain Node, tested here
// against a real temp directory) plus the renderer-side load policy.
 
const { createSaveStore, MAX_BYTES } = require('../../desktop/lib/saveStore');
 
const { createPrefs, sanitize } = require('../../desktop/lib/prefs');
 
const { resolveAppPath, mimeFor } = require('../../desktop/lib/paths');

let dir = '';
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'osdesk-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const save = (n: number) => JSON.stringify({ ...defaultSave(), totalKills: n, captainName: 'Cap', schemaVersion: SAVE_SCHEMA_VERSION });

describe('desktop save store (main process)', () => {
  test('a save persists across "restarts" (new store instance on the same directory)', async () => {
    const a = createSaveStore(dir);
    await a.save(save(5));
    const b = createSaveStore(dir);
    const [main] = await b.candidates();
    expect(chooseSave([main]).save?.totalKills).toBe(5);
  });

  test('saves live in the given user-data directory, not anywhere else', async () => {
    const s = createSaveStore(join(dir, 'userdata', 'saves'));
    await s.save(save(1));
    expect(s.file.startsWith(join(dir, 'userdata'))).toBe(true);
    expect(existsSync(s.file)).toBe(true);
  });

  test('each write keeps the previous good save as .bak and leaves no temp file behind', async () => {
    const s = createSaveStore(dir);
    await s.save(save(1));
    await s.save(save(2));
    expect(JSON.parse(readFileSync(s.file, 'utf8')).totalKills).toBe(2);
    expect(JSON.parse(readFileSync(s.file + '.bak', 'utf8')).totalKills).toBe(1);
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  test('an interrupted write (temp file left behind, crash before the rename) cannot destroy valid progress', async () => {
    const s = createSaveStore(dir);
    await s.save(save(7));
    writeFileSync(s.file + '.tmp', '{"truncated":');                // crash mid-write
    const fresh = createSaveStore(dir);
    const [main, bak] = await fresh.candidates();
    expect(chooseSave([main, bak]).save?.totalKills).toBe(7);
    await fresh.save(save(8));                                      // next save overwrites the stale temp safely
    expect(JSON.parse(readFileSync(fresh.file, 'utf8')).totalKills).toBe(8);
  });

  test('crash between "move main to .bak" and "move temp to main": the backup is used', async () => {
    const s = createSaveStore(dir);
    await s.save(save(3));
    await s.save(save(4));
    require('fs').rmSync(s.file);                                   // main missing, .bak (=3) and .tmp gone
    const [main, bak] = await createSaveStore(dir).candidates();
    expect(main).toBeNull();
    expect(chooseSave([main, bak]).save?.totalKills).toBe(3);
  });

  test('a corrupt main file falls back to the backup; with no backup it is quarantined, never overwritten', async () => {
    const s = createSaveStore(dir);
    await s.save(save(9));
    await s.save(save(10));
    writeFileSync(s.file, '\u0000garbage');
    let c = await s.candidates();
    expect(chooseSave(c).save?.totalKills).toBe(9);                 // .bak
    require('fs').rmSync(s.file + '.bak');
    c = await s.candidates();
    const r = chooseSave(c);
    expect(r.save).toBeNull();
    expect(r.quarantineMain).toBe(true);
    await s.quarantine();
    expect(existsSync(s.file + '.corrupt')).toBe(true);
    expect(readFileSync(s.file + '.corrupt', 'utf8')).toBe('\u0000garbage');   // evidence kept
    expect(existsSync(s.file)).toBe(false);
  });

  test('valid JSON that is not a valid save is rejected by the schema owner, not trusted', () => {
    expect(chooseSave(['{"foo":1}', null]).save).toEqual(expect.objectContaining({ schemaVersion: expect.any(Number) }));
    expect(chooseSave(['[1,2,3]', null]).save).toBeNull();
    expect(chooseSave(['not json', null]).save).toBeNull();
    expect(chooseSave([null, null])).toEqual({ save: null, quarantineMain: false });
  });

  test('overlapping saves are serialized: the last one wins, never interleaved', async () => {
    const s = createSaveStore(dir);
    await Promise.all(Array.from({ length: 25 }, (_, i) => s.save(save(i))));
    expect(JSON.parse(readFileSync(s.file, 'utf8')).totalKills).toBe(24);
    expect(() => JSON.parse(readFileSync(s.file + '.bak', 'utf8'))).not.toThrow();
  });

  test('a failed write does not poison later writes; invalid payloads are refused', async () => {
    const s = createSaveStore(dir);
    await expect(s.save('not json')).rejects.toThrow();
    await expect(s.save('x'.repeat(MAX_BYTES + 1))).rejects.toThrow();
    await s.save(save(11));
    expect(JSON.parse(readFileSync(s.file, 'utf8')).totalKills).toBe(11);
  });

  test('clear removes the save and its backups', async () => {
    const s = createSaveStore(dir);
    await s.save(save(1)); await s.save(save(2));
    await s.clear();
    expect(existsSync(s.file)).toBe(false);
    expect(existsSync(s.file + '.bak')).toBe(false);
  });

  test('progress survives an "application update": the install directory is never involved', async () => {
    const userData = join(dir, 'userData');
    await createSaveStore(join(userData, 'saves')).save(save(42));
    // a new app version is installed elsewhere; same per-user data dir
    const [main] = await createSaveStore(join(userData, 'saves')).candidates();
    expect(chooseSave([main]).save?.totalKills).toBe(42);
  });
});

describe('device preferences stay local and separate from the save', () => {
  test('stored in their own file; unknown / invalid values are dropped', () => {
    const p = createPrefs(dir);
    p.update({ fullscreen: true, promptStyle: 'switch', evil: '<script>', other: 1 });
    expect(createPrefs(dir).read()).toEqual({ fullscreen: true, promptStyle: 'switch' });
    expect(p.file).not.toContain('save');
    expect(sanitize({ promptStyle: 'toaster', fullscreen: 'yes' })).toEqual({});
  });
  test('a corrupt prefs file just resets to defaults', () => {
    writeFileSync(join(dir, 'desktop-prefs.json'), '{{{');
    expect(createPrefs(dir).read()).toEqual({});
  });
});

describe('app:// file serving (renderer cannot escape its root)', () => {
  const root = '/srv/app';
  test('serves files inside the root and index.html for /', () => {
    expect(resolveAppPath(root, '/')).toBe('/srv/app/index.html');
    expect(resolveAppPath(root, '/_expo/static/js/web/a.js')).toBe('/srv/app/_expo/static/js/web/a.js');
    expect(resolveAppPath(root, '/assets/assets/x%20y.glb')).toBe('/srv/app/assets/assets/x y.glb');
  });
  test('rejects traversal, encoded traversal, NULs and backslashes', () => {
    for (const bad of ['/../etc/passwd', '/%2e%2e/etc/passwd', '/a/../../etc/passwd', '/a%00b', '/a\\..\\b', '/%2e%2e%2f%2e%2e/x', '/%E0%A4%A']) {
      expect(resolveAppPath(root, bad)).toBeNull();
    }
  });
  test('mime types for the formats the game uses', () => {
    expect(mimeFor('a.glb')).toBe('model/gltf-binary');
    expect(mimeFor('a.wav')).toBe('audio/wav');
    expect(mimeFor('a.js')).toMatch(/javascript/);
    expect(mimeFor('a.unknown')).toBe('application/octet-stream');
  });
});

describe('Android isolation check (desktop code can never ship in the APK bundle)', () => {
  const { spawnSync } = require('child_process');
  const { mkdtempSync: mk, writeFileSync: wr, mkdirSync: mkd, rmSync: rm } = require('fs');
  const run = (bundleText: string, extraFile?: string) => {
    const d = mk(join(tmpdir(), 'andiso-'));
    mkd(join(d, '_expo/static/js/android'), { recursive: true });
    wr(join(d, '_expo/static/js/android/AppEntry-abc.hbc'), bundleText);
    wr(join(d, 'metadata.json'), '{}');
    if (extraFile) { mkd(join(d, 'assets'), { recursive: true }); wr(join(d, 'assets', extraFile), 'x'); }
    const r = spawnSync('node', [join(__dirname, '../../scripts/check-android-isolation.mjs'), d], { encoding: 'utf8' });
    rm(d, { recursive: true, force: true });
    return r;
  };
  test('a clean bundle passes', () => { expect(run('Game ship raft AUTO WEAPON').status).toBe(0); });
  test.each(['hotAttic', 'GLYPH_ASSETS', 'T_X_A_Color', 'NumpadEnter', 'gamepadconnected', '__oceanSporeStatus'])('a bundle containing "%s" is rejected', (s) => {
    const r = run(`...${s}...`);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/ANDROID ISOLATION FAILED/);
  });
  test('a glyph image in the export is rejected', () => { expect(run('clean', 'T_X_A_Color.abc.png').status).toBe(1); });
});

describe('Electron shell security configuration (static regression checks)', () => {
  const main = readFileSync(join(__dirname, '../../desktop/main.js'), 'utf8');
  const preload = readFileSync(join(__dirname, '../../desktop/preload.js'), 'utf8');
  test('renderer is sandboxed and isolated, with no Node integration', () => {
    expect(main).toMatch(/contextIsolation:\s*true/);
    expect(main).toMatch(/sandbox:\s*true/);
    expect(main).toMatch(/nodeIntegration:\s*false/);
    expect(main).toMatch(/webSecurity:\s*true/);
    expect(main).not.toMatch(/nodeIntegration:\s*true|contextIsolation:\s*false|webSecurity:\s*false|allowRunningInsecureContent/);
  });
  test('a strict CSP is sent on every app:// response and nothing remote can load', () => {
    expect(main).toMatch(/default-src 'none'/);
    expect(main).toMatch(/script-src 'self'/);
    expect(main).not.toMatch(/https?:\/\/(?!www\.electronjs\.org)/);              // no remote URLs in the shell
    expect(main).not.toMatch(/unsafe-eval/);
  });
  test('permissions are denied, navigation and new windows are blocked, IPC checks the sender', () => {
    expect(main).toMatch(/setPermissionRequestHandler\(\(_wc, _perm, cb\) => cb\(false\)\)/);
    expect(main).toMatch(/setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/);
    expect(main).toMatch(/will-navigate/);
    expect(main).toMatch(/untrusted sender/);
  });
  test('the preload exposes a frozen, narrow bridge (no raw ipcRenderer, no fs, no shell)', () => {
    expect(preload).toMatch(/Object\.freeze/);
    expect(preload).not.toMatch(/exposeInMainWorld\('[^']+',\s*ipcRenderer/);
    expect(preload).not.toMatch(/require\('(fs|child_process|path|os)'\)/);
    expect(main).not.toMatch(/shell\.openExternal|child_process/);
  });
  test('desktop builds are served from the app origin only and quit flushes pending saves', () => {
    expect(main).toMatch(/registerSchemesAsPrivileged/);
    expect(main).toMatch(/before-quit/);
    expect(main).toMatch(/store\.flush\(\)/);
  });
});
