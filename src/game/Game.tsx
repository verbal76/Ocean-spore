import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  GestureResponderEvent,
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
import {
  cycleWeapon,
  dockAt,
  InputState,
  tick,
  World,
} from './world';

interface Props {
  initialWorld: World;
  onDocked: (world: World, harborIdx: number) => void;
  onDied: (run: Run) => void;
}

const SHIP_POLY = '1.0,0 -0.55,-0.55 -0.30,0 -0.55,0.55';
const ENEMY_POLY = '0.9,0 -0.85,-0.6 -0.40,0 -0.85,0.6';
const BOSS_POLY = '1.0,0 0.0,-0.7 -0.9,-0.5 -0.6,0 -0.9,0.5 0.0,0.7';

type TouchKind = 'joystick' | 'fire' | 'pause' | 'auto' | 'weapon' | 'dock';
interface TouchState {
  kind: TouchKind;
  startX: number;
  startY: number;
}
interface Bounds {
  cx: number;
  cy: number;
  radius?: number;
  w?: number;
  h?: number;
}

export function Game({ initialWorld, onDocked, onDied }: Props) {
  const worldRef = useRef<World>(initialWorld);
  const inputRef = useRef<InputState>({ dx: 0, dy: 0, fire: false, autoFire: true });
  const [, setTickCount] = useState(0);
  const [autoFire, setAutoFire] = useState(true);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  // Multi-touch state. Knob and pressed are driven from the root
  // touch dispatcher; the Joystick / FireButton components are pure
  // visual.
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [firePressed, setFirePressed] = useState(false);
  const touchesRef = useRef<Map<number, TouchState>>(new Map());
  const boundsRef = useRef<Partial<Record<TouchKind, Bounds>>>({});

  const screen = Dimensions.get('window');

  // Game loop.
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
        if (res.died) {
          onDied(w.run);
          return;
        }
      }
      setTickCount((t) => (t + 1) | 0);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return () => {
      mounted = false;
    };
  }, []);

  // ----- Touch dispatcher -----
  // Captures every touch on the root playing-screen View, classifies
  // it by which on-screen control it landed on, then routes its
  // lifecycle accordingly:
  //   joystick: continuous knob update on move
  //   fire: press-and-hold flag while finger is down
  //   pause / auto / weapon / dock: tap-style; fires action on touch
  //     end if the finger lifted within the same region it started.
  // The Joystick and FireButton components are visual only
  // (pointerEvents="none") so they never claim responder.

  function classify(x: number, y: number): TouchKind | null {
    const order: TouchKind[] = ['joystick', 'fire', 'dock', 'pause', 'auto', 'weapon'];
    for (const kind of order) {
      const b = boundsRef.current[kind];
      if (!b) continue;
      if (kind === 'dock' && worldRef.current.nearHarborIndex < 0) continue;
      if (b.radius !== undefined) {
        if (Math.hypot(x - b.cx, y - b.cy) <= b.radius + 16) return kind;
      } else if (b.w !== undefined && b.h !== undefined) {
        if (
          Math.abs(x - b.cx) <= b.w / 2 + 12 &&
          Math.abs(y - b.cy) <= b.h / 2 + 12
        )
          return kind;
      }
    }
    return null;
  }

  function updateJoystick(px: number, py: number) {
    const b = boundsRef.current.joystick;
    if (!b || b.radius === undefined) return;
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

  function triggerAction(kind: TouchKind) {
    if (kind === 'pause') {
      pausedRef.current = !pausedRef.current;
      setPaused(pausedRef.current);
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

  function shouldSetResponder(e: GestureResponderEvent) {
    return classify(e.nativeEvent.pageX, e.nativeEvent.pageY) !== null;
  }

  function processTouches(e: GestureResponderEvent) {
    const active = e.nativeEvent.touches || [];
    const activeIds = new Set(active.map((t) => t.identifier));

    // Process active touches (new + moving).
    for (const t of active) {
      const id = t.identifier;
      if (!touchesRef.current.has(id)) {
        const kind = classify(t.pageX, t.pageY);
        if (!kind) continue;
        touchesRef.current.set(id, { kind, startX: t.pageX, startY: t.pageY });
        if (kind === 'fire') setFire(true);
      }
      const state = touchesRef.current.get(id);
      if (state?.kind === 'joystick') updateJoystick(t.pageX, t.pageY);
    }

    // Handle ended touches: any tracked id not in activeIds.
    const ended = (e.nativeEvent.changedTouches || []).filter(
      (t) => !activeIds.has(t.identifier)
    );
    for (const t of ended) {
      const state = touchesRef.current.get(t.identifier);
      if (!state) continue;
      touchesRef.current.delete(t.identifier);
      const endKind = classify(t.pageX, t.pageY);
      if (state.kind === 'fire') {
        setFire(false);
      } else if (state.kind === 'joystick') {
        clearJoystick();
      } else if (endKind === state.kind) {
        // Tap completed in same region as it started.
        triggerAction(state.kind);
      }
    }
  }

  function onResponderRelease() {
    // All touches ended. Clean up any state we still hold.
    for (const state of Array.from(touchesRef.current.values())) {
      if (state.kind === 'fire') setFire(false);
      else if (state.kind === 'joystick') clearJoystick();
    }
    touchesRef.current.clear();
  }

  // Helper to wrap a small button View. Reports its measured bounds
  // to the dispatcher via onLayout + measureInWindow.
  function buttonBounds(kind: TouchKind, ref: React.RefObject<View | null>) {
    return () => {
      const node = ref.current as any;
      if (node && typeof node.measureInWindow === 'function') {
        node.measureInWindow((x: number, y: number, w: number, h: number) => {
          boundsRef.current[kind] = { cx: x + w / 2, cy: y + h / 2, w, h };
        });
      }
    };
  }

  // Refs for tap-style buttons.
  const pauseRef = useRef<View>(null);
  const autoRef = useRef<View>(null);
  const weaponRef = useRef<View>(null);
  const dockRef = useRef<View>(null);

  // ----- World rendering setup -----
  const w = worldRef.current;
  const cam = w.camera;
  const sw = screen.width;
  const sh = screen.height;
  const shakeAmount = w.shake;
  const sx = (Math.random() - 0.5) * shakeAmount;
  const sy = (Math.random() - 0.5) * shakeAmount;
  const camX = sw / 2 - cam.x + sx;
  const camY = sh / 2 - cam.y + sy;

  function onScreen(x: number, y: number, margin: number) {
    const px = x + camX;
    const py = y + camY;
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
            x1={0}
            y1={wl.y}
            x2={sw}
            y2={wl.y + 6}
            stroke={stormy ? COLORS.stormWave : COLORS.oceanWave}
            strokeWidth={1.5}
          />
        ))}

        <Rect
          x={camX}
          y={camY}
          width={2400}
          height={2400}
          fill="none"
          stroke="rgba(135,206,250,0.15)"
          strokeWidth={2}
        />

        {w.salvageRings.map((r, i) => {
          if (!r.active) return null;
          if (!onScreen(r.pos.x, r.pos.y, 120)) return null;
          const pulseScale = 1 + 0.04 * Math.sin(r.pulse * 2.4);
          return (
            <G key={'sr' + i}>
              <Circle
                cx={r.pos.x + camX}
                cy={r.pos.y + camY}
                r={r.radius * pulseScale}
                fill="rgba(251,191,36,0.06)"
                stroke="#fbbf24"
                strokeWidth={1.5}
                strokeDasharray="4 8"
              />
              <Circle
                cx={r.pos.x + camX}
                cy={r.pos.y + camY}
                r={9}
                fill="#fbbf24"
                opacity={0.9}
              />
              <Circle
                cx={r.pos.x + camX}
                cy={r.pos.y + camY}
                r={4}
                fill="#fef3c7"
              />
            </G>
          );
        })}

        {w.harbors.map(
          (h, i) =>
            onScreen(h.pos.x, h.pos.y, 200) && (
              <G key={'h' + i}>
                <Circle
                  cx={h.pos.x + camX}
                  cy={h.pos.y + camY}
                  r={h.radius}
                  fill="rgba(251,191,36,0.06)"
                  stroke={i === w.nearHarborIndex ? '#fbbf24' : 'rgba(251,191,36,0.4)'}
                  strokeWidth={i === w.nearHarborIndex ? 3 : 1.5}
                  strokeDasharray="6 6"
                />
                <Circle
                  cx={h.pos.x + camX}
                  cy={h.pos.y + camY}
                  r={30}
                  fill={COLORS.harbor}
                  stroke="#7c5e2f"
                  strokeWidth={2}
                />
                <Rect
                  x={h.pos.x + camX - 18}
                  y={h.pos.y + camY - 4}
                  width={36}
                  height={8}
                  fill="#7c5e2f"
                />
              </G>
            )
        )}

        {w.pickups.map(
          (pk, i) =>
            onScreen(pk.pos.x, pk.pos.y, 30) && (
              <Circle
                key={'pk' + i}
                cx={pk.pos.x + camX}
                cy={pk.pos.y + camY}
                r={pk.kind === 'crate' ? 9 : 6}
                fill={pk.color}
                stroke="rgba(255,255,255,0.7)"
                strokeWidth={1}
                opacity={pk.life < 3 ? (Math.sin(pk.life * 14) > 0 ? 1 : 0.35) : 1}
              />
            )
        )}

        {/* When the 3D underlay is active, hide the SVG ship polygons so
            the GLB meshes are visible. Bullets, pickups, particles, and
            HUD continue to render above. */}
        {!RENDER_3D &&
          w.enemies.map((e, i) => {
            if (!onScreen(e.pos.x, e.pos.y, 80)) return null;
            const t = `translate(${e.pos.x + camX} ${e.pos.y + camY}) rotate(${
              (e.angle * 180) / Math.PI
            }) scale(${e.size})`;
            const poly = e.isBoss ? BOSS_POLY : ENEMY_POLY;
            return (
              <G key={'e' + i} transform={t}>
                <Polygon points={poly} fill={e.color} />
                <Circle cx={0} cy={0} r={0.25} fill="rgba(255,255,255,0.4)" />
              </G>
            );
          })}

        {w.bullets.map(
          (b, i) =>
            onScreen(b.pos.x, b.pos.y, 20) && (
              <Circle
                key={'b' + i}
                cx={b.pos.x + camX}
                cy={b.pos.y + camY}
                r={b.size}
                fill={b.color}
              />
            )
        )}

        {!RENDER_3D &&
          (() => {
            const p = w.player;
            const hullFrac = p.hull / p.maxHull;
            const damaged = hullFrac < 0.45;
            const t = `translate(${p.pos.x + camX} ${p.pos.y + camY}) rotate(${
              (p.angle * 180) / Math.PI
            }) scale(${p.size})`;
            return (
              <G transform={t}>
                <Polygon
                  points={SHIP_POLY}
                  fill={damaged ? '#f59e0b' : p.color}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth={0.04}
                />
                <Rect
                  x={-0.2}
                  y={-0.22}
                  width={0.45}
                  height={0.44}
                  fill="rgba(255,255,255,0.30)"
                />
                {damaged && (
                  <Circle cx={-0.4} cy={0} r={0.18} fill="rgba(248,113,113,0.55)" />
                )}
              </G>
            );
          })()}

        {w.particles.map((pt, i) => {
          if (!onScreen(pt.pos.x, pt.pos.y, 20)) return null;
          const a = Math.max(0, pt.life / pt.maxLife);
          return (
            <Rect
              key={'p' + i}
              x={pt.pos.x + camX - pt.size / 2}
              y={pt.pos.y + camY - pt.size / 2}
              width={pt.size}
              height={pt.size}
              fill={pt.color}
              opacity={a}
            />
          );
        })}
      </Svg>

      <HUD
        run={w.run}
        player={w.player}
        weather={w.run.weather}
        bossActive={!!boss}
        bossHp={boss ? { current: boss.hull, max: boss.maxHull } : null}
      />

      {w.nearHarborIndex >= 0 && (
        <View
          ref={dockRef}
          onLayout={buttonBounds('dock', dockRef)}
          style={styles.dockPrompt}
          pointerEvents="none"
        >
          <Text style={styles.dockPromptLabel}>DOCK AT</Text>
          <Text style={styles.dockPromptName}>
            {w.harbors[w.nearHarborIndex].name}
          </Text>
        </View>
      )}

      <View style={styles.controlsLeft} pointerEvents="box-none">
        <Joystick
          knob={knobOffset}
          onBounds={(cx, cy, radius) => {
            boundsRef.current.joystick = { cx, cy, radius };
          }}
        />
      </View>

      <View style={styles.controlsRight} pointerEvents="box-none">
        <View style={styles.smallBtnRow} pointerEvents="box-none">
          <View
            ref={autoRef}
            onLayout={buttonBounds('auto', autoRef)}
            style={[styles.smallBtn, autoFire && styles.smallBtnOn]}
            pointerEvents="none"
          >
            <Text style={styles.smallBtnText}>AUTO</Text>
          </View>
          <View
            ref={weaponRef}
            onLayout={buttonBounds('weapon', weaponRef)}
            style={styles.smallBtn}
            pointerEvents="none"
          >
            <Text style={styles.smallBtnText}>
              {w.run.weaponMode === 0
                ? 'SINGLE'
                : w.run.weaponMode === 1
                ? 'SPREAD'
                : 'TWIN'}
            </Text>
          </View>
        </View>
        <FireButton
          pressed={firePressed}
          onBounds={(cx, cy, radius) => {
            boundsRef.current.fire = { cx, cy, radius };
          }}
        />
      </View>

      <View
        ref={pauseRef}
        onLayout={buttonBounds('pause', pauseRef)}
        style={styles.pauseBtn}
        pointerEvents="none"
      >
        <Text style={styles.pauseText}>{paused ? 'RESUME' : 'PAUSE'}</Text>
      </View>

      {paused && w.dockedHarborIndex < 0 && (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <Text style={styles.pauseOverlayText}>PAUSED</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ocean },
  controlsLeft: { position: 'absolute', bottom: 28, left: 22 },
  controlsRight: {
    position: 'absolute',
    bottom: 28,
    right: 22,
    alignItems: 'center',
    gap: 10,
  },
  smallBtnRow: { flexDirection: 'row', gap: 8 },
  smallBtn: {
    backgroundColor: 'rgba(3,16,28,0.6)',
    borderColor: COLORS.hudBorder,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  smallBtnOn: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(34,211,238,0.18)',
  },
  smallBtnText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
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
  dockPromptLabel: {
    color: COLORS.bg,
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '800',
  },
  dockPromptName: {
    color: COLORS.bg,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 2,
  },
  pauseBtn: {
    position: 'absolute',
    top: 180,
    right: 12,
    backgroundColor: 'rgba(3,16,28,0.7)',
    borderColor: COLORS.hudBorder,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pauseText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3,16,28,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseOverlayText: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 8,
  },
});
