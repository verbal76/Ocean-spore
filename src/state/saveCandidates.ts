import { parseSave, SaveData } from './saveSchema';

/**
 * Desktop load policy (the Electron main process only stores text; the schema stays
 * defined here, in one place). Candidates are tried in order: the current save, then
 * the previous good one (.bak). If neither parses and a current file existed, it is
 * reported so the shell can quarantine it (keep it for diagnosis, never overwrite it).
 */
export function chooseSave(candidates: readonly (string | null)[]): { save: SaveData | null; quarantineMain: boolean } {
  for (const text of candidates) {
    if (typeof text !== 'string') continue;
    if (!isPlainObjectJson(text)) continue;                  // arrays / primitives are damage, not a save
    const parsed = parseSave(text);
    if (parsed) return { save: parsed, quarantineMain: false };
  }
  return { save: null, quarantineMain: typeof candidates[0] === 'string' };
}

function isPlainObjectJson(text: string): boolean {
  try {
    const v = JSON.parse(text);
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  } catch {
    return false;
  }
}
