// Desktop target only (Metro picks this file instead of desktopLayer.ts for web).
// Wires the pure input layer to the real window: keyboard / gamepad polling,
// controller-driven focus navigation over the existing screens, prompt state,
// per-device preferences, and a read-only status hook for the automated smoke test.
import { useEffect, useRef } from 'react';
import { getAudio } from '../audio';
import { deviceStore } from '../input/deviceStore';
import { DesktopInput } from '../input/desktopInput';
import { MenuKind, PROMPT_PREFS, PromptPref , textForKey } from '../input/inputActions';
import { getBackHandler, readStatus, reportStatus as reportBus, setBackHandler, setGameSink, setTextEntry } from '../input/inputBus';
import type { GameSink , DesktopStatus } from '../input/inputBus';
import { pickInitial, pickNext, Rect } from '../input/menuNav';
import { glbLoadStatus } from '../render3d/loadStatus';
import { getBridge } from './bridge';

export function reportStatus(patch: Partial<DesktopStatus>): void { reportBus(patch); }

export function useDesktopBack(handler: (() => void) | null): void {
  useEffect(() => {
    setBackHandler(handler);
    return () => { if (getBackHandler() === handler) setBackHandler(null); };
  }, [handler]);
}

export interface TextEntryHandlers { onKey(ch: string): void; onBackspace(): void; onSpace(): void; onDone(): void }
export function useDesktopTextEntry(handlers: TextEntryHandlers | null): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  const active = handlers !== null;
  useEffect(() => {
    if (!active) return undefined;
    setTextEntry(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = textForKey(e.code);
      const h = ref.current;
      if (!t || !h) return;
      e.preventDefault();
      if (e.repeat && t.kind !== 'backspace') return;
      if (t.kind === 'char') h.onKey(t.ch);
      else if (t.kind === 'backspace') h.onBackspace();
      else if (t.kind === 'space') h.onSpace();
      else h.onDone();
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); setTextEntry(false); };
  }, [active]);
}

// --- preferences (per device, never part of the save) ------------------------

export function registerGameSink(sink: GameSink | null): void { setGameSink(sink); }

const LS_PREFS = 'ocean-spore-desktop-prefs';
export function cyclePromptPref(): void {
  const cur = deviceStore.get().pref;
  setPromptPref(PROMPT_PREFS[(PROMPT_PREFS.indexOf(cur) + 1) % PROMPT_PREFS.length]);
}
function setPromptPref(pref: PromptPref): void {
  if (!PROMPT_PREFS.includes(pref)) return;
  deviceStore.setPref(pref);
  const bridge = getBridge();
  if (bridge) void bridge.updatePrefs({ promptStyle: pref });
  else { try { globalThis.localStorage?.setItem(LS_PREFS, JSON.stringify({ promptStyle: pref })); } catch { /* ignore */ } }
}

export function toggleFullscreen(): void {
  const bridge = getBridge();
  if (bridge) { void bridge.isFullscreen().then((on) => bridge.setFullscreen(!on)); return; }
  const d = document as Document & { fullscreenElement?: Element | null };
  if (d.fullscreenElement) void document.exitFullscreen?.();
  else void document.documentElement.requestFullscreen?.();
}

async function loadPrefs(): Promise<void> {
  try {
    const bridge = getBridge();
    const prefs = bridge ? await bridge.readPrefs() : JSON.parse(globalThis.localStorage?.getItem(LS_PREFS) ?? '{}');
    if (PROMPT_PREFS.includes(prefs.promptStyle as PromptPref)) deviceStore.setPref(prefs.promptStyle as PromptPref);
  } catch { /* defaults */ }
}

// --- focus navigation over the existing (unmodified) screens ------------------

const SELECTOR = '[tabindex="0"], button, [role="button"], input:not([disabled]), textarea:not([disabled])';
const FOCUS_ATTR = 'data-hat-focus';

function visibleControls(): HTMLElement[] {
  const out: HTMLElement[] = [];
  document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    if (el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-hat-skip')) return;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return;
    // Controls hidden behind an overlay (About, pause menu, harbor) are not reachable.
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) return;
    out.push(el);
  });
  return out;
}

function setFocus(el: HTMLElement | null): void {
  document.querySelectorAll(`[${FOCUS_ATTR}]`).forEach((n) => n.removeAttribute(FOCUS_ATTR));
  if (!el) return;
  el.setAttribute(FOCUS_ATTR, '1');
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

function activate(el: HTMLElement): void {
  // react-native-web Pressables respond to a real pointer sequence and to Enter; a
  // click() reaches the press handler the same way a mouse does.
  el.click();
}

function onMenu(kind: MenuKind): void {
  if (kind === 'back') {
    const close = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR))
      .find((el) => /^\s*(close|cancel)\s*$/i.test(el.textContent ?? '') && el.getBoundingClientRect().width > 0);
    if (close) { activate(close); return; }
    getBackHandler()?.();
    return;
  }
  const controls = visibleControls();
  if (controls.length === 0) return;
  const rects: Rect[] = controls.map((c) => { const r = c.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; });
  const current = controls.findIndex((c) => c === document.activeElement || c.contains(document.activeElement));
  // Nothing focused yet: start on the screen's primary action (data-testid="hat-primary"
  // on CONTINUE / START / RESUME / RETRY...), else the top-left-most control.
  const initial = () => {
    const primary = controls.findIndex((c) => c.getAttribute('data-testid') === 'hat-primary');
    return primary >= 0 ? primary : pickInitial(rects);
  };
  if (kind === 'confirm') {
    if (current >= 0) activate(controls[current]);
    else setFocus(controls[initial()]);
    return;
  }
  if (current < 0) { setFocus(controls[initial()]); return; }
  const next = pickNext(rects, current, kind);
  if (next >= 0) setFocus(controls[next]);
}

function injectStyle(): void {
  if (document.getElementById('hat-focus-style')) return;
  const s = document.createElement('style');
  s.id = 'hat-focus-style';
  s.textContent = `[${FOCUS_ATTR}]{outline:3px solid #22d3ee !important;outline-offset:3px;border-radius:14px}
*:focus{outline:none} [${FOCUS_ATTR}]:focus{outline:3px solid #22d3ee !important}
html,body{cursor:default;user-select:none;-webkit-user-select:none}
::-webkit-scrollbar{width:10px;height:10px;background:transparent}
::-webkit-scrollbar-thumb{background:rgba(34,211,238,0.35);border-radius:6px}
::-webkit-scrollbar-button{display:none}`;
  document.head.appendChild(s);
}

// --- frame pacing sampler + status hook (smoke test / diagnostics) ------------

const FRAME_RING = 900;
const frames: number[] = [];
let lastFrameAt = 0;
function sampleFrames(): void {
  const t = performance.now();
  if (lastFrameAt) { frames.push(t - lastFrameAt); if (frames.length > FRAME_RING) frames.shift(); }
  lastFrameAt = t;
  requestAnimationFrame(sampleFrames);
}
export interface FrameStats { frames: number; avgMs: number; p95Ms: number; p99Ms: number; maxMs: number; fps: number }
function frameStats(): FrameStats {
  const a = [...frames].sort((x, y) => x - y);
  const n = a.length;
  if (n === 0) return { frames: 0, avgMs: 0, p95Ms: 0, p99Ms: 0, maxMs: 0, fps: 0 };
  const avg = a.reduce((s, v) => s + v, 0) / n;
  const q = (p: number) => a[Math.min(n - 1, Math.floor(p * n))];
  return { frames: n, avgMs: +avg.toFixed(2), p95Ms: +q(0.95).toFixed(2), p99Ms: +q(0.99).toFixed(2), maxMs: +a[n - 1].toFixed(2), fps: +(1000 / avg).toFixed(1) };
}

let started = false;
export function startDesktopLayer(): () => void {
  if (started) return () => undefined;
  started = true;
  injectStyle();
  void loadPrefs();

  const input = new DesktopInput(
    {
      target: window,
      getPads: () => Array.from(navigator.getGamepads ? navigator.getGamepads() : []) as never,
      now: () => performance.now(),
      raf: (cb) => requestAnimationFrame(cb),
      caf: (id) => cancelAnimationFrame(id),
    },
    {
      onMenu,
      onDetected: (s) => deviceStore.setDetected(s),
      onPadConnection: (c) => deviceStore.setPadConnected(c),
    },
  );
  input.start();

  // A real touch screen (Steam Deck): show the touch controls too.
  const onTouch = () => deviceStore.setTouchSeen(true);
  window.addEventListener('touchstart', onTouch, { passive: true, once: true });
  // Mouse use clears the keyboard-focus ring.
  const onPointer = (e: PointerEvent) => { if (e.pointerType === 'mouse') setFocus(null); };
  window.addEventListener('pointerdown', onPointer);
  // The window losing visibility (suspend/alt-tab on some platforms) is handled like blur.
  const onHidden = () => { if (document.hidden) window.dispatchEvent(new Event('blur')); };
  document.addEventListener('visibilitychange', onHidden);

  requestAnimationFrame(sampleFrames);
  (globalThis as Record<string, unknown>).__oceanSporeStatus = () => ({
    ...readStatus(),
    renderFrames: glbLoadStatus.renderFrames,
    modelsLoaded: glbLoadStatus.loaded,
    modelsFailed: glbLoadStatus.failed,
    firstError: glbLoadStatus.firstError,
    initError: glbLoadStatus.initError,
    renderError: glbLoadStatus.renderError,
    audioReady: getAudio().isEnabled() && getAudio().failures === 0,
    promptStyle: deviceStore.get().style,
    frameStats,
  });

  return () => {
    input.stop();
    window.removeEventListener('pointerdown', onPointer);
    document.removeEventListener('visibilitychange', onHidden);
    started = false;
  };
}
