import { readFileSync } from 'fs';
import { join } from 'path';
import { COLORS } from '../colors';
import { BRAND_SPLASH_TIMING, BRAND_SPLASH_TOTAL_MS, FIRST_SCREEN, initialScreen, SCREEN_AFTER_BRAND } from '../app/launchFlow';

const yaml = require('js-yaml');
const ROOT = join(__dirname, '../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const appJson = JSON.parse(read('app.json')).expo;
const wf = (name: string) => yaml.load(read(`.github/workflows/${name}`));

describe('release identity and permissions (app.json)', () => {
  test('stable package, portrait, dark', () => {
    expect(appJson.android.package).toBe('com.verbal76.oceanspore');
    expect(appJson.orientation).toBe('portrait');
    expect(appJson.userInterfaceStyle).toBe('dark');
  });

  test('dangerous / unneeded permissions stay blocked (storage, overlay, microphone, foreground service)', () => {
    const blocked: string[] = appJson.android.blockedPermissions;
    for (const p of [
      'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'SYSTEM_ALERT_WINDOW',
      'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    ]) expect(blocked).toContain(`android.permission.${p}`);
  });

  test('the audio-service manifest trimmer is installed', () => {
    expect(appJson.plugins).toContain('./plugins/with-trim-audio-manifest');
  });

  test('runtimeVersion is an explicit string that moved off the historical 1.0.0 (old installs get no new OTAs)', () => {
    expect(typeof appJson.runtimeVersion).toBe('string');
    expect(appJson.runtimeVersion).not.toBe('1.0.0');
  });

  test('native splash matches the app background (no white flash between native and the studio card)', () => {
    const splash = appJson.plugins.find((p: any) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
    expect(splash.backgroundColor).toBe(COLORS.bg);
    expect(appJson.backgroundColor).toBe(COLORS.bg);
  });
});

describe('no accidental OTA publication', () => {
  const eas = wf('eas-update.yml');

  test('the OTA workflow can only be started by hand', () => {
    expect(Object.keys(eas.on)).toEqual(['workflow_dispatch']);
  });

  test('it demands the runtime version be retyped, and CI must pass first', () => {
    expect(eas.on.workflow_dispatch.inputs.runtime_version.required).toBe(true);
    expect(eas.jobs.update.needs).toBe('ci');
  });

  test('the Expo token is exposed only to the publish step, never job-wide', () => {
    expect(eas.jobs.update.env).toBeUndefined();
    const publish = eas.jobs.update.steps.find((s: any) => s.name === 'Publish update');
    expect(publish.env.EXPO_TOKEN).toBeDefined();
    for (const s of eas.jobs.update.steps) if (s !== publish) expect(JSON.stringify(s.env ?? {})).not.toContain('secrets.OCEAN');
  });

  test('workflow inputs are never interpolated into shell (injection)', () => {
    const publish = wf('eas-update.yml').jobs.update.steps.find((s: any) => s.name === 'Publish update');
    expect(publish.run).not.toMatch(/\$\{\{\s*(github\.event\.)?inputs\./);
  });
});

describe('APK publishing is deliberate', () => {
  const apk = wf('android-build.yml');
  test('the release job needs dispatch(publish) or the publish-apk label', () => {
    const cond: string = apk.jobs.release.if;
    expect(cond).toMatch(/workflow_dispatch/);
    expect(cond).toMatch(/publish-apk/);
    expect(cond).not.toMatch(/event_name == 'push'/);
  });
  test('default permissions are read-only; only the release job may write', () => {
    expect(apk.permissions).toEqual({ contents: 'read' });
    expect(apk.jobs.release.permissions).toEqual({ contents: 'write' });
    expect(apk.jobs.build.permissions).toBeUndefined();
  });
  test('the 16 KB and manifest gates are blocking steps in the build', () => {
    const steps = apk.jobs.build.steps.map((s: any) => s.name);
    expect(steps).toContain('Manifest qualification');
    expect(steps).toContain('16 KB page-size qualification');
    const sixteen = apk.jobs.build.steps.find((s: any) => s.name === '16 KB page-size qualification');
    expect(sixteen.env.ENFORCE_16KB).toBe('true');
  });
});

describe('Actions budget policy (nothing builds on a plain push)', () => {
  const apk = wf('android-build.yml');
  const ci = wf('ci.yml');
  const hasKey = (o: any, k: string) => Object.prototype.hasOwnProperty.call(o ?? {}, k);

  test('the APK build has no push trigger and PRs only act on a label', () => {
    expect(hasKey(apk.on, 'push')).toBe(false);
    expect(apk.on.pull_request.types).toEqual(['labeled']);
    expect(apk.jobs.ci.if).toMatch(/workflow_dispatch/);
    expect(apk.jobs.ci.if).toMatch(/publish-apk/);
  });
  test('the shared CI workflow is only called or dispatched, never push/PR triggered', () => {
    expect(hasKey(ci.on, 'push')).toBe(false);
    expect(hasKey(ci.on, 'pull_request')).toBe(false);
  });
  test('prune-artifacts has no schedule or workflow_run trigger', () => {
    const prune = wf('prune-artifacts.yml');
    expect(Object.keys(prune.on)).toEqual(['workflow_dispatch']);
  });
  test('the APK artifact is short-lived and npm is cached', () => {
    const up = apk.jobs.build.steps.find((s: any) => s.uses?.startsWith('actions/upload-artifact'));
    expect(up.with['retention-days']).toBeLessThanOrEqual(1);
    const node = apk.jobs.build.steps.find((s: any) => s.uses?.startsWith('actions/setup-node'));
    expect(node.with.cache).toBe('npm');
  });
  test('the policy is recorded in CLAUDE.md and `npm run verify` exists', () => {
    expect(read('CLAUDE.md')).toMatch(/budget policy/i);
    expect(JSON.parse(read('package.json')).scripts.verify).toMatch(/jest|npm test/);
  });
});

describe('launch sequence (native -> Hot Attic Games -> Ocean Spore -> game)', () => {
  test('a cold launch shows the studio card first, then the title', () => {
    expect(initialScreen(0)).toBe(FIRST_SCREEN);
    expect(FIRST_SCREEN).toBe('brand');
    expect(SCREEN_AFTER_BRAND).toBe('splash');
  });

  test('the studio card is never replayed after a recovered crash', () => {
    for (const n of [1, 2, 10]) expect(initialScreen(n)).toBe('splash');
  });

  test('card timing is intentional and the failsafe outlasts it', () => {
    expect(BRAND_SPLASH_TIMING).toEqual({ fadeInMs: 450, holdMs: 1100, fadeOutMs: 350 });
    expect(BRAND_SPLASH_TOTAL_MS).toBe(1900);
  });
});
