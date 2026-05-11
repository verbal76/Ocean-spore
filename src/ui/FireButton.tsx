import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  size?: number;
  label?: string;
  pressed: boolean;
  onBounds: (cx: number, cy: number, radius: number) => void;
}

// Pure visual fire button. Root touch dispatcher in Game.tsx owns
// touch handling; this component just renders the styled circle and
// reports its bounds. pointerEvents="none" so touches go to the root.
export function FireButton({ size = 100, label = 'FIRE', pressed, onBounds }: Props) {
  const ref = useRef<View>(null);

  function measure() {
    const node = ref.current as any;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x: number, y: number, w: number, h: number) => {
        onBounds(x + w / 2, y + h / 2, size / 2);
      });
    }
  }

  return (
    <View
      ref={ref}
      pointerEvents="none"
      onLayout={measure}
      style={[
        styles.btn,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.btnPressed,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: 'rgba(248,113,113,0.25)',
    borderColor: 'rgba(248,113,113,0.6)',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    backgroundColor: 'rgba(248,113,113,0.55)',
    borderColor: 'rgba(248,113,113,0.9)',
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
