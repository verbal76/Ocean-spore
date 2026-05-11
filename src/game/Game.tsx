import { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon, Rect } from 'react-native-svg';
import { COLORS } from '../colors';
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

export function Game({ initialWorld, onDocked, onDied }: Props) {
  const worldRef = useRef<World>(initialWorld);
  const inputRef = useRef<InputState>({ dx: 0, dy: 0, fire: false, autoFire: true });
  const [, setTickCount] = useState(0);
  const [autoFire, setAutoFire] = useState(true);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const screen = Dimensions.get('window');

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

  function tryDock() {
    const w = worldRef.current;
    if (w.nearHarborIndex >= 0) {
      pausedRef.current = true;
      setPaused(true);
      dockAt(w, w.nearHarborIndex);
      onDocked(w, w.nearHarborIndex);
    }
  }

  function toggleAutoFire() {
    const next = !autoFire;
    setAutoFire(next);
    inputRef.current.autoFire = next;
  }

  function onCycle() {
    cycleWeapon(worldRef.current);
  }

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
    <View style={[styles.root, stormy && { backgroundColor: COLORS.storm }]}>
      <Svg width={sw} height={sh} style={StyleSheet.absoluteFill}>
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

        <Rect x={camX} y={camY} width={2400} height={2400} fill="none" stroke="rgba(135,206,250,0.15)" strokeWidth={2} />

        {w.harbors.map((h, i) => onScreen(h.pos.x, h.pos.y, 200) && (
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
            <Circle cx={h.pos.x + camX} cy={h.pos.y + camY} r={30} fill={COLORS.harbor} stroke="#7c5e2f" strokeWidth={2} />
            <Rect x={h.pos.x + camX - 18} y={h.pos.y + camY - 4} width={36} height={8} fill="#7c5e2f" />
          </G>
        ))}

        {w.pickups.map((pk, i) => onScreen(pk.pos.x, pk.pos.y, 30) && (
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
        ))}

        {w.enemies.map((e, i) => {
          if (!onScreen(e.pos.x, e.pos.y, 80)) return null;
          const t = `translate(${e.pos.x + camX} ${e.pos.y + camY}) rotate(${(e.angle * 180) / Math.PI}) scale(${e.size})`;
          const poly = e.isBoss ? BOSS_POLY : ENEMY_POLY;
          return (
            <G key={'e' + i} transform={t}>
              <Polygon points={poly} fill={e.color} />
              <Circle cx={0} cy={0} r={0.25} fill="rgba(255,255,255,0.4)" />
            </G>
          );
        })}

        {w.bullets.map((b, i) => onScreen(b.pos.x, b.pos.y, 20) && (
          <Circle key={'b' + i} cx={b.pos.x + camX} cy={b.pos.y + camY} r={b.size} fill={b.color} />
        ))}

        {(() => {
          const p = w.player;
          const hullFrac = p.hull / p.maxHull;
          const damaged = hullFrac < 0.45;
          const t = `translate(${p.pos.x + camX} ${p.pos.y + camY}) rotate(${(p.angle * 180) / Math.PI}) scale(${p.size})`;
          return (
            <G transform={t}>
              <Polygon points={SHIP_POLY} fill={damaged ? '#f59e0b' : p.color} stroke="rgba(255,255,255,0.25)" strokeWidth={0.04} />
              <Rect x={-0.2} y={-0.22} width={0.45} height={0.44} fill="rgba(255,255,255,0.30)" />
              {damaged && <Circle cx={-0.4} cy={0} r={0.18} fill="rgba(248,113,113,0.55)" />}
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
        <Pressable style={styles.dockPrompt} onPress={tryDock}>
          <Text style={styles.dockPromptLabel}>DOCK AT</Text>
          <Text style={styles.dockPromptName}>{w.harbors[w.nearHarborIndex].name}</Text>
        </Pressable>
      )}

      <View style={styles.controlsLeft}>
        <Joystick
          onChange={(dx, dy) => {
            inputRef.current.dx = dx;
            inputRef.current.dy = dy;
          }}
        />
      </View>

      <View style={styles.controlsRight}>
        <View style={styles.smallBtnRow}>
          <Pressable
            style={[styles.smallBtn, autoFire && styles.smallBtnOn]}
            onPress={toggleAutoFire}
          >
            <Text style={styles.smallBtnText}>AUTO</Text>
          </Pressable>
          <Pressable style={styles.smallBtn} onPress={onCycle}>
            <Text style={styles.smallBtnText}>
              {w.run.weaponMode === 0 ? 'SINGLE' : w.run.weaponMode === 1 ? 'SPREAD' : 'TWIN'}
            </Text>
          </Pressable>
        </View>
        <FireButton
          onChange={(pressed) => {
            inputRef.current.fire = pressed;
          }}
        />
      </View>

      <Pressable
        style={styles.pauseBtn}
        onPress={() => {
          pausedRef.current = !pausedRef.current;
          setPaused(pausedRef.current);
        }}
      >
        <Text style={styles.pauseText}>{paused ? 'RESUME' : 'PAUSE'}</Text>
      </Pressable>

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
  controlsRight: { position: 'absolute', bottom: 28, right: 22, alignItems: 'center', gap: 10 },
  smallBtnRow: { flexDirection: 'row', gap: 8 },
  smallBtn: { backgroundColor: 'rgba(3,16,28,0.6)', borderColor: COLORS.hudBorder, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  smallBtnOn: { borderColor: COLORS.accent, backgroundColor: 'rgba(34,211,238,0.18)' },
  smallBtnText: { color: COLORS.text, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  dockPrompt: { position: 'absolute', top: '40%', alignSelf: 'center', backgroundColor: 'rgba(251,191,36,0.92)', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  dockPromptLabel: { color: COLORS.bg, fontSize: 10, letterSpacing: 3, fontWeight: '800' },
  dockPromptName: { color: COLORS.bg, fontSize: 18, fontWeight: '900', letterSpacing: 2, marginTop: 2 },
  pauseBtn: { position: 'absolute', top: 36, right: 12, backgroundColor: 'rgba(3,16,28,0.7)', borderColor: COLORS.hudBorder, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pauseText: { color: COLORS.text, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  pauseOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3,16,28,0.6)', alignItems: 'center', justifyContent: 'center' },
  pauseOverlayText: { color: COLORS.text, fontSize: 32, fontWeight: '900', letterSpacing: 8 },
});
