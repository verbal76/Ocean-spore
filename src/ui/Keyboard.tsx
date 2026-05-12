import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../colors';

interface Props {
  onKey: (ch: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
  onDone: () => void;
}

const ROW1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
const ROW2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
const ROW3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

export function Keyboard({ onKey, onBackspace, onSpace, onDone }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {ROW1.map((k) => (
          <KeyCap key={k} label={k} onPress={() => onKey(k)} />
        ))}
      </View>
      <View style={[styles.row, styles.rowPad]}>
        {ROW2.map((k) => (
          <KeyCap key={k} label={k} onPress={() => onKey(k)} />
        ))}
      </View>
      <View style={styles.row}>
        <KeyCap label="DEL" wide onPress={onBackspace} accent />
        {ROW3.map((k) => (
          <KeyCap key={k} label={k} onPress={() => onKey(k)} />
        ))}
        <KeyCap label="OK" wide onPress={onDone} accent />
      </View>
      <View style={styles.row}>
        <Pressable style={[styles.key, styles.spaceKey]} onPress={onSpace}>
          <Text style={styles.keyText}>SPACE</Text>
        </Pressable>
      </View>
    </View>
  );
}

function KeyCap({
  label,
  onPress,
  wide,
  accent,
}: {
  label: string;
  onPress: () => void;
  wide?: boolean;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.key, wide && styles.keyWide, accent && styles.keyAccent]}
      hitSlop={4}
    >
      <Text style={[styles.keyText, accent && styles.keyTextAccent]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, paddingHorizontal: 4 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  rowPad: { paddingHorizontal: 16 },
  key: {
    minWidth: 30,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(135,206,250,0.10)',
    borderColor: COLORS.hudBorder,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    flexGrow: 1,
    flexBasis: 0,
  },
  keyWide: { minWidth: 52, flexGrow: 1.6 },
  keyAccent: {
    backgroundColor: 'rgba(34,211,238,0.18)',
    borderColor: COLORS.accent,
  },
  spaceKey: { flexGrow: 4, minWidth: 180, paddingVertical: 12 },
  keyText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
  keyTextAccent: { color: COLORS.accent },
});
