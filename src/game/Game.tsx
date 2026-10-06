import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Dimensions,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Polygon, Rect } from 'react-native-svg';
import { COLORS } from '../colors';
import { RENDER_3D, Render3D } from '../render3d';
import { FireButton } from '../ui/FireButton';
import { HUD } from '../ui/HUD';
import { Joystick } from '../ui/Joystick';
import { buildLayout, ControlState, METRICS, TapAction, TouchController, TouchPoint } from './controls';
import { Run } from './types';
import { getAudio } from '../audio';
import { cycleWeapon, dockAt, drainEvents, InputState, newStepClock, stepFixed, World } from './world';
import { flushSaves } from '../state/persistence';

interface Props {
  initialWorld: World;
  /** The harbor screen is open on top of this (still mounted) game. */
  docked: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onDocked: (world: World, harborIdx: number) => void;
  onDied: (run: Run) => void;
  onQuitToMenu: (world: World) => void;
}

const RENDER_READY_FAILSAFE_MS = 8000;

const SHIP_POLY = '1.0,0 -0.55,-0.55 -0.30,0 -0.55,0.55';
const ENEMY_POLY = '0.9,0 -0.85,-0.6 -0.40,0 -0.85,0.6';
const BOSS_POLY = '1.0,0 0.0,-0.7 -0.9,-0.5 -0.6,0 -0.9,0.5 0.0,0.7';

/** Absolute placement of a passive control from the shared layout. */
function boxStyle(b: { cx: number; cy: number; w: number; h: number }) {
  return { position: 'absolute' as const, left: b.cx - b.w / 2, top: b.cy - b.h / 2, width: b.w, height: b.h };
}

// Border color used to show which weapon mode is active. Mirrors
// AUTO's smallBtnOn cyan styling so the player can tell at a
// glance which of SINGLE/SPREAD/TWIN is selected.
function weaponModeColor(mode: number): string {
  if (mode === 1) return '#fbbf24'; // SPREAD: gold
  if (mode === 2) return '#f97316'; // TWIN: orange
  return '#22d3ee';                  // SINGLE: cyan
}

export function Game({ initialWorld, docked, soundEnabled, onToggleSound, onDocked, onDied, onQuitToMenu }: Props) {
  const worldRef = useRef<World>(initialWorld);
  // Long-lived effects (game loop, app-state/back handlers) must call the
  // latest callbacks, not the ones from the render they were created in.
  const onDiedRef = useRef(onDied);
  onDiedRef.current = onDied;
  const inputRef = useRef<InputState>({ dx: 0, dy: 0, fire: false, autoFire: true });
  const [, setTickCount] = useState(0);
  const [autoFire, setAutoFire] = useState(true);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  // The sim waits for the first drawn frame so the player never plays against
  // an empty sea while models load. A failsafe releases it if the renderer
  // never reports in (broken GL), so the game can't be stranded.
  const [renderReady, setRenderReady] = useState(!RENDER_3D);
  const readyRef = useRef(!RENDER_3D);
  readyRef.current = renderReady;
  const markReady = () => setRenderReady(true);
  useEffect(() => {
    if (renderReady) return;
    const id = setTimeout(() => setRenderReady(true), RENDER_READY_FAILSAFE_MS);
    return () => clearTimeout(id);
  }, [renderReady]);
  // Android can destroy the GL surface while the app is in the background and
  // three.js is never told; a fresh GLView (cheap: models are cached) after
  // returning to the foreground avoids a black or frozen scene.
  const [glEpoch, setGlEpoch] = useState(0);
  const wasBackgroundedRef = useRef(false);

  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [firePressed, setFirePressed] = useState(false);

  // Edge-to-edge: the game draws behind the status and gesture bars, so
  // controls and the HUD are offset by the system insets. Layout size comes
  // from the real measured root view (not guessed window constants), and
  // touch coordinates are relative to that same view.
  const insets = useSafeAreaInsets();
  const [layout, setLayout] = useState(() => {
    const d = Dimensions.get('window');
    return { width: d.width, height: d.height };
  });
  const sw = layout.width;
  const sh = layout.height;
  // One layout drives BOTH what is drawn and what a touch hits.
  const ctl = buildLayout(sw, sh, insets);
  const controllerRef = useRef<TouchController | null>(null);
  const lastControlRef = useRef<ControlState>({ dx: 0, dy: 0, knobX: 0, knobY: 0, fire: false });
  if (!controllerRef.current) controllerRef.current = new TouchController(ctl);
  controllerRef.current.setLayout(ctl);
  controllerRef.current.setHarborInRange(worldRef.current.nearHarborIndex >= 0);

  useEffect(() => {
    let mounted = true;
    let last = performance.now();
    let raf = 0;
    const clock = newStepClock();
    const loop = () => {
      if (!mounted) return;
      const now = performance.now();
      const frameDt = (now - last) / 1000;
      last = now;
      if (!pausedRef.current && readyRef.current) {
        const w = worldRef.current;
        const res = stepFixed(w, inputRef.current, frameDt, clock);
        const events = drainEvents(w);
        if (events.length > 0) getAudio().playEvents(events);
        if (res.died) { onDiedRef.current(w.run); return; }
        // Re-render only while the world is actually moving; paused frames
        // have nothing new to draw.
        setTickCount((t) => (t + 1) | 0);
      } else {
        clock.accumulator = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { mounted = false; cancelAnimationFrame(raf); };
  }, []);

  // Ambient sea + engine bed while sailing; everything is silenced while the
  // sim is paused, the harbor is open, the app is backgrounded or models load.
  useEffect(() => {
    const audio = getAudio();
    audio.startAmbient();
    return () => { audio.stopAmbient(); audio.setSuspended(false); };
  }, []);
  useEffect(() => {
    getAudio().setSuspended(paused || docked || !renderReady);
  }, [paused, docked, renderReady]);

  // Opening the harbor pauses (done at the tap); leaving it resumes.
  const wasDockedRef = useRef(false);
  useEffect(() => {
    if (wasDockedRef.current && !docked) setPausedStateRef.current(false);
    wasDockedRef.current = docked;
  }, [docked]);

  // Auto-pause when the app is backgrounded and when Android Back is pressed,
  // instead of the sim running on (or the app closing) behind the player.
  useEffect(() => {
    const appSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        wasBackgroundedRef.current = true;
        setPausedStateRef.current(true);
      } else if (wasBackgroundedRef.current) {
        wasBackgroundedRef.current = false;
        setRenderReady(false);
        setGlEpoch((e) => e + 1);
      }
    });
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPausedStateRef.current(!pausedRef.current);
      return true;
    });
    return () => { appSub.remove(); backSub.remove(); };
  }, []);

  // Push a controller snapshot into the sim input and the knob/fire visuals.
  function applyControls(next: ControlState) {
    const prev = lastControlRef.current;
    lastControlRef.current = next;
    inputRef.current.dx = next.dx;
    inputRef.current.dy = next.dy;
    inputRef.current.fire = next.fire;
    if (prev.knobX !== next.knobX || prev.knobY !== next.knobY) {
      setKnobOffset({ x: next.knobX, y: next.knobY });
    }
    if (prev.fire !== next.fire) setFirePressed(next.fire);
  }

  // Releases every held control. Called whenever the sim pauses, docks or
  // resumes, and on unmount-ish transitions: nothing may stay latched.
  function releaseAllInput() {
    applyControls(controllerRef.current!.releaseAll());
  }

  function setPausedState(next: boolean) {
    pausedRef.current = next;
    setPaused(next);
    releaseAllInput();
  }
  const setPausedStateRef = useRef(setPausedState);
  setPausedStateRef.current = setPausedState;

  function triggerAction(kind: TapAction) {
    if (kind === 'pause') {
      getAudio().play('tap');
      setPausedState(!pausedRef.current);
    } else if (kind === 'auto') {
      getAudio().play('tap');
      const next = !autoFire;
      setAutoFire(next);
      inputRef.current.autoFire = next;
    } else if (kind === 'weapon') {
      getAudio().play('tap');
      cycleWeapon(worldRef.current);
    } else if (kind === 'dock') {
      const w = worldRef.current;
      if (w.nearHarborIndex >= 0) {
        setPausedState(true);
        dockAt(w, w.nearHarborIndex);
        getAudio().playEvents(drainEvents(w));        // the loop is paused; play the dock cue now
        onDocked(w, w.nearHarborIndex);
      }
    }
  }

  // Every touch event carries the full list of fingers currently down; the
  // controller reconciles against it, so a missed "end" can never latch input.
  function onTouches(e: GestureResponderEvent) {
    if (pausedRef.current) return;
    const pts: TouchPoint[] = (e.nativeEvent.touches || []).map((t) => ({
      id: t.identifier,
      x: (t as any).locationX ?? t.pageX,
      y: (t as any).locationY ?? t.pageY,
    }));
    const c = controllerRef.current!;
    applyControls(c.sync(pts));
    // Taps run AFTER the state is applied: PAUSE/DOCK release all input.
    for (const a of c.takeTaps()) triggerAction(a);
  }

  function onTouchesCancelled() {
    releaseAllInput();
  }

  function onResume() { setPausedState(false); }

  function onQuitMenu() {
    setPausedState(false);
    onQuitToMenu(worldRef.current);
  }

  function onSaveQuit() {
    onQuitToMenu(worldRef.current);
    // Exit only after the save has actually reached disk.
    flushSaves().finally(() => {
      try { BackHandler.exitApp(); } catch { /* iOS / web no-op */ }
    });
  }

  const w = worldRef.current;
  const cam = w.camera;
  const zoom = w.cameraZoom || 1;
  const shakeAmount = w.shake;
  const sx = (Math.random() - 0.5) * shakeAmount;
  const sy = (Math.random() - 0.5) * shakeAmount;
  const toX = (x: number) => sw / 2 + (x - cam.x) * zoom + sx;
  const toY = (y: number) => sh / 2 + (y - cam.y) * zoom + sy;

  function onScreen(x: number, y: number, margin: number) {
    const px = toX(x);
    const py = toY(y);
    return px > -margin && py > -margin && px < sw + margin && py < sh + margin;
  }

  const stormy = w.run.weather === 'storm';
  const boss = w.enemies.find((e) => e.isBoss);

  const waveLines: { y: number }[] = [];
  const waveSpacing = 80;
  const waveOffset = ((cam.y % waveSpacing) + waveSpacing) % waveSpacing;
  for (let i = -1; i < Math.ceil(sh / waveSpacing) + 1; i++) {
    waveLines.push({ y: i * waveSpacing - waveOffset });
  }

  return (
    <View
      style={[styles.root, stormy && { backgroundColor: COLORS.storm }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setLayout((l) => (l.width === width && l.height === height ? l : { width, height }));
      }}
      onStartShouldSetResponder={() => !pausedRef.current}
      onMoveShouldSetResponder={() => !pausedRef.current}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onTouches}
      onResponderStart={onTouches}
      onResponderMove={onTouches}
      onResponderEnd={onTouches}
      onResponderRelease={onTouches}
      onResponderTerminate={onTouchesCancelled}
    >
      {RENDER_3D && (
        <Render3D
          key={glEpoch}
          worldRef={worldRef}
          width={sw}
          height={sh}
          paused={paused}
          hidden={docked}
          onReady={markReady}
        />
      )}

      <Svg width={sw} height={sh} style={StyleSheet.absoluteFill} pointerEvents="none">
        {waveLines.map((wl, i) => (
          <Line
            key={'w' + i}
            x1={0} y1={wl.y} x2={sw} y2={wl.y + 6}
            stroke={stormy ? COLORS.stormWave : COLORS.oceanWave}
            strokeWidth={1.5}
          />
        ))}

        {(() => {
          const items: any[] = [];
          const pushWake = (wake: any[], keyPrefix: string, size: number) => {
            const n = wake.length;
            for (let i = 0; i < n - 1; i++) {
              const a = wake[i];
              const b = wake[i + 1];
              if (!onScreen(a.x, a.y, 60) && !onScreen(b.x, b.y, 60)) continue;
              const age = i / Math.max(1, n - 1);
              const opacity = (1 - age) * 0.55;
              const widthBase = size * 0.18 * (1 + age * 1.8);
              items.push(
                <Line
                  key={keyPrefix + i}
                  x1={toX(a.x)} y1={toY(a.y)}
                  x2={toX(b.x)} y2={toY(b.y)}
                  stroke="#e0f2fe"
                  strokeOpacity={opacity}
                  strokeWidth={widthBase * zoom}
                  strokeLinecap="round"
                />
              );
            }
          };
          pushWake(w.player.wake, 'pw', w.player.size);
          for (const e of w.enemies) pushWake(e.wake, 'ew' + e.id + '_', e.size);
          return items;
        })()}

        {w.salvageRings.map((r, i) => {
          if (!r.active) return null;
          if (!onScreen(r.pos.x, r.pos.y, 120)) return null;
          const pulseScale = 1 + 0.04 * Math.sin(r.pulse * 2.4);
          return (
            <G key={'sr' + i}>
              <Circle cx={toX(r.pos.x)} cy={toY(r.pos.y)} r={r.radius * pulseScale * zoom}
                fill="rgba(251,191,36,0.06)" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4 8" />
              <Circle cx={toX(r.pos.x)} cy={toY(r.pos.y)} r={9 * zoom} fill="#fbbf24" opacity={0.9} />
              <Circle cx={toX(r.pos.x)} cy={toY(r.pos.y)} r={4 * zoom} fill="#fef3c7" />
            </G>
          );
        })}

        {w.harbors.map(
          (h, i) =>
            onScreen(h.pos.x, h.pos.y, 200) && (
              <G key={'h' + i}>
                <Circle cx={toX(h.pos.x)} cy={toY(h.pos.y)} r={h.radius * zoom}
                  fill="rgba(251,191,36,0.06)"
                  stroke={i === w.nearHarborIndex ? '#fbbf24' : 'rgba(251,191,36,0.4)'}
                  strokeWidth={i === w.nearHarborIndex ? 3 : 1.5} strokeDasharray="6 6" />
                <Circle cx={toX(h.pos.x)} cy={toY(h.pos.y)} r={30 * zoom}
                  fill={COLORS.harbor} stroke="#7c5e2f" strokeWidth={2} />
                <Rect x={toX(h.pos.x) - 18 * zoom} y={toY(h.pos.y) - 4 * zoom}
                  width={36 * zoom} height={8 * zoom} fill="#7c5e2f" />
              </G>
            )
        )}

        {w.pickups.map(
          (pk) =>
            onScreen(pk.pos.x, pk.pos.y, 30) && (
              <Circle key={'pk' + pk.id} cx={toX(pk.pos.x)} cy={toY(pk.pos.y)}
                r={(pk.kind === 'crate' ? 9 : 6) * zoom} fill={pk.color}
                stroke="rgba(255,255,255,0.7)" strokeWidth={1}
                opacity={pk.life < 3 ? (Math.sin(pk.life * 14) > 0 ? 1 : 0.35) : 1} />
            )
        )}

        {!RENDER_3D && w.enemies.map((e) => {
          if (!onScreen(e.pos.x, e.pos.y, 80)) return null;
          const t = `translate(${toX(e.pos.x)} ${toY(e.pos.y)}) rotate(${(e.angle * 180) / Math.PI}) scale(${e.size * zoom})`;
          const poly = e.isBoss ? BOSS_POLY : ENEMY_POLY;
          return (
            <G key={'e' + e.id} transform={t}>
              <Polygon points={poly} fill={e.color} />
              <Circle cx={0} cy={0} r={0.25} fill="rgba(255,255,255,0.4)" />
            </G>
          );
        })}

        {w.bullets.map(
          (b) =>
            onScreen(b.pos.x, b.pos.y, 20) && (
              <Circle key={'b' + b.id} cx={toX(b.pos.x)} cy={toY(b.pos.y)} r={b.size * zoom} fill={b.color} />
            )
        )}

        {!RENDER_3D && (() => {
          const p = w.player;
          const hullFrac = p.hull / p.maxHull;
          const damaged = hullFrac < 0.45;
          const t = `translate(${toX(p.pos.x)} ${toY(p.pos.y)}) rotate(${(p.angle * 180) / Math.PI}) scale(${p.size * zoom})`;
          return (
            <G transform={t}>
              <Polygon points={SHIP_POLY} fill={damaged ? '#f59e0b' : p.color}
                stroke="rgba(255,255,255,0.25)" strokeWidth={0.04} />
              <Rect x={-0.2} y={-0.22} width={0.45} height={0.44} fill="rgba(255,255,255,0.30)" />
              {damaged && <Circle cx={-0.4} cy={0} r={0.18} fill="rgba(248,113,113,0.55)" />}
            </G>
          );
        })()}

        {w.particles.map((pt, i) => {
          if (!onScreen(pt.pos.x, pt.pos.y, 20)) return null;
          const a = Math.max(0, pt.life / pt.maxLife);
          const ps = pt.size * zoom;
          return (
            <Rect key={'p' + i} x={toX(pt.pos.x) - ps / 2} y={toY(pt.pos.y) - ps / 2}
              width={ps} height={ps} fill={pt.color} opacity={a} />
          );
        })}
      </Svg>

      <HUD topInset={insets.top} run={w.run} player={w.player} weather={w.run.weather}
        bossActive={!!boss} bossHp={boss ? { current: boss.hull, max: boss.maxHull } : null} />

      {w.nearHarborIndex >= 0 && (
        <View
          style={[styles.dockPrompt, {
            left: ctl.dock.cx - ctl.dock.w / 2, top: ctl.dock.cy - ctl.dock.h / 2,
            width: ctl.dock.w, height: ctl.dock.h,
          }]}
          pointerEvents="none"
        >
          <Text style={styles.dockPromptLabel}>DOCK AT</Text>
          <Text style={styles.dockPromptName}>{w.harbors[w.nearHarborIndex].name}</Text>
        </View>
      )}

      {/* All controls are passive visuals placed from the SAME layout the
          touch controller hit-tests (see game/controls.ts). Touches are handled
          once, by the root responder above. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: ctl.joystick.cx - ctl.joystick.radius, top: ctl.joystick.cy - ctl.joystick.radius }}
      >
        <Joystick size={METRICS.JOY_SIZE} knob={knobOffset} />
      </View>

      <View
        pointerEvents="none"
        style={[styles.smallBtn, autoFire && styles.smallBtnOn, boxStyle(ctl.auto)]}
      >
        <Text style={styles.smallBtnText}>AUTO</Text>
      </View>
      <View
        pointerEvents="none"
        style={[styles.smallBtn, { borderColor: weaponModeColor(w.run.weaponMode) }, boxStyle(ctl.weapon)]}
      >
        <Text style={styles.smallBtnText}>
          {w.run.weaponMode === 0 ? 'SINGLE' : w.run.weaponMode === 1 ? 'SPREAD' : 'TWIN'}
        </Text>
      </View>

      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: ctl.fire.cx - ctl.fire.radius, top: ctl.fire.cy - ctl.fire.radius }}
      >
        <FireButton size={METRICS.FIRE_SIZE} pressed={firePressed} />
      </View>

      {/* Passive: the root responder owns the tap. While paused the overlay
          below covers the screen and offers RESUME. */}
      <View pointerEvents="none" style={[styles.pauseBtn, boxStyle(ctl.pause)]}>
        <Text style={styles.pauseText}>PAUSE</Text>
      </View>

      {!renderReady && (
        <View style={styles.loading} pointerEvents="none">
          <Text style={styles.loadingText}>LOADING</Text>
        </View>
      )}

      {paused && w.dockedHarborIndex < 0 && (
        <View style={styles.pauseOverlay}>
          <Text style={styles.pauseOverlayText}>PAUSED</Text>
          <View style={styles.pauseMenu}>
            <Pressable style={styles.pauseMenuPrimary} onPress={onResume}>
              <Text style={styles.pauseMenuPrimaryText}>RESUME</Text>
            </Pressable>
            <Pressable
              style={styles.pauseMenuBtn}
              onPress={() => { getAudio().play('tap'); onToggleSound(); }}
            >
              <Text style={styles.pauseMenuBtnText}>SOUND: {soundEnabled ? 'ON' : 'OFF'}</Text>
            </Pressable>
            <Pressable style={styles.pauseMenuBtn} onPress={onQuitMenu}>
              <Text style={styles.pauseMenuBtnText}>SAVE &amp; QUIT TO MAIN MENU</Text>
            </Pressable>
            <Pressable style={[styles.pauseMenuBtn, styles.pauseMenuDanger]} onPress={onSaveQuit}>
              <Text style={[styles.pauseMenuBtnText, styles.pauseMenuDangerText]}>SAVE &amp; QUIT</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ocean },
  smallBtn: {
    backgroundColor: 'rgba(3,16,28,0.6)',
    borderColor: COLORS.hudBorder,
    borderWidth: 1,
    paddingHorizontal: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnOn: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(34,211,238,0.18)',
  },
  smallBtnText: { color: COLORS.text, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  dockPrompt: {
    position: 'absolute',
    backgroundColor: 'rgba(251,191,36,0.92)',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockPromptLabel: { color: COLORS.bg, fontSize: 10, letterSpacing: 3, fontWeight: '800' },
  dockPromptName: { color: COLORS.bg, fontSize: 18, fontWeight: '900', letterSpacing: 2, marginTop: 2 },
  pauseBtn: {
    position: 'absolute',
    backgroundColor: 'rgba(3,16,28,0.7)',
    borderColor: COLORS.hudBorder,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textDim, fontSize: 12, fontWeight: '800', letterSpacing: 6 },
  pauseText: { color: COLORS.text, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  pauseOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(3,16,28,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 28,
  },
  pauseOverlayText: { color: COLORS.text, fontSize: 32, fontWeight: '900', letterSpacing: 8 },
  pauseMenu: { width: '100%', maxWidth: 360, gap: 12 },
  pauseMenuPrimary: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  pauseMenuPrimaryText: { color: COLORS.bg, fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  pauseMenuBtn: {
    paddingVertical: 14,
    borderRadius: 999,
    borderColor: COLORS.hudBorder,
    borderWidth: 1,
    backgroundColor: 'rgba(3,16,28,0.6)',
    alignItems: 'center',
  },
  pauseMenuBtnText: { color: COLORS.text, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  pauseMenuDanger: { borderColor: 'rgba(248,113,113,0.5)' },
  pauseMenuDangerText: { color: '#fca5a5' },
});
