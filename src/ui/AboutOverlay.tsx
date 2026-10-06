import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../colors';
import { BUILD_INFO } from '../__generated__/build-info';
import { getAudio } from '../audio';
import { glbLoadStatus } from '../render3d/loadStatus';

interface Props {
  onClose: () => void;
}

export function AboutOverlay({ onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const updateId = (Updates as any).updateId ?? null;
  const isEmbedded = (Updates as any).isEmbeddedLaunch ?? true;
  const runtimeVer = (Updates as any).runtimeVersion ?? '?';
  const channel = (Updates as any).channel ?? '?';
  const otaShort = updateId
    ? String(updateId).slice(0, 8)
    : 'embedded (no OTA)';
  const builtAtShort = BUILD_INFO.builtAt.split('T')[0];

  const glbCount = `${glbLoadStatus.loaded}/${glbLoadStatus.total || '-'}`;
  const glbLine =
    glbLoadStatus.total === 0
      ? 'not yet loaded (start a run first)'
      : glbCount;

  const rows: [string, string][] = [
    ['APP', `Ocean Spore v${BUILD_INFO.appVersion}`],
    ['STUDIO', 'Hot Attic Games'],
    ['VERSION CODE', String(BUILD_INFO.androidVersionCode ?? '-')],
    ['BUILD', `#${BUILD_INFO.buildNumber}`],
    ['COMMIT', `${BUILD_INFO.commitShort}${BUILD_INFO.dirty ? ' [dirty]' : ''}`],
    ['BRANCH', BUILD_INFO.branch],
    ['BUILT', builtAtShort],
    ['RUNTIME', runtimeVer],
    ['CHANNEL', channel],
    ['OTA', otaShort],
    ['SOURCE', isEmbedded ? 'embedded' : 'over-the-air'],
    ['3D MODELS', glbLine],
    ['AUDIO', `${getAudio().isEnabled() ? 'on' : 'off'}${getAudio().failures > 0 ? ` (${getAudio().failures} errors)` : ''}`],
  ];
  if (glbLoadStatus.failed > 0) {
    rows.push(['FIRST ERR', glbLoadStatus.firstError || '(none)']);
  }
  rows.push(['FRAMES', String(glbLoadStatus.renderFrames)]);
  rows.push(['DRAW BUF', `${glbLoadStatus.drawBufW}x${glbLoadStatus.drawBufH}`]);
  rows.push(['SCENE', String(glbLoadStatus.sceneChildren)]);
  if (glbLoadStatus.colormapDiag !== '') rows.push(['COLORMAP', glbLoadStatus.colormapDiag]);
  if (glbLoadStatus.initError !== '') rows.push(['INIT ERR', glbLoadStatus.initError]);
  if (glbLoadStatus.renderError !== '') rows.push(['RENDER ERR', glbLoadStatus.renderError]);
  if (glbLoadStatus.renderStack !== '') rows.push(['STACK', glbLoadStatus.renderStack]);

  async function copyAll() {
    const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* silent - copy is best-effort */
    }
  }

  return (
    <Pressable style={styles.scrim} onPress={onClose}>
      <Pressable
        style={styles.panel}
        onPress={(e) => e.stopPropagation && e.stopPropagation()}
      >
        <Text style={styles.title}>BUILD INFO</Text>

        <ScrollView style={styles.scroll}>
          {rows.map(([k, v], i) => {
            const isDivider = (k === 'RUNTIME' && i > 0) || k === '3D MODELS';
            return (
              <View key={k + i}>
                {isDivider && <View style={styles.divider} />}
                <Row
                  label={k}
                  value={v}
                  maxLines={k === 'STACK' ? 10 : 2}
                />
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.btnRow}>
          <Pressable style={styles.copyBtn} onPress={copyAll}>
            <Text style={styles.copyBtnText}>{copied ? 'COPIED!' : 'COPY ALL'}</Text>
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>CLOSE</Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

function Row({
  label, value, maxLines,
}: { label: string; value: string; maxLines?: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={maxLines ?? 2} selectable>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(3,16,28,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '90%',
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
  scroll: { flexGrow: 0, flexShrink: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 5,
    gap: 12,
  },
  rowLabel: { color: COLORS.textDim, fontSize: 11, letterSpacing: 2, fontWeight: '700', minWidth: 80 },
  rowValue: { color: COLORS.text, fontSize: 12, letterSpacing: 0.5, flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: COLORS.hudBorder, marginVertical: 12 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  copyBtn: {
    flex: 1,
    backgroundColor: 'rgba(34,211,238,0.18)',
    borderColor: COLORS.accent,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  copyBtnText: { color: COLORS.accent, fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  closeBtn: {
    flex: 1,
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  closeBtnText: { color: COLORS.bg, fontSize: 13, fontWeight: '900', letterSpacing: 2 },
});
