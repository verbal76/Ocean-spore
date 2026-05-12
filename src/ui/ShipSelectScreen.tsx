import { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../colors';
import { SHIPS } from '../data/ships';

interface Props {
  captainName: string;
  unlockedShips: string[];
  selectedShipId: string;
  highScore: number;
  lifetimeKills: number;
  lifetimeParts: number;
  onSelectShip: (id: string) => void;
  onStart: () => void;
  onBack: () => void;
}

export function ShipSelectScreen({
  captainName, unlockedShips, selectedShipId, highScore, lifetimeKills, lifetimeParts,
  onSelectShip, onStart, onBack,
}: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const hasLifetime = lifetimeKills > 0 || lifetimeParts > 0;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={onBack} hitSlop={12}>
          <Text style={styles.backText}>{'<  BACK'}</Text>
        </Pressable>
        <Text style={styles.label}>SHIPYARD</Text>
        <Text style={styles.title}>SELECT VESSEL</Text>
        {captainName ? <Text style={styles.captain}>Captain {captainName}</Text> : null}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {SHIPS.map((s) => {
          const unlocked = unlockedShips.includes(s.id);
          const selected = s.id === selectedShipId;
          return (
            <Pressable
              key={s.id}
              disabled={!unlocked}
              onPress={() => onSelectShip(s.id)}
              style={[
                styles.shipChip,
                selected && styles.shipChipSelected,
                !unlocked && styles.shipChipLocked,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.shipChipName, !unlocked && styles.shipChipNameLocked]}>
                  {s.name}
                </Text>
                <Text style={styles.shipChipDesc}>
                  {unlocked ? s.description : `Unlock @ ${s.unlockKills} kills`}
                </Text>
                <Text style={styles.shipStats}>
                  HULL {s.baseHull} · SPD {s.baseSpeed} · DMG {s.baseDamage}
                </Text>
              </View>
              {selected && (
                <View style={styles.selectedTag}>
                  <Text style={styles.selectedTagText}>SELECTED</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.bottom}>
        {highScore > 0 && <Text style={styles.high}>BEST {highScore}</Text>}
        {hasLifetime && (
          <Text style={styles.lifetime}>
            LIFETIME · {lifetimeKills} kills · {lifetimeParts} parts
          </Text>
        )}
        <Pressable onPress={onStart} style={styles.startBtn}>
          <Animated.Text
            style={[
              styles.startText,
              { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
            ]}
          >
            SET SAIL
          </Animated.Text>
        </Pressable>
        <Text style={styles.hint}>Joystick (L) moves · Auto-fire on · Tap FIRE for manual</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 22, paddingTop: 56, paddingBottom: 28 },
  header: { alignItems: 'center', marginBottom: 12 },
  back: { position: 'absolute', top: 0, left: 0, paddingVertical: 6, paddingHorizontal: 8 },
  backText: { color: COLORS.textDim, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  label: { color: COLORS.textDim, fontSize: 11, letterSpacing: 4 },
  title: { color: COLORS.accent, fontSize: 22, fontWeight: '900', letterSpacing: 3, marginTop: 6 },
  captain: { color: COLORS.textMuted, fontSize: 12, marginTop: 6, letterSpacing: 1 },
  scroll: { flex: 1 },
  scrollContent: { gap: 8, paddingVertical: 6, paddingBottom: 20 },
  shipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  shipChipSelected: { borderColor: COLORS.accent, backgroundColor: 'rgba(34,211,238,0.10)' },
  shipChipLocked: { opacity: 0.4 },
  shipChipName: { color: COLORS.text, fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  shipChipNameLocked: { color: COLORS.textMuted },
  shipChipDesc: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },
  shipStats: { color: COLORS.textDim, fontSize: 10, marginTop: 4, letterSpacing: 0.8 },
  selectedTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: COLORS.accent },
  selectedTagText: { color: COLORS.bg, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  bottom: { alignItems: 'center', gap: 8 },
  high: { color: COLORS.momentum, fontSize: 12, letterSpacing: 3, fontWeight: '800' },
  lifetime: { color: COLORS.textMuted, fontSize: 10, letterSpacing: 1.5, fontWeight: '600' },
  startBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 56, paddingVertical: 18, borderRadius: 999, marginTop: 4 },
  startText: { color: COLORS.bg, fontSize: 20, fontWeight: '900', letterSpacing: 4 },
  hint: { color: COLORS.textMuted, fontSize: 11, letterSpacing: 1, textAlign: 'center', marginTop: 4 },
});
