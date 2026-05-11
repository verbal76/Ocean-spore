import { useRef, useState } from 'react';
import { GestureResponderEvent, StyleSheet, View } from 'react-native';
import { COLORS } from '../colors';

interface Props {
  size?: number;
  onChange: (dx: number, dy: number) => void;
}

export function Joystick({ size = 130, onChange }: Props) {
  const viewRef = useRef<View>(null);
  const layoutRef = useRef({ cx: 0, cy: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const radius = (size - 50) / 2;

  function remeasure() {
    const node = viewRef.current as any;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x: number, y: number, w: number, h: number) => {
        layoutRef.current = { cx: x + w / 2, cy: y + h / 2 };
      });
    }
  }

  function handle(e: GestureResponderEvent) {
    const t = e.nativeEvent;
    const lx = t.pageX - layoutRef.current.cx;
    const ly = t.pageY - layoutRef.current.cy;
    const d = Math.hypot(lx, ly);
    const clamped = Math.min(d, radius);
    const nx = d > 0 ? lx / d : 0;
    const ny = d > 0 ? ly / d : 0;
    setKnob({ x: nx * clamped, y: ny * clamped });
    const norm = clamped / radius;
    onChange(nx * norm, ny * norm);
  }

  function reset() {
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  }

  return (
    <View
      ref={viewRef}
      onLayout={remeasure}
      style={[styles.outer, { width: size, height: size, borderRadius: size / 2 }]}
      onStartShouldSetResponder={() => {
        remeasure();
        return true;
      }}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handle}
      onResponderMove={handle}
      onResponderRelease={reset}
      onResponderTerminate={reset}
    >
      <View
        pointerEvents="none"
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
