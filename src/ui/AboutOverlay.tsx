import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { COLORS } from '../colors';
import { BUILD_INFO } from '../__generated__/build-info';

interface Props {
  onClose: () => void;
}

// Surfaces the current build / OTA identifiers so the operator can
// tell at a glance which APK is installed and which JS bundle is
// actually running. Pulls from src/__generated__/build-info.ts
// (written by scripts/write-build-info.mjs in CI) plus the live
// expo-updates runtime state.
export function AboutOverlay({ onClose }: Props) {
  const updateId = (Updates as any).updateId ?? null;
  const isEmbedded = (Updates as any).isEmbeddedLaunch ?? true;
  const runtimeVer = (Updates as any).runtimeVersion ?? '?';
  const channel = (Updates as any).channel ?? '?';
  const otaShort = updateId
    ? String(updateId).slice(0, 8)
    : 'embedded (no OTA)';
  const builtAtShort = BUILD_INFO.builtAt.split('T')[0];

  return (
    <Pressable style={styles.scrim} onPress={onClose}>
      <Pressable
        style={styles.panel}
        onPress={(e) => e.stopPropagation && e.stopPropagation()}
      >
        <Text style={styles.title}>BUILD INFO</Text>

        <Row label="APP" value={`Ocean Spore v${BUILD_INFO.appVersion}`} />
        <Row label="BUILD" value={`#${BUILD_INFO.buildNumber}`} />
        <Row label="COMMIT" value={`${BUILD_INFO.commitShort}${BUILD_INFO.dirty ? ' [dirty]' : ''}`} />
        <Row label="BRANCH" value={BUILD_INFO.branch} />
        <Row label="BUILT" value={builtAtShort} />

        <View style={styles.divider} />

        <Row label="RUNTIME" value={runtimeVer} />
        <Row label="CHANNEL" value={channel} />
        <Row label="OTA" value={otaShort} />
        <Row label="SOURCE" value={isEmbedded ? 'embedded' : 'over-the-air'} />

        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>CLOSE</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3,16,28,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.bg,
    borderColor: COLORS.hudBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 22,
  },
  title: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  rowLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    minWidth: 80,
  },
  rowValue: {
    color: COLORS.text,
    fontSize: 12,
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.hudBorder,
    marginVertical: 12,
  },
  closeBtn: {
    marginTop: 20,
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  closeBtnText: {
    color: COLORS.bg,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
  },
});
