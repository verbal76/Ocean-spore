import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../colors';
import { Run } from '../game/types';

interface Props {
  run: Run;
  newUnlocks: string[];
  onRetry: () => void;
  onMenu: () => void;
}

export function GameOverScreen({ run, newUnlocks, onRetry, onMenu }: Props) {
  const seconds = Math.max(1, Math.floor(run.activeSeconds));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <View style={styles.root}>
      <Text style={styles.title}>WRECKED</Text>
      <Text style={styles.subtitle}>Your ship slips beneath the waves.</Text>

      <View style={styles.stats}>
        <Stat label="SCORE" value={String(run.score)} />
        <Stat label="KILLS" value={String(run.kills)} />
        <Stat label="PARTS GATHERED" value={String(run.totalParts)} />
        <Stat label="TIME ALIVE" value={`${mm}:${ss}`} />
      </View>

      {newUnlocks.length > 0 && (
        <View style={styles.unlockBox}>
          <Text style={styles.unlockHeader}>NEW SHIPS UNLOCKED</Text>
          {newUnlocks.map((n) => (
            <Text key={n} style={styles.unlockName}>{n}</Text>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.btn} onPress={onRetry}>
          <Text style={styles.btnText}>RETRY</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onMenu}>
          <Text style={[styles.btnText, styles.btnSecondaryText]}>MAIN MENU</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.panel,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 36,
    alignItems: 'center',
  },
  title: {
    color: '#f87171',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 8,
  },
  subtitle: {
    color: COLORS.textDim,
    fontSize: 13,
    marginTop: 10,
    letterSpacing: 1.5,
  },
  stats: {
    marginTop: 32,
    gap: 12,
    width: '100%',
  },
  stat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.hudBorder,
  },
  statLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  unlockBox: {
    marginTop: 22,
    padding: 14,
    width: '100%',
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    alignItems: 'center',
  },
  unlockHeader: {
    color: COLORS.momentum,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '800',
    marginBottom: 6,
  },
  unlockName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  actions: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  btnText: {
    color: COLORS.bg,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.hudBorder,
  },
  btnSecondaryText: {
    color: COLORS.textDim,
  },
});
