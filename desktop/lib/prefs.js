'use strict';
// Per-device desktop preferences (window mode, prompt style). Deliberately a
// separate file from the save: hardware-specific settings must never travel with
// progress (and must never be synchronized by a future Steam Cloud).
const fs = require('fs');
const path = require('path');

const ALLOWED = {
  fullscreen: (v) => typeof v === 'boolean',
  promptStyle: (v) => ['auto', 'xbox', 'playstation', 'switch', 'keyboard'].includes(v),
};

function sanitize(raw) {
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const [k, ok] of Object.entries(ALLOWED)) if (ok(raw[k])) out[k] = raw[k];
  }
  return out;
}

function createPrefs(dir, name = 'desktop-prefs.json') {
  const file = path.join(dir, name);
  let cache = null;
  const read = () => {
    if (cache) return cache;
    try { cache = sanitize(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { cache = {}; }
    return cache;
  };
  const update = (patch) => {
    cache = { ...read(), ...sanitize(patch) };
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file + '.tmp', JSON.stringify(cache));
      fs.renameSync(file + '.tmp', file);
    } catch { /* prefs are best-effort */ }
    return cache;
  };
  return { file, read, update };
}

module.exports = { createPrefs, sanitize };
