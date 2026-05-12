import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Polygon, Rect } from 'react-native-svg';
import { COLORS } from '../colors';
import { RENDER_3D, Render3D } from '../render3d';
import { FireButton } from '../ui/FireButton';
import { HUD } from '../ui/HUD';
import { Joystick } from '../ui/Joystick';
import { Run } from './types';
import { cycleWeapon, dockAt, InputState, tick, World } from './world';

interface Props {
  initialWorld: World;
  onDocked: (world: World, harborIdx: number) => void;
  onDied: (run: Run) => void;
  onQuitToMenu: (world: World) => void;
}

const SHIP_POLY = '1.0,0 -0.55,-0.55 -0.30,0 -0.55,0.55';
const ENEMY_POLY = '0.9,0 -0.85,-0.6 -0.40,0 -0.85,0.6';
const BOSS_POLY = '1.0,0 0.0,-0.7 -0.9,-0.5 -0.6,0 -0.9,0.5 0.0,0.7';

type TouchKind = 'joystick' | 'fire' | 'pause' | 'auto' | 'weapon' | 'dock';
interface TouchState { kind: TouchKind; startX: number; startY: number; }
interface Bounds { cx: number; cy: number; radius?: number; w?: number; h?: number; }

const TAP_KINDS = new Set<TouchKind>(['pause', 'auto', 'weapon', 'dock']);

// Static layout constants. Hit-areas are computed from these instead
// of measureInWindow because Android returns stale Y values for
// bottom-anchored absolute views, making touch hit-areas disagree
// with the visible button positions (player tapped above the button
// to activate it).
const JOY_BOTTOM = 28;
const JOY_LEFT = 22;
const JOY_SIZE = 130;
const FIRE_BOTTOM = 28;
const FIRE_RIGHT = 22;
const FIRE_SIZE = 100;
const SMALLBTN_W = 70;
const SMALLBTN_H = 36;
const SMALLBTN_GAP = 8;
const SMALL_FIRE_GAP = 10;
const PAUSE_TOP = 180;
const PAUSE_RIGHT = 12;
const PAUSE_W = 90;
const PAUSE_H = 38;

export function Game({ initialWorld, onDocked, onDied, onQuitToMenu }: Props) {
  const worldRef = useRef<World>(initialWorld);
  const inputRef = useRef<InputState>({ dx: 0, dy: 0, fire: false, autoFire: true });
  const [, setTickCount] = useState(0);
  const [autoFire, setAutoFire] = useState(true);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [firePressed, setFirePressed] = useState(false);
  const touchesRef = useRef<Map<number | string, TouchState>>(new Map());

  const screen = Dimensions.get('window');
  const sw = screen.width;
  const sh = screen.height;

  const bounds: Record<TouchKind, Bounds> = {
    joystick: {
      cx: JOY_LEFT + JOY_SIZE / 2,
      cy: sh - JOY_BOTTOM - JOY_SIZE / 2,
      radius: JOY_SIZE / 2,
    },
    fire: {
      cx: sw - FIRE_RIGHT - FIRE_SIZE / 2,
      cy: sh - FIRE_BOTTOM - FIRE_SIZE / 2,
      radius: FIRE_SIZE / 2,
    },
    // AUTO + WEAPON sit in a row above the FIRE button. controlsRight
    // uses alignItems:center on a column whose width equals FIRE's
    // (the widest child), so the row centers on FIRE's X.
    auto: {
      cx: sw - FIRE_RIGHT - FIRE_SIZE / 2 - (SMALLBTN_W + SMALLBTN_GAP) / 2,
      cy: sh - FIRE_BOTTOM - FIRE_SIZE - SMALL_FIRE_GAP - SMALLBTN_H / 2,
      w: SMALLBTN_W,
      h: SMALLBTN_H,
    },
    weapon: {
      cx: sw - FIRE_RIGHT - FIRE_SIZE / 2 + (SMALLBTN_W + SMALLBTN_GAP) / 2,
      cy: sh - FIRE_BOTTOM - FIRE_SIZE - SMALL_FIRE_GAP - SMALLBTN_H / 2,
      w: SMALLBTN_W,
      h: SMALLBTN_H,
    },
    pause: {
      cx: sw - PAUSE_RIGHT - PAUSE_W / 2,
      cy: PAUSE_TOP + PAUSE_H / 2,
      w: PAUSE_W,
      h: PAUSE_H,
    },
    dock: { cx: sw / 2, cy: sh * 0.4 + 30, w: 220, h: 70 },
  };

  useEffect(() => {
    let mounted = true;
    let last = performance.now();
    const loop = () => {
      if (!mounted) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) {
        const w = worldRef.current;
        const res = tick(w, dt, inputRef.current);
        if (res.died) { onDied(w.run); return; }
      }
      setTickCount((t) => (t + 1) | 0);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => { mounted = false; };
  }, []);

  function classify(x: number, y: number): TouchKind | null {
    const joy = bounds.joystick;
    if (joy.radius !== undefined && Math.hypot(x - joy.cx, y - joy.cy) <= joy.radius + 20) return 'joystick';
    const fire = bounds.fire;
    if (fire.radius !== undefined && Math.hypot(x - fire.cx, y - fire.cy) <= fire.radius + 20) return 'fire';

    const dock = bounds.dock;
    if (worldRef.current.nearHarborIndex >= 0 && dock.w !== undefined && dock.h !== undefined) {
      if (Math.abs(x - dock.cx) <= dock.w / 2 + 24 && Math.abs(y - dock.cy) <= dock.h / 2 + 24) return 'dock';
    }

    const pause = bounds.pause;
    if (pause.w !== undefined && pause.h !== undefined) {
      if (Math.abs(x - pause.cx) <= pause.w / 2 + 20 && Math.abs(y - pause.cy) <= pause.h / 2 + 20) return 'pause';
    }

    const a = bounds.auto;
    if (a.w !== undefined && a.h !== undefined) {
      if (Math.abs(x - a.cx) <= a.w / 2 + 16 && Math.abs(y - a.cy) <= a.h / 2 + 16) return 'auto';
    }
    const we = bounds.weapon;
    if (we.w !== undefined && we.h !== undefined) {
      if (Math.abs(x - we.cx) <= we.w / 2 + 16 && Math.abs(y - we.cy) <= we.h / 2 + 16) return 'weapon';
    }

    return null;
  }

  function updateJoystick(px: number, py: number) {
    const b = bounds.joystick;
    if (b.radius === undefined) return;
    const dx = px - b.cx;
    const dy = py - b.cy;
    const r = b.radius;
    const d = Math.hypot(dx, dy);
    const clamped = Math.min(d, r);
    const nx = d > 0 ? dx / d : 0;
    const ny = d > 0 ? dy / d : 0;
    setKnobOffset({ x: nx * clamped, y: ny * clamped });
    inputRef.current.dx = nx * (clamped / r);
    inputRef.current.dy = ny * (clamped / r);
  }

  function clearJoystick() {
    setKnobOffset({ x: 0, y: 0 });
    inputRef.current.dx = 0;
    inputRef.current.dy = 0;
  }

  function setFire(on: boolean) {
    setFirePressed(on);
    inputRef.current.fire = on;
  }

  function setPausedState(next: boolean) {
    pausedRef.current = next;
    setPaused(next);
  }

  function triggerAction(kind: TouchKind) {
    if (kind === 'pause') {
      setPausedState(!pausedRef.current);
    } else if (kind === 'auto') {
      const next = !autoFire;
      setAutoFire(next);
      inputRef.current.autoFire = next;
    } else if (kind === 'weapon') {
      cycleWeapon(worldRef.current);
    } else if (kind === 'dock') {
      const w = worldRef.current;
      if (w.nearHarborIndex >= 0) {
        pausedRef.current = true;
        setPaused(true);
        dockAt(w, w.nearHarborIndex);
        onDocked(w, w.nearHarborIndex);
      }
    }
  }

  // While paused, root touch dispatch is bypassed so the in-overlay
  // Pressable buttons (RESUME, QUIT, etc.) receive their own taps.
  function shouldSetResponder(e: GestureResponderEvent) {
    if (pausedRef.current) return false;
    return classify(e.nativeEvent.pageX, e.nativeEvent.pageY) !== null;
  }

  function processTouches(e: GestureResponderEvent) {
    if (pausedRef.current) return;
    const active = e.nativeEvent.touches || [];
    const activeIds = new Set(active.map((t) => t.identifier));

    for (const t of active) {
      const id = t.identifier;
      if (!touchesRef.current.has(id)) {
        const kind = classify(t.pageX, t.pageY);
        if (!kind) continue;
        touchesRef.current.set(id, { kind, startX: t.pageX, startY: t.pageY });
        if (kind === 'fire') setFire(true);
        else if (TAP_KINDS.has(kind)) triggerAction(kind);
      }
      const state = touchesRef.current.get(id);
      if (state?.kind === 'joystick') updateJoystick(t.pageX, t.pageY);
    }

    const ended = (e.nativeEvent.changedTouches || []).filter(
      (t) => !activeIds.has(t.identifier)
    );
    for (const t of ended) {
      const state = touchesRef.current.get(t.identifier);
      if (!state) continue;
      touchesRef.current.delete(t.identifier);
      if (state.kind === 'fire') setFire(false);
      else if (state.kind === 'joystick') clearJoystick();
    }
  }

  function onResponderRelease() {
    for (const state of Array.from(touchesRef.current.values())) {
      if (state.kind === 'fire') setFire(false);
      else if (state.kind === 'joystick') clearJoystick();
    }
    touchesRef.current.clear();
  }

  function onResume() { setPausedState(false); }

  function onQuitMenu() {
    setPausedState(false);
    onQuitToMenu(worldRef.current);
  }

  function onSaveQuit() {
    onQuitToMenu(worldRef.current);
    setTimeout(() => {
      try { BackHandler.exitApp(); } catch { /* iOS / web no-op */ }
    }, 80);
  }

  const w = worldRef.current;
  const cam = w.camera;
  const zoom = w.cameraZoom || 1;
  const shakeAmount = w.shake;
  const sx = (Math.random() - 0.5) * shakeAmount;
  const sy = (Math.random() - 0.5) * shakeAmount;
  // World-coord -> screen-pixel transform. Both axes scale by zoom
  // so this layer stays in lockstep with the 3D layer's orthographic
  // frustum (Render3D.tsx applies the same zoom to camera bounds).
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
      onStartShouldSetResponder={shouldSetResponder}
      onMoveShouldSetResponder={shouldSetResponder}
      onResponderGrant={processTouches}
      onResponderMove={processTouches}
      onResponderRelease={onResponderRelease}
      onResponderTerminate={onResponderRelease}
    >
      {RENDER_3D && <Render3D worldRef={worldRef} />}

      <Svg width={sw} height={sh} style={StyleSheet.absoluteFill} pointerEvents="none">
        {waveLines.map((wl, i) => (
          <Line
            key={'w' + i}
            x1={0} y1={wl.y} x2={sw} y2={wl.y + 6}
            stroke={stormy ? COLORS.stormWave : COLORS.oceanWave}
            strokeWidth={1.5}
          />
        ))}

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
          (pk, i) =>
            onScreen(pk.pos.x, pk.pos.y, 30) && (
              <Circle key={'pk' + i} cx={toX(pk.pos.x)} cy={toY(pk.pos.y)}
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
          (b, i) =>
            onScreen(b.pos.x, b.pos.y, 20) && (
              <Circle key={'b' + i} cx={toX(b.pos.x)} cy={toY(b.pos.y)} r={b.size * zoom} fill={b.color} />
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

      <HUD run={w.run} player={w.player} weather={w.run.weather}
        bossActive={!!boss} bossHp={boss ? { current: boss.hull, max: boss.maxHull } : null} />

      {w.nearHarborIndex >= 0 && (
        <View style={styles.dockPrompt} pointerEvents="none">
          <Text style={styles.dockPromptLabel}>DOCK AT</Text>
          <Text style={styles.dockPromptName}>{w.harbors[w.nearHarborIndex].name}</Text>
        </View>
      )}

      <View style={styles.controlsLeft} pointerEvents="none">
        <Joystick knob={knobOffset} />
      </View>

      <View style={styles.controlsRight} pointerEvents="none">
        <View style={styles.smallBtnRow}>
          <View style={[styles.smallBtn, autoFire && styles.smallBtnOn]}>
            <Text style={styles.smallBtnText}>AUTO</Text>
          </View>
          <View style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>
              {w.run.weaponMode === 0 ? 'SINGLE' : w.run.weaponMode === 1 ? 'SPREAD' : 'TWIN'}
            </Text>
          </View>
        </View>
        <FireButton pressed={firePressed} />
      </View>

      <View style={styles.pauseBtn} pointerEvents="none">
        <Text style={styles.pauseText}>{paused ? 'RESUME' : 'PAUSE'}</Text>
      </View>

      {paused && w.dockedHarborIndex < 0 && (
        <View style={styles.pauseOverlay}>
          <Text style={styles.pauseOverlayText}>PAUSED</Text>
          <View style={styles.pauseMenu}>
            <Pressable style={styles.pauseMenuPrimary} onPress={onResume}>
              <Text style={styles.pauseMenuPrimaryText}>RESUME</Text>
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
  controlsLeft: { position: 'absolute', bottom: JOY_BOTTOM, left: JOY_LEFT },
  controlsRight: {
    position: 'absolute',
    bottom: FIRE_BOTTOM,
    right: FIRE_RIGHT,
    alignItems: 'center',
    gap: SMALL_FIRE_GAP,
  },
  smallBtnRow: { flexDirection: 'row', gap: SMALLBTN_GAP },
  smallBtn: {
    backgroundColor: 'rgba(3,16,28,0.6)',
    borderColor: COLORS.hudBorder,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    minWidth: SMALLBTN_W,
    height: SMALLBTN_H,
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
    top: '40%',
    alignSelf: 'center',
    backgroundColor: 'rgba(251,191,36,0.92)',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  dockPromptLabel: { color: COLORS.bg, fontSize: 10, letterSpacing: 3, fontWeight: '800' },
  dockPromptName: { color: COLORS.bg, fontSize: 18, fontWeight: '900', letterSpacing: 2, marginTop: 2 },
  pauseBtn: {
    position: 'absolute',
    top: PAUSE_TOP,
    right: PAUSE_RIGHT,
    width: PAUSE_W,
    height: PAUSE_H,
    backgroundColor: 'rgba(3,16,28,0.7)',
    borderColor: COLORS.hudBorder,
    borderWidth: 1,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
