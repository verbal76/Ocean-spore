import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../colors';
import { randomCaptainName } from '../data/captain-names';
import { Keyboard } from './Keyboard';

interface Props {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

const MAX_LEN = 20;

export function CaptainScreen({ onConfirm, onCancel }: Props) {
  const [mode, setMode] = useState<'choose' | 'type'>('choose');
  const [name, setName] = useState<string>(() => randomCaptainName());

  function roll() {
    setName(randomCaptainName());
  }

  function startTyping() {
    setName('');
    setMode('type');
  }

  function onKey(ch: string) {
    setName((prev) => (prev.length >= MAX_LEN ? prev : prev + ch));
  }

  function onBackspace() {
    setName((prev) => prev.slice(0, -1));
  }

  function onSpace() {
    setName((prev) => (prev.length >= MAX_LEN ? prev : prev + ' '));
  }

  function onDone() {
    const cleaned = name.trim();
    if (cleaned.length > 0) onConfirm(cleaned);
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={onCancel} hitSlop={12}>
          <Text style={styles.backText}>{'<  BACK'}</Text>
        </Pressable>
        <Text style={styles.title}>NAME YOUR CAPTAIN</Text>
        <Text style={styles.subtitle}>Every floating legend needs a name.</Text>
      </View>

      <View style={styles.nameCard}>
        <Text style={styles.nameLabel}>CAPTAIN</Text>
        <Text style={styles.nameValue} numberOfLines={1}>
          {name || (mode === 'type' ? '_' : 'unnamed')}
        </Text>
      </View>

      {mode === 'choose' && (
        <View style={styles.choose}>
          <Pressable style={styles.bigBtn} onPress={roll}>
            <Text style={styles.bigBtnText}>ROLL A RANDOM NAME</Text>
            <Text style={styles.bigBtnHint}>Adjective + Noun. Try again until you grin.</Text>
          </Pressable>

          <Pressable style={styles.bigBtnAlt} onPress={startTyping}>
            <Text style={styles.bigBtnAltText}>TYPE MY OWN</Text>
            <Text style={styles.bigBtnHint}>Use the on-screen keyboard.</Text>
          </Pressable>

          <Pressable
            style={[styles.primaryBtn, !name && styles.btnDisabled]}
            onPress={onDone}
            disabled={!name}
          >
            <Text style={styles.primaryText}>SET SAIL AS {name || '...'}</Text>
          </Pressable>
        </View>
      )}

      {mode === 'type' && (
        <View style={styles.typing}>
          <Keyboard
            onKey={onKey}
            onBackspace={onBackspace}
            onSpace={onSpace}
            onDone={onDone}
          />
          <View style={styles.typingRow}>
            <Pressable style={styles.smallBtn} onPress={() => setMode('choose')}>
              <Text style={styles.smallBtnText}>RANDOM</Text>
            </Pressable>
            <Pressable
              style={[styles.smallPrimary, !name.trim() && styles.btnDisabled]}
              onPress={onDone}
              disabled={!name.trim()}
            >
              <Text style={styles.smallPrimaryText}>CONFIRM</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  back: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: COLORS.accent,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 8,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 6,
  },
  nameCard: {
    backgroundColor: 'rgba(34,211,238,0.08)',
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  nameLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    letterSpacing: 4,
    fontWeight: '700',
  },
  nameValue: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 8,
  },
  choose: {
    gap: 14,
  },
  bigBtn: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  bigBtnText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3,
  },
  bigBtnAlt: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  bigBtnAltText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3,
  },
  bigBtnHint: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 6,
    letterSpacing: 1,
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryText: {
    color: COLORS.bg,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  typing: {
    gap: 14,
  },
  typingRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  smallBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  smallBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  smallPrimary: {
    flex: 1,
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  smallPrimaryText: {
    color: COLORS.bg,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
