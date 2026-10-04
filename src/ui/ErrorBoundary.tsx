import { Component, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../colors';

interface Props {
  children: ReactNode;
  /** Called when the player taps the recovery button; the parent remounts the app. */
  onReset: () => void;
}

interface State {
  failed: boolean;
}

// Last line of defence: a render error anywhere below must never leave the
// player on a blank screen with no way out.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[ErrorBoundary] recovered from render error', error);
  }

  private reset = () => {
    this.setState({ failed: false });
    this.props.onReset();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>SOMETHING WENT WRONG</Text>
        <Text style={styles.body}>Your progress is saved. Head back to the harbor and try again.</Text>
        <Pressable onPress={this.reset} style={styles.btn} accessibilityRole="button">
          <Text style={styles.btnText}>RETURN TO MENU</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  title: { color: COLORS.accent, fontSize: 20, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  body: { color: COLORS.textDim, fontSize: 14, textAlign: 'center' },
  btn: { backgroundColor: COLORS.accent, paddingHorizontal: 40, paddingVertical: 14, borderRadius: 999, marginTop: 8 },
  btnText: { color: COLORS.bg, fontSize: 14, fontWeight: '900', letterSpacing: 2 },
});
