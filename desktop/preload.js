'use strict';
// The renderer's only door to the OS. Sandboxed preload: no Node in the page, a
// frozen object of narrow functions, every call re-validated in main.js.
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('hotAttic', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  loadSaveCandidates: () => call('save:candidates'),
  quarantineSave: () => call('save:quarantine'),
  writeSave: (text) => call('save:write', String(text)),
  clearSave: () => call('save:clear'),
  readPrefs: () => call('prefs:read'),
  updatePrefs: (patch) => call('prefs:update', patch),
  setFullscreen: (on) => call('window:setFullscreen', !!on),
  isFullscreen: () => call('window:isFullscreen'),
  quit: () => call('app:quit'),
  info: () => call('app:info'),
}));
