import { readFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
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

describe('native release publishing is deliberate', () => {
  const nb = wf('android-build.yml');
  const jobSteps = (j: string) => nb.jobs[j].steps as any[];
  test('only a manual dispatch plans a build; dispatch defaults to local_only (a label is not authorization)', () => {
    expect(nb.jobs.plan.if).toBe("github.event_name == 'workflow_dispatch'");
    expect(nb.on.workflow_dispatch.inputs.destination.default).toBe('local_only');
    expect(nb.jobs.release.if).toMatch(/destination == 'github_releases'/);
  });
  test('dispatch inputs follow the studio standard (platform, source_sha, build_number, destination)', () => {
    const i = nb.on.workflow_dispatch.inputs;
    expect(i.platform.options).toEqual(['android', 'windows', 'linux', 'all']);
    expect(i.source_sha.required).toBe(true);
    expect(i.build_number.required).toBe(true);
    expect(i.destination.options).toEqual(['local_only', 'github_releases']);
  });
  test('the plan rejects anything but a full SHA, a numeric build and a known platform', () => {
    const plan: string = jobSteps('plan')[0].run;
    expect(plan).toMatch(/\{40\}/);
    expect(plan).toMatch(/Unknown platform/);
    expect(plan).toMatch(/exit 1/);
    for (const p of ['android', 'windows', 'linux', 'all']) expect(plan).toContain(`${p})`);
  });
  test('every selected platform has a build job; "all" builds exactly android + windows + linux', () => {
    expect(nb.jobs['build-android'].if).toMatch(/android == 'true'/);
    expect(nb.jobs['build-desktop'].if).toMatch(/desktop == 'true'/);
    expect(jobSteps('plan')[0].run).toMatch(/all\)\s+A=true;\s+D=true;\s+DP=all;\s+PL=android,windows,linux/);
  });
  test('no partial coordinated release: assemble needs every SELECTED build to succeed; release needs assemble', () => {
    const cond: string = nb.jobs.assemble.if;
    expect(cond).toMatch(/needs\.build-android\.result == 'success'/);
    expect(cond).toMatch(/needs\.build-desktop\.result == 'success'/);
    expect(nb.jobs.release.needs).toContain('assemble');
    expect(nb.jobs.release.needs).not.toContain('build-android');
    const merge = jobSteps('assemble').find((s) => /merge-manifests/.test(s.run ?? ''));
    expect(merge.run).toMatch(/--expect-sha/);
    expect(merge.run).toMatch(/--expect-platforms/);
  });
  test('local_only publishes nothing: only the release job can create a Release, and only for github_releases', () => {
    const creators = Object.entries(nb.jobs).filter(([, j]: [string, any]) => JSON.stringify(j).includes('action-gh-release')).map(([k]) => k);
    expect(creators).toEqual(['release']);
  });
  test('releases use the standard title, tag and asset set, and never overwrite', () => {
    const pub = jobSteps('release').find((s) => s.name === 'Publish');
    const files: string = pub.with.files;
    for (const f of ['*.apk', '*.zip', '*.tar.gz', 'build-manifest.json', 'checksums.sha256']) expect(files).toContain(f);
    expect(pub.with.tag_name).toMatch(/steps\.rel\.outputs\.tag/);
    expect(pub.with.name).toMatch(/steps\.rel\.outputs\.title/);
    const rn = JSON.stringify(nb.jobs.release);
    expect(rn).toMatch(/--verify-manifest/);                               // release re-checks manifest vs files
    expect(rn).toMatch(/sha256sum -c/);
    for (const j of ['build-android', 'build-desktop']) {
      expect(jobSteps(j).some((s) => /check-build-number/.test(s.run ?? ''))).toBe(true);   // tag/release must be unused
    }
  });
  test('default permissions are read-only; only the release job may write; secrets only there', () => {
    expect(nb.permissions).toEqual({ contents: 'read' });
    expect(nb.jobs.release.permissions).toEqual({ contents: 'write' });
    for (const j of ['plan', 'ci', 'build-android', 'build-desktop', 'assemble']) expect(nb.jobs[j].permissions).toBeUndefined();
    expect((JSON.stringify(nb).match(/secrets\./g) ?? []).length).toBe(1);
  });
  test('the 16 KB and manifest gates are blocking steps in the Android build; Windows is checked as a PE file', () => {
    const steps = jobSteps('build-android').map((s) => s.name);
    expect(steps).toContain('Manifest qualification');
    expect(steps).toContain('16 KB page-size qualification');
    expect(jobSteps('build-android').find((s) => s.name === '16 KB page-size qualification').env.ENFORCE_16KB).toBe('true');
    expect(JSON.stringify(jobSteps('build-desktop'))).toMatch(/PE32\+ executable \(GUI\) x86-64/);
    expect(JSON.stringify(jobSteps('build-desktop'))).toMatch(/desktop-smoke\.mjs --packaged/);
  });
  test('desktop builds come from the same source: one export of src/, no second implementation', () => {
    const pkg = read('scripts/desktop-package.mjs');
    expect(pkg).toMatch(/expo.*export.*--platform.*web/s);
    expect(pkg).toMatch(/linux/);
    expect(pkg).toMatch(/win32/);
  });
});

describe('no ordinary repository event can build or publish', () => {
  const fs = require('fs');
  const files: string[] = fs.readdirSync(join(ROOT, '.github/workflows'));
  test.each(files)('%s is only manually or programmatically triggered', (f: string) => {
    const w = wf(f);
    const triggers = Object.keys(w.on ?? (w as any)['true'] ?? {});
    for (const t of triggers) expect(['workflow_dispatch', 'workflow_call']).toContain(t);
  });
  test('the publish-apk label exists nowhere in workflows, docs or instructions as a trigger', () => {
    for (const f of files) expect(read(`.github/workflows/${f}`)).not.toMatch(/publish-apk/);
    expect(read('CLAUDE.md')).not.toMatch(/label.*(is|as) the working trigger/i);
  });
  test('publishing credentials are scoped to the publishing job/step only', () => {
    const apkW = wf('android-build.yml');
    expect(apkW.permissions).toEqual({ contents: 'read' });
    expect(Object.keys(apkW.jobs).filter((j) => apkW.jobs[j].permissions)).toEqual(['release']);
    const eas = JSON.stringify(wf('eas-update.yml'));
    expect((eas.match(/secrets\./g) ?? []).length).toBe(1);
  });
});

describe('single source of truth (docs/source-line.json)', () => {
  const line = JSON.parse(read('docs/source-line.json'));
  const run = (env: Record<string, string>) => spawnSync('python3', ['scripts/check-source-line.py'], {
    cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8',
  });

  test('record: one authorized line; historical baselines kept as audit evidence only', () => {
    expect(line.platforms).toContain('android');
    expect(line.authoritativeLine.branches).toContain('ccr-47defc1a-89uvnr');
    const shas = line.historicalBaselines.map((b: any) => b.sha);
    for (const b of line.historicalBaselines) expect(b.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(shas).toContain('e2712522338cc1600d52be9bc78d5e9a293eeae3');   // v40 rollback
    expect(shas).toContain('a3f17b61d38409dd2711f307a5a95e820fe6b986');   // build-39 source
    for (const l of line.ledger) expect(l.tip).toMatch(/^[0-9a-f]{40}$/);
    // The release guard must not consult the historical record.
    expect(read('scripts/check-source-line.py')).not.toMatch(/historicalBaselines|ledger/);
  });
  test('the legacy OTA branch is a forbidden build ref (guard fails)', () => {
    const r = run({ BUILD_REF: 'working-branch-ocean-spore' });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/forbidden/);
  });
  test('CI verifies the line; every APK build authorizes an exact SHA before building', () => {
    const ci = wf('ci.yml');
    const co = ci.jobs.verify.steps.find((s: any) => s.uses?.startsWith('actions/checkout'));
    expect(co.with['fetch-depth']).toBe(0);
    expect(ci.jobs.verify.steps.some((s: any) => /check-source-line/.test(s.run ?? ''))).toBe(true);
    const audit = ci.jobs.verify.steps.find((s: any) => /audit-branches/.test(s.run ?? ''));
    expect(audit.run).not.toMatch(/--strict/);                             // reporting only
    const nb = wf('android-build.yml');
    for (const j of ['build-android', 'build-desktop']) {
      const steps = nb.jobs[j].steps as any[];
      const bco = steps.find((s) => s.uses?.startsWith('actions/checkout'));
      expect(bco.with['fetch-depth']).toBe(0);
      expect(bco.with.ref).toMatch(/plan\.outputs\.sha/);                  // the exact approved commit
      const names = steps.map((s) => s.name);
      const gate = steps.find((s) => s.name === 'Verify approved source SHA');
      expect(gate.run).toMatch(/check-source-line\.py --release/);
      expect(gate.env.APPROVED_SHA).toMatch(/plan\.outputs\.sha/);
      const expensive = names.findIndex((n) => /Build release APK|Package desktop builds/.test(n ?? ''));
      expect(names.indexOf('Verify approved source SHA')).toBeLessThan(expensive);
    }
    expect(nb.jobs['build-android'].steps.map((s: any) => s.name)).toContain('Manifest part and checksum');
    expect(JSON.stringify(nb.jobs.assemble)).toMatch(/--verify-manifest/);
    expect(JSON.stringify(nb.jobs.release)).toMatch(/--verify-manifest/);   // release job re-checks
  });
  test('the policy is durable: CLAUDE.md, architecture doc and ledger exist', () => {
    expect(read('CLAUDE.md')).toMatch(/ONE GAME/);
    expect(read('docs/ARCHITECTURE.md')).toMatch(/one source of truth/i);
    expect(read('docs/BRANCH-LEDGER.md')).toMatch(/Missing-work ledger/);
    expect(JSON.parse(read('package.json')).scripts.verify).toMatch(/check-source-line/);
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
