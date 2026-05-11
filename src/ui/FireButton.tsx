import { StyleSheet, Text, View } from 'react-native';

interface Props {
  size?: number;
  label?: string;
  onChange: (pressed: boolean) => void;
}

export function FireButton({ size = 100, label = 'FIRE', onChange }: Props) {
  return (
    <View
      style={[styles.btn, { width: size, height: size, borderRadius: size / 2 }]}
      onStartShouldSetResponder={() => true}
      onResponderGrant={() => onChange(true)}
      onResponderRelease={() => onChange(false)}
      onResponderTerminate={() => onChange(false)}
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
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
