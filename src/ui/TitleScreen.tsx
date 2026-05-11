import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../colors';
import { SHIPS } from '../data/ships';

interface Props {
  unlockedShips: string[];
  highScore: number;
  lifetimeKills: number;
  lifetimeParts: number;
  selectedShipId: string;
  onSelectShip: (id: string) => void;
  onStart: () => void;
}

export function TitleScreen({
  unlockedShips,
  highScore,
  lifetimeKills,
  lifetimeParts,
  selectedShipId,
  onSelectShip,
  onStart,
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
      <View style={styles.heroWrap}>
        <Text style={styles.subtitle}>NAVAL SURVIVAL · ARCADE</Text>
        <Text style={styles.title}>{'OCEAN\nSPORE'}</Text>
        <Text style={styles.tag}>Start as a junk raft. Become a floating apocalypse.</Text>
      </View>

      <View style={styles.shipPicker}>
        <Text style={styles.shipPickerLabel}>SELECT VESSEL</Text>
        <View style={styles.shipList}>
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
                <Text style={[styles.shipChipName, !unlocked && styles.shipChipNameLocked]}>
                  {s.name}
                </Text>
                <Text style={styles.shipChipDesc}>
                  {unlocked ? s.description : `Unlock @ ${s.unlockKills} kills`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.bottom}>
        {highScore > 0 && (
          <Text style={styles.high}>BEST {highScore}</Text>
        )}
        {hasLifetime && (
          <Text style={styles.lifetime}>
            LIFETIME · {lifetimeKills} kills · {lifetimeParts} parts
          </Text>
        )}
        <Pressable onPress={onStart} style={styles.startBtn}>
          <Animated.Text
            style={[
              styles.startText,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
              },
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
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 22,
    paddingTop: 64,
    paddingBottom: 36,
  },
  heroWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  subtitle: {
    color: COLORS.textDim,
    fontSize: 11,
    letterSpacing: 4,
    marginBottom: 8,
  },
  title: {
    color: COLORS.accent,
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
    lineHeight: 58,
  },
  tag: {
    color: COLORS.textDim,
    fontSize: 13,
    marginTop: 12,
    letterSpacing: 1,
    textAlign: 'center',
  },
  shipPicker: {
    flex: 1,
  },
  shipPickerLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: 10,
    textAlign: 'center',
  },
  shipList: {
    gap: 8,
  },
  shipChip: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  shipChipSelected: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(34,211,238,0.10)',
  },
  shipChipLocked: {
    opacity: 0.4,
  },
  shipChipName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  shipChipNameLocked: {
    color: COLORS.textMuted,
  },
  shipChipDesc: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  bottom: {
    alignItems: 'center',
    gap: 8,
  },
  high: {
    color: COLORS.momentum,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '800',
  },
  lifetime: {
    color: COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  startBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 56,
    paddingVertical: 18,
    borderRadius: 999,
    marginTop: 6,
  },
  startText: {
    color: COLORS.bg,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
  },
  hint: {
    color: COLORS.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 8,
  },
});
