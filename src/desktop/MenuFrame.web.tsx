import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../colors';

/**
 * Desktop landscape: the menus were designed as a portrait column, so they keep that
 * proportion (centred, capped width) instead of being stretched across a 16:10 window.
 */
export function MenuFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.outer}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center', backgroundColor: COLORS.bg },
  // bottom padding leaves room for the button-prompt footer drawn by App
  column: { flex: 1, width: '100%', maxWidth: 640, paddingBottom: 34 },
});
