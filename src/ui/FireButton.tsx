import { StyleSheet, Text, View } from 'react-native';

interface Props {
  size?: number;
  label?: string;
  pressed: boolean;
}

// Pure visual fire button. Root touch dispatcher in Game.tsx owns
// touch handling and derives bounds from static layout constants.
export function FireButton({ size = 100, label = 'FIRE', pressed }: Props) {
  return (
    <View
      pointerEvents="none"
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
