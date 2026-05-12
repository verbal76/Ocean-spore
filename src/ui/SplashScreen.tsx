import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../colors';
import { AboutOverlay } from './AboutOverlay';

interface Props {
  captainName: string;
  highScore: number;
  lifetimeKills: number;
  lifetimeParts: number;
  onContinue: () => void;
  onNewCaptain: () => void;
}

export function SplashScreen({
  captainName,
  highScore,
  lifetimeKills,
  lifetimeParts,
  onContinue,
  onNewCaptain,
}: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [showAbout, setShowAbout] = useState(false);
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const hasCaptain = captainName.trim().length > 0;
  const hasLifetime = lifetimeKills > 0 || lifetimeParts > 0;

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.infoBtn}
        onPress={() => setShowAbout(true)}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      >
        <Text style={styles.infoBtnText}>INFO</Text>
      </Pressable>

      <View style={styles.heroWrap}>
        <Text style={styles.subtitle}>NAVAL SURVIVAL · ARCADE</Text>
        <Text style={styles.title}>{'OCEAN\nSPORE'}</Text>
        <Text style={styles.tag}>Start as a junk raft. Become a floating apocalypse.</Text>
      </View>

      <View style={styles.bottom}>
        {hasCaptain && (
          <View style={styles.captainBlock}>
            <Text style={styles.captainLabel}>LAST CAPTAIN</Text>
            <Text style={styles.captainName}>{captainName}</Text>
          </View>
        )}

        {highScore > 0 && <Text style={styles.high}>BEST {highScore}</Text>}
        {hasLifetime && (
          <Text style={styles.lifetime}>
            LIFETIME · {lifetimeKills} kills · {lifetimeParts} parts
          </Text>
        )}

        <Pressable
          onPress={onContinue}
          disabled={!hasCaptain}
          style={[styles.primaryBtn, !hasCaptain && styles.btnDisabled]}
        >
          <Animated.Text
            style={[
              styles.primaryText,
              {
                opacity: hasCaptain
                  ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] })
                  : 0.5,
              },
            ]}
          >
            CONTINUE
          </Animated.Text>
        </Pressable>

        <Pressable onPress={onNewCaptain} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>NEW CAPTAIN</Text>
        </Pressable>

        <Text style={styles.hint}>Joystick (L) moves · Auto-fire on · Tap FIRE for manual</Text>
      </View>

      {showAbout && <AboutOverlay onClose={() => setShowAbout(false)} />}
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
    justifyContent: 'space-between',
  },
  infoBtn: {
    position: 'absolute',
    top: 56,
    right: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 999,
    zIndex: 5,
  },
  infoBtnText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 60,
  },
  subtitle: {
    color: COLORS.textDim,
    fontSize: 11,
    letterSpacing: 4,
    marginBottom: 8,
  },
  title: {
    color: COLORS.accent,
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
    lineHeight: 68,
  },
  tag: {
    color: COLORS.textDim,
    fontSize: 13,
    marginTop: 14,
    letterSpacing: 1,
    textAlign: 'center',
  },
  bottom: {
    alignItems: 'center',
    gap: 10,
  },
  captainBlock: {
    alignItems: 'center',
    marginBottom: 6,
  },
  captainLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '700',
  },
  captainName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 4,
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
  primaryBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 56,
    paddingVertical: 16,
    borderRadius: 999,
    marginTop: 4,
    minWidth: 240,
    alignItems: 'center',
  },
  primaryText: {
    color: COLORS.bg,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 4,
  },
  secondaryBtn: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 999,
    borderColor: COLORS.accent,
    borderWidth: 1,
    minWidth: 240,
    alignItems: 'center',
  },
  secondaryText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  hint: {
    color: COLORS.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 4,
  },
});
