import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { COLORS } from '../colors';

// Hot Attic Games studio splash. First thing shown after launch; hands off to
// the Ocean Spore title screen. The artwork is the authoritative studio logo
// (assets/branding/hot-attic-logo.png), scaled only, never edited.
//
// The timing is a fixed brand moment that does NOT wait on game
// initialisation (save loading happens in parallel). Tap to skip.

export const BRAND_SPLASH_TIMING = { fadeInMs: 450, holdMs: 1100, fadeOutMs: 350 } as const;

const LOGO = require('../../assets/branding/hot-attic-logo.png');
const LOGO_ASPECT = 667 / 1024;

interface Props {
  onDone: () => void;
}

export function BrandSplash({ onDone }: Props) {
  const { width } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Idempotent: the animation ending and a tap can race; only the first wins.
  const finish = useRef(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  }).current;

  useEffect(() => {
    const { fadeInMs, holdMs, fadeOutMs } = BRAND_SPLASH_TIMING;
    const anim = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1, duration: fadeInMs, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.delay(holdMs),
      Animated.timing(progress, {
        toValue: 2, duration: fadeOutMs, easing: Easing.in(Easing.quad), useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => { if (finished) finish(); });
    return () => anim.stop();
  }, [progress]);

  const logoWidth = Math.min(width * 0.86, 520);
  const opacity = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0.94, 1, 1.02] });

  return (
    <Pressable
      style={styles.root}
      onPress={() => finish()}
      accessibilityRole="image"
      accessibilityLabel="Hot Attic Games"
    >
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Image
          source={LOGO}
          style={{ width: logoWidth, height: logoWidth * LOGO_ASPECT }}
          resizeMode="contain"
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
