import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../colors';
import { Run, PlayerShip } from '../game/types';
import { SHIPS_BY_ID } from '../data/ships';

interface Props {
  run: Run;
  player: PlayerShip;
  weather: 'clear' | 'storm';
  bossActive: boolean;
  bossHp: { current: number; max: number } | null;
}

export function HUD({ run, player, weather, bossActive, bossHp }: Props) {
  const shipName = SHIPS_BY_ID[player.classId]?.name ?? player.classId;
  const hullPct = Math.max(0, (player.hull / player.maxHull) * 100);
  const hullLow = hullPct < 30;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={styles.panel}>
          <Text style={styles.label}>SHIP</Text>
          <Text style={styles.value}>{shipName}</Text>
        </View>
        <View style={styles.panel}>
          <Text style={styles.label}>PARTS</Text>
          <Text style={[styles.value, { color: COLORS.parts }]}>{run.parts}</Text>
        </View>
      </View>

      <View style={styles.bars}>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>HULL</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${hullPct}%`,
                  backgroundColor: hullLow ? COLORS.hullLow : COLORS.hull,
                },
              ]}
            />
          </View>
          <Text style={styles.barNumber}>{Math.ceil(player.hull)}/{player.maxHull}</Text>
        </View>
        <View style={styles.barRow}>
          <Text style={styles.barLabel}>MOMENT</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${run.momentum}%`, backgroundColor: COLORS.momentum },
              ]}
            />
          </View>
          <Text style={styles.barNumber}>{Math.floor(run.momentum)}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Text style={styles.statText}>KILLS {run.kills}</Text>
        <Text style={styles.statText}>SCORE {run.score}</Text>
        {weather === 'storm' && <Text style={styles.stormText}>STORM</Text>}
      </View>

      {bossActive && bossHp && (
        <View style={styles.bossWrap}>
          <Text style={styles.bossLabel}>DREADNOUGHT</Text>
          <View style={styles.bossBar}>
            <View
              style={[
                styles.bossFill,
                { width: `${(bossHp.current / bossHp.max) * 100}%` },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 36,
    paddingHorizontal: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  panel: {
    backgroundColor: COLORS.hud,
    borderColor: COLORS.hudBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 96,
  },
  label: {
    color: COLORS.textDim,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  value: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bars: {
    marginTop: 8,
    backgroundColor: COLORS.hud,
    borderColor: COLORS.hudBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    letterSpacing: 1,
    minWidth: 50,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  barNumber: {
    color: COLORS.text,
    fontSize: 10,
    letterSpacing: 0.5,
    minWidth: 52,
    textAlign: 'right',
  },
  stats: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'flex-start',
    paddingLeft: 4,
  },
  statText: {
    color: COLORS.textDim,
    fontSize: 11,
    letterSpacing: 1,
  },
  stormText: {
    color: '#fbbf24',
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '800',
  },
  bossWrap: {
    marginTop: 10,
    alignItems: 'center',
  },
  bossLabel: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 4,
  },
  bossBar: {
    width: '85%',
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.5)',
  },
  bossFill: {
    height: '100%',
    backgroundColor: '#dc2626',
  },
});
