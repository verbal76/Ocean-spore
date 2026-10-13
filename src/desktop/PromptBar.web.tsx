import { Image, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../colors';
import { promptFor } from '../input/inputActions';
import { useDeviceState } from '../platform/useDeviceState';
import { GLYPH_ASSETS } from './glyphAssets.web';

interface Item { action: Parameters<typeof promptFor>[1]; label: string }
interface Props { items: readonly Item[]; compact?: boolean }

const SIZE = 30;

function Glyph({ glyphKey, size }: { glyphKey: string; size: number }) {
  const src = GLYPH_ASSETS[glyphKey];
  if (!src) return null;
  // The pack's dark pad glyphs sit on a light chip so they read on the dark sea.
  const needsChip = !glyphKey.startsWith('keyboard/');
  return (
    <View style={needsChip ? [styles.chip, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }] : undefined}>
      <Image source={src as never} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="" />
    </View>
  );
}

/** One prompt: glyph (or a text cap when the pack has none) + what it does. */
function Prompt({ item, size }: { item: Item; size: number }) {
  const { style } = useDeviceState();
  const p = promptFor(style, item.action);
  if (style === 'keyboard' && item.action === 'move') {
    return (
      <View style={styles.item}>
        {['W', 'A', 'S', 'D'].map((k) => <Glyph key={k} glyphKey={`keyboard/T_${k}_Key_White`} size={size - 6} />)}
        <Text style={styles.label}>{item.label}</Text>
      </View>
    );
  }
  return (
    <View style={styles.item} accessibilityLabel={`${p.text}: ${item.label}`}>
      {p.glyph ? <Glyph glyphKey={p.glyph} size={size} /> : <View style={styles.cap}><Text style={styles.capText}>{p.text}</Text></View>}
      <Text style={styles.label}>{item.label}</Text>
    </View>
  );
}

export function PromptBar({ items, compact }: Props) {
  const size = compact ? 22 : SIZE;
  return (
    <View style={styles.row} pointerEvents="none">
      {items.map((it) => <Prompt key={it.action + it.label} item={it} size={size} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 18 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: COLORS.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  chip: { backgroundColor: 'rgba(224,242,254,0.92)', alignItems: 'center', justifyContent: 'center' },
  cap: { borderColor: COLORS.hudBorder, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(3,16,28,0.7)' },
  capText: { color: COLORS.text, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});
