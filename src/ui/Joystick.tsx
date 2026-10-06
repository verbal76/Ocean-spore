import { StyleSheet, View } from 'react-native';
import { COLORS } from '../colors';

interface Props {
  size?: number;
  knob: { x: number; y: number };
}

// Pure visual joystick. The root touch dispatcher in Game.tsx owns
// touch handling and computes hit-area bounds from static layout
// constants - no runtime measurement is needed.
export function Joystick({ size = 130, knob }: Props) {
  return (
    <View
      pointerEvents="none"
      style={[styles.outer, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <View
        style={[
          styles.knob,
          { transform: [{ translateX: knob.x }, { translateY: knob.y }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: COLORS.hudBorder,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(135,206,250,0.4)',
    borderColor: 'rgba(255,255,255,0.5)',
    borderWidth: 2,
  },
});
