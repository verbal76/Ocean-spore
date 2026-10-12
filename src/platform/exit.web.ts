import { getBridge } from './bridge';

/** Desktop exit: the shell flushes pending saves, then quits. */
export function exitApp(): void {
  const b = getBridge();
  if (b) { void b.quit(); return; }
  try { window.close(); } catch { /* browser dev */ }
}
