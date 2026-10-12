'use strict';
// Automated launch smoke test (driven by scripts/desktop-smoke.mjs; not shipped
// behaviour). Exercises the REAL shell: waits for the game to render, plays a few
// seconds with synthetic keyboard input, samples frame pacing and memory, saves a
// screenshot, checks the save reached disk, then exits cleanly.
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(win, outDir, { store, app }) {
  fs.mkdirSync(outDir, { recursive: true });
  const wc = win.webContents;
  const report = { steps: [], startedAt: new Date().toISOString() };
  const step = (name, ok, extra = {}) => {
    report.steps.push({ name, ok, ...extra });
    console.log(`[smoke] ${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(extra)}`);
  };
  const js = (code) => wc.executeJavaScript(code, true);
  const key = async (k, ms = 80) => {
    wc.sendInputEvent({ type: 'keyDown', keyCode: k });
    await sleep(ms);
    wc.sendInputEvent({ type: 'keyUp', keyCode: k });
    await sleep(150);
  };
  const waitFor = async (code, timeoutMs, label) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try { if (await js(code)) return Date.now() - t0; } catch { /* page not ready */ }
      await sleep(250);
    }
    step(label, false, { timeoutMs });
    throw new Error(`timeout: ${label}`);
  };
  const finish = async (code) => {
    report.finishedAt = new Date().toISOString();
    report.ok = code === 0;
    fs.writeFileSync(path.join(outDir, 'smoke-report.json'), JSON.stringify(report, null, 2));
    await store.flush();
    app.exit(code);
  };

  try {
    const t0 = Date.now();
    if (wc.isLoading()) await new Promise((res) => wc.once('did-finish-load', res));
    step('page loaded', true, { ms: Date.now() - t0 });
    const isolated = await js("typeof window.hotAttic === 'object' && typeof (window.process && window.process.versions && window.process.versions.node) === 'undefined' && typeof window.require === 'undefined' || typeof window.require === 'function'");
    step('bridge present', await js("typeof window.hotAttic === 'object' && window.hotAttic.isDesktop === true"));
    step('renderer has no Node (sandbox + context isolation)', await js("typeof (window.process && window.process.versions && window.process.versions.node) === 'undefined' && typeof window.Buffer === 'undefined'"), { isolated });
    report.info = await js('window.hotAttic.info()');
    await waitFor("!!document.querySelector('#root') && document.querySelector('#root').children.length > 0", 20000, 'game UI mounted');
    step('game UI mounted', true);
    await waitFor('!!window.__oceanSporeStatus', 20000, 'status hook present');
    const reached = (screen, ms) => waitFor(`window.__oceanSporeStatus().screen === '${screen}'`, ms, `screen ${screen}`);

    await reached('splash', 15000);
    step('studio card -> title', true);
    await key('Down');                                     // keyboard focus lands on CONTINUE
    await key('Return');
    await reached('shipyard', 8000);
    step('keyboard: title -> ship select', true);
    await key('Down');
    await key('Return');
    await reached('playing', 8000);
    step('keyboard: ship select -> start run', true);

    const msFrames = await waitFor('window.__oceanSporeStatus().renderFrames > 30', 60000, 'WebGL frames rendered');
    const models = await js('({ models: window.__oceanSporeStatus().modelsLoaded, failed: window.__oceanSporeStatus().modelsFailed, frames: window.__oceanSporeStatus().renderFrames, firstError: window.__oceanSporeStatus().firstError, initError: window.__oceanSporeStatus().initError, renderError: window.__oceanSporeStatus().renderError })');
    step('3D scene rendering, GLB assets loaded', models.failed === 0 && models.models >= 15, { msToFrames: msFrames, ...models });

    wc.sendInputEvent({ type: 'keyDown', keyCode: 'D' });
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
    await sleep(5000);
    const stats = await js('window.__oceanSporeStatus().frameStats()');
    const sim = await js('window.__oceanSporeStatus().simSeconds');
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'D' });
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
    step('gameplay advances under keyboard input', sim > 2, { simSeconds: sim, stats });
    report.frameStats = stats;
    report.memory = app.getAppMetrics().map((m) => ({ type: m.type, workingSetKB: m.memory.workingSetSize }));

    fs.writeFileSync(path.join(outDir, 'gameplay.png'), (await wc.capturePage()).toPNG());
    step('screenshot captured', true);
    step('audio initialised', await js('window.__oceanSporeStatus().audioReady === true'));

    await key('Escape');
    await waitFor('window.__oceanSporeStatus().paused === true', 4000, 'Esc pauses');
    step('Escape pauses', true);
    fs.writeFileSync(path.join(outDir, 'paused.png'), (await wc.capturePage()).toPNG());
    await key('Escape');
    await waitFor('window.__oceanSporeStatus().paused === false', 4000, 'Esc resumes');
    step('Escape resumes', true);

    // Gamepad path through the REAL renderer (a fake Xbox-layout pad injected into
    // navigator.getGamepads; this exercises the integration, not physical hardware).
    await js(`window.__fakePad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; navigator.getGamepads = () => [window.__fakePad]; true`);
    const padPress = async (idx, ms = 140) => {
      await js(`window.__fakePad.buttons[${idx}] = { pressed: true, value: 1 }; true`);
      await sleep(ms);
      await js(`window.__fakePad.buttons[${idx}] = { pressed: false, value: 0 }; true`);
      await sleep(160);
    };
    await padPress(9);                                     // Start
    await waitFor('window.__oceanSporeStatus().paused === true', 4000, 'pad Start pauses');
    step('gamepad: Start pauses', true);
    step('prompts switch to Xbox glyphs on pad input', (await js('window.__oceanSporeStatus().promptStyle')) === 'xbox');
    await padPress(13);                                    // D-pad down: focus lands on RESUME
    await padPress(0);                                     // A: activate
    await waitFor('window.__oceanSporeStatus().paused === false', 4000, 'pad menu resumes');
    step('gamepad: D-pad + A navigate the pause menu and resume', true);
    await js('window.__fakePad.axes = [1, 0, 0, 0]; true');
    const s0 = await js('window.__oceanSporeStatus().simSeconds');
    await sleep(1500);
    await js('window.__fakePad.axes = [0, 0, 0, 0]; true');
    step('gamepad: stick input drives gameplay without error', (await js('window.__oceanSporeStatus().simSeconds')) > s0 + 0.5 && (await js('window.__oceanSporeStatus().renderError')) === '');
    fs.writeFileSync(path.join(outDir, 'gamepad.png'), (await wc.capturePage()).toPNG());

    const saved = await js("window.hotAttic.writeSave(JSON.stringify({ schemaVersion: 2, captainName: 'Smoke Tester', totalKills: 3, unlockedShips: ['raft'], lastShip: 'raft', highScore: 1, totalParts: 2, soundEnabled: true })).then(() => true)");
    await store.flush();
    step('save written to the per-user data dir', saved === true && fs.existsSync(store.file), { file: store.file });
    await finish(report.steps.every((s) => s.ok) ? 0 : 1);
  } catch (err) {
    console.log('[smoke] ERROR', err && err.message);
    report.error = String(err && err.message);
    try { fs.writeFileSync(path.join(outDir, 'failure.png'), (await wc.capturePage()).toPNG()); } catch { /* ignore */ }
    await finish(1);
  }
}

module.exports = { run };
