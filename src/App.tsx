import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [started, setStarted] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {started ? (
        <View style={styles.gameStub}>
          <Text style={styles.placeholder}>Game canvas — coming next.</Text>
          <Pressable style={styles.btn} onPress={() => setStarted(false)}>
            <Text style={styles.btnText}>BACK</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.title}>{`OCEAN\nSPORE`}</Text>
          <Text style={styles.tagline}>Salvage. Survive. Grow your fleet.</Text>
          <Pressable style={styles.btn} onPress={() => setStarted(true)}>
            <Text style={styles.btnText}>START</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#03101c',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#22d3ee',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
    lineHeight: 60,
  },
  tagline: {
    color: '#88c0ff',
    marginTop: 16,
    fontSize: 14,
    letterSpacing: 1.5,
  },
  btn: {
    marginTop: 32,
    backgroundColor: '#22d3ee',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 999,
  },
  btnText: {
    color: '#03101c',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 3,
  },
  gameStub: {
    alignItems: 'center',
  },
  placeholder: {
    color: '#88c0ff',
    fontSize: 16,
    marginBottom: 24,
  },
});
