'use strict';
// Ocean Spore desktop shell (Windows x86-64 / Linux x86-64).
//
// This file is the ONLY privileged code. The game itself is the unmodified Expo web
// export loaded from app://game/ into a sandboxed, context-isolated renderer with
// no Node access; the renderer reaches the OS only through the small, validated
// bridge in preload.js. No remote content is ever loaded (offline by design).
const { app, BrowserWindow, ipcMain, protocol, session, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { resolveAppPath, mimeFor } = require('./lib/paths');
const { createSaveStore } = require('./lib/saveStore');
const { createPrefs } = require('./lib/prefs');

const ORIGIN = 'app://game/';
const argv = process.argv.slice(1);
const flag = (name) => {
  const a = argv.find((x) => x === `--${name}` || x.startsWith(`--${name}=`));
  return a === undefined ? undefined : (a.split('=')[1] ?? true);
};

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

app.setName('Ocean Spore');
if (!app.requestSingleInstanceLock()) { app.exit(0); }

// Unpackaged runs (tests / development) may point at another export directory.
const rendererRoot = path.resolve(
  !app.isPackaged && typeof flag('renderer') === 'string' ? flag('renderer') : path.join(__dirname, 'app'),
);

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // react-native-web injects <style> rules
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ');

let win = null;
let store = null;
let prefs = null;
let quitting = false;

function trusted(event) {
  const url = event.senderFrame && event.senderFrame.url;
  return typeof url === 'string' && url.startsWith(ORIGIN);
}

function registerIpc() {
  const handle = (channel, fn) => ipcMain.handle(channel, (event, ...args) => {
    if (!trusted(event)) throw new Error(`untrusted sender for ${channel}`);
    return fn(...args);
  });
  handle('save:candidates', () => store.candidates());
  handle('save:quarantine', () => store.quarantine());
  handle('save:write', (text) => store.save(text));
  handle('save:clear', () => store.clear());
  handle('prefs:read', () => prefs.read());
  handle('prefs:update', (patch) => prefs.update(patch));
  handle('window:setFullscreen', (on) => { if (win) win.setFullScreen(!!on); return win ? win.isFullScreen() : false; });
  handle('window:isFullscreen', () => (win ? win.isFullScreen() : false));
  handle('app:quit', () => { app.quit(); });
  handle('app:info', () => ({
    platform: process.platform, arch: process.arch, electron: process.versions.electron,
    chrome: process.versions.chrome, packaged: app.isPackaged,
  }));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 640, minHeight: 400,
    show: false, backgroundColor: '#03101c', title: 'Ocean Spore', autoHideMenuBar: true,
    fullscreen: prefs.read().fullscreen === true || flag('fullscreen') === true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true,
      autoplayPolicy: 'no-user-gesture-required', // game audio must not wait for a click on a controller-only device
      backgroundThrottling: false, spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN)) e.preventDefault(); });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.on('enter-full-screen', () => prefs.update({ fullscreen: true }));
  win.on('leave-full-screen', () => prefs.update({ fullscreen: false }));
  win.on('closed', () => { win = null; });
  win.loadURL(ORIGIN);
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const userData = app.getPath('userData');
  store = createSaveStore(path.join(userData, 'saves'));
  prefs = createPrefs(userData);

  // No permission is ever needed (gamepads/keyboard are plain web APIs): deny all.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    const file = url.host === 'game' ? resolveAppPath(rendererRoot, url.pathname) : null;
    const headers = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff' };
    if (!file) return new Response('Forbidden', { status: 403, headers });
    try {
      const data = await fs.promises.readFile(file);
      return new Response(data, { status: 200, headers: { ...headers, 'Content-Type': mimeFor(file) } });
    } catch {
      return new Response('Not found', { status: 404, headers });
    }
  });

  registerIpc();
  createWindow();

  const smokeDir = flag('smoke');
  if (typeof smokeDir === 'string') require('./lib/smoke').run(win, smokeDir, { store, app });
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
// Let any queued save reach disk before the process exits.
app.on('before-quit', (e) => {
  if (quitting || !store) return;
  quitting = true;
  e.preventDefault();
  store.flush().finally(() => app.quit());
});
