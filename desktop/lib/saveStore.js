'use strict';
// Durable desktop save storage (main process; plain Node so it is unit-tested).
//
// Same guarantees as the Android store (src/state/persistence.ts):
//  * atomic: write <file>.tmp, then rename over the real file, keeping the
//    previous good file as <file>.bak
//  * serialized writes (no interleaving)
//  * load order: main -> .bak; if both are unusable, a damaged main file is moved
//    to .corrupt (never overwritten) and the caller gets null (= new game)
//  * lives in the per-user data dir, never the install dir, and is untouched by
//    application updates
// `validate` is supplied by the renderer-side schema owner (parseSave); the main
// process only checks that the payload is JSON text of sane size, so the save
// schema stays defined in one place (src/state/saveSchema.ts).
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1024 * 1024;

function createSaveStore(dir, name = 'ocean-spore-save.json') {
  const file = path.join(dir, name);
  let chain = Promise.resolve();

  const readIfAny = async (p) => {
    try { return await fs.promises.readFile(p, 'utf8'); } catch { return null; }
  };
  const usable = (text) => {
    if (typeof text !== 'string' || text.length === 0 || text.length > MAX_BYTES) return false;
    try { const v = JSON.parse(text); return v !== null && typeof v === 'object' && !Array.isArray(v); } catch { return false; }
  };

  async function load(isValid = () => true) {
    const ok = (t) => usable(t) && isValid(t);
    const main = await readIfAny(file);
    if (ok(main)) return main;
    const bak = await readIfAny(file + '.bak');
    if (ok(bak)) return bak;
    if (main !== null) {
      await fs.promises.rename(file, file + '.corrupt').catch(() => {});
    }
    return null;
  }

  /** Current save text then the previous good one; the renderer (owner of the schema) picks. */
  async function candidates() {
    return [await readIfAny(file), await readIfAny(file + '.bak')];
  }

  /** Keep a damaged main file for diagnosis instead of letting a new save overwrite it. */
  async function quarantine() {
    await chain;
    await fs.promises.rename(file, file + '.corrupt').catch(() => {});
  }

  function save(text) {
    if (!usable(text)) return Promise.reject(new Error('refusing to write an invalid save payload'));
    chain = chain.then(async () => {
      await fs.promises.mkdir(dir, { recursive: true });
      const tmp = file + '.tmp';
      const fh = await fs.promises.open(tmp, 'w');
      try { await fh.writeFile(text); await fh.sync(); } finally { await fh.close(); }
      try { await fs.promises.rm(file + '.bak', { force: true }); await fs.promises.rename(file, file + '.bak'); } catch { /* no previous file */ }
      await fs.promises.rename(tmp, file);
    });
    const result = chain;
    chain = chain.catch(() => {});          // a failed write must not poison later ones
    return result;
  }

  async function clear() {
    await chain;
    for (const p of [file, file + '.bak', file + '.tmp', file + '.corrupt']) await fs.promises.rm(p, { force: true });
  }

  return { file, load, candidates, quarantine, save, clear, flush: () => chain.catch(() => {}) };
}

module.exports = { createSaveStore, MAX_BYTES };
