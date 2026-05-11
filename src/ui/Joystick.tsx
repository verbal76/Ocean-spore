import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../colors';

interface Props {
  size?: number;
  knob: { x: number; y: number };
  onBounds: (cx: number, cy: number, radius: number) => void;
}

// Pure visual joystick. The root touch dispatcher in Game.tsx owns
// touch handling; this component only renders the ring and the knob
// at the position the dispatcher computes. pointerEvents="none" so
// touches pass through to the root responder.
export function Joystick({ size = 130, knob, onBounds }: Props) {
  const ref = useRef<View>(null);
  const radius = (size - 50) / 2;

  function measure() {
    const node = ref.current as any;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x: number, y: number, w: number, h: number) => {
        onBounds(x + w / 2, y + h / 2, radius);
      });
    }
  }

  return (
    <View
      ref={ref}
      pointerEvents="none"
      onLayout={measure}
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
