import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from './colors';
import { Game } from './game/Game';
import { CaptainScreen } from './ui/CaptainScreen';
import { GameOverScreen } from './ui/GameOverScreen';
import { ShipyardScreen } from './ui/ShipyardScreen';
import { ShipSelectScreen } from './ui/ShipSelectScreen';
import { BrandSplash } from './ui/BrandSplash';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { SplashScreen } from './ui/SplashScreen';
import { GameScreen, Run, UpgradeKey } from './game/types';
import {
  applyUpgrades, createWorld, repairCost, switchShip,
  tryRepair, tryUpgrade, undock, World,
} from './game/world';
import { SHIPS_BY_ID } from './data/ships';
import { loadSave, saveSave } from './state/persistence';
import { defaultSave, SAVE_SCHEMA_VERSION, SaveData } from './state/saveSchema';

export default function App() {
  // After a recovered crash the app remounts straight to the title: the studio
  // card is only for cold launches, never a recovery path.
  const [recoveries, setRecoveries] = useState(0);
  return (
    <SafeAreaProvider>
      <ErrorBoundary onReset={() => setRecoveries((n) => n + 1)}>
        <AppInner key={recoveries} startScreen={recoveries === 0 ? 'brand' : 'splash'} />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

function AppInner({ startScreen }: { startScreen: GameScreen }) {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<GameScreen>(startScreen);
  const [selectedShip, setSelectedShip] = useState<string>('raft');
  const [unlockedShips, setUnlockedShips] = useState<string[]>(['raft']);
  const [highScore, setHighScore] = useState<number>(0);
  const [lifetimeKills, setLifetimeKills] = useState<number>(0);
  const [lifetimeParts, setLifetimeParts] = useState<number>(0);
  const [captainName, setCaptainName] = useState<string>('');
  const worldRef = useRef<World | null>(null);
  const [, force] = useState(0);
  const lastRunRef = useRef<Run | null>(null);
  const [newUnlocks, setNewUnlocks] = useState<string[]>([]);
  const loadStartedRef = useRef(false);
  // True once the on-disk save has been read. Until then React state still
  // holds defaults, so writing it would overwrite the player's real save.
  const saveReadyRef = useRef(false);
  const pendingOverridesRef = useRef<Partial<SaveData>>({});

  useEffect(() => {
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;
    loadSave()
      .catch(() => defaultSave())
      .then((s) => {
        setSelectedShip(s.lastShip);
        setUnlockedShips(s.unlockedShips);
        setHighScore(s.highScore);
        setLifetimeKills(s.totalKills);
        setLifetimeParts(s.totalParts);
        setCaptainName(s.captainName || '');
        saveReadyRef.current = true;
        // Replay anything the player changed before the load finished, on
        // top of the loaded data (not on top of stale defaults).
        const pending = pendingOverridesRef.current;
        pendingOverridesRef.current = {};
        if (Object.keys(pending).length > 0) saveSave({ ...s, ...pending });
      });
  }, []);

  function persist(overrides: Partial<SaveData> = {}) {
    if (!saveReadyRef.current) {
      pendingOverridesRef.current = { ...pendingOverridesRef.current, ...overrides };
      return;
    }
    saveSave({
      unlockedShips,
      highScore,
      totalKills: lifetimeKills,
      totalParts: lifetimeParts,
      lastShip: selectedShip,
      captainName,
      schemaVersion: SAVE_SCHEMA_VERSION,
      ...overrides,
    });
  }

  function startRun() {
    const w = createWorld(selectedShip, [...unlockedShips]);
    applyUpgrades(w);
    w.player.hull = w.player.maxHull;
    worldRef.current = w;
    setScreen('playing');
  }

  function onDocked(_world: World, _idx: number) { setScreen('docked'); }

  function onDied(run: Run) {
    lastRunRef.current = run;
    const newHigh = Math.max(highScore, run.score);
    setHighScore(newHigh);

    const before = new Set(unlockedShips);
    const after = new Set(run.unlockedShips);
    const newly: string[] = [];
    after.forEach((id) => {
      if (!before.has(id)) newly.push(SHIPS_BY_ID[id]?.name ?? id);
    });
    setNewUnlocks(newly);
    const newUnlockedList = Array.from(after);
    setUnlockedShips(newUnlockedList);

    const newLifetimeKills = lifetimeKills + run.kills;
    const newLifetimeParts = lifetimeParts + run.totalParts;
    setLifetimeKills(newLifetimeKills);
    setLifetimeParts(newLifetimeParts);

    persist({
      unlockedShips: newUnlockedList,
      highScore: newHigh,
      totalKills: newLifetimeKills,
      totalParts: newLifetimeParts,
      lastShip: selectedShip,
    });

    setScreen('dead');
  }

  function onLeaveHarbor() {
    if (!worldRef.current) return;
    undock(worldRef.current);
    setScreen('playing');
  }

  function onRepair() {
    if (!worldRef.current) return;
    if (tryRepair(worldRef.current)) force((x) => x + 1);
  }

  function onUpgrade(key: UpgradeKey) {
    if (!worldRef.current) return;
    if (tryUpgrade(worldRef.current, key)) force((x) => x + 1);
  }

  function onSwitchShip(id: string) {
    if (!worldRef.current) return;
    switchShip(worldRef.current, id);
    setSelectedShip(id);
    persist({ lastShip: id });
    force((x) => x + 1);
  }

  function onSelectShipFromTitle(id: string) {
    setSelectedShip(id);
    persist({ lastShip: id });
  }

  function onContinue() {
    if (!captainName) return;
    setScreen('shipyard');
  }

  function onNewCaptain() { setScreen('captain'); }

  function onCaptainConfirm(name: string) {
    setCaptainName(name);
    persist({ captainName: name });
    setScreen('shipyard');
  }

  function onCaptainCancel() { setScreen('splash'); }
  function onShipSelectBack() { setScreen('splash'); }

  function onQuitToMenu(world: World) {
    // Roll the current run's progress into lifetime totals before
    // dropping back to the splash screen, so closing mid-run still
    // saves the player's earned kills/parts.
    const run = world.run;
    const newHigh = Math.max(highScore, run.score);
    const after = new Set(run.unlockedShips);
    const newUnlockedList = Array.from(after);
    const newLifetimeKills = lifetimeKills + run.kills;
    const newLifetimeParts = lifetimeParts + run.totalParts;

    setHighScore(newHigh);
    setUnlockedShips(newUnlockedList);
    setLifetimeKills(newLifetimeKills);
    setLifetimeParts(newLifetimeParts);

    persist({
      unlockedShips: newUnlockedList,
      highScore: newHigh,
      totalKills: newLifetimeKills,
      totalParts: newLifetimeParts,
      lastShip: selectedShip,
      captainName,
    });

    worldRef.current = null;
    setScreen('splash');
  }

  function backToSplash() { setScreen('splash'); }

  const w = worldRef.current;

  // Edge-to-edge: menus keep the original look by sitting inside the system
  // bars. The game and the brand card draw full-bleed and handle insets
  // themselves.
  const inset = screen === 'playing' || screen === 'brand'
    ? null
    : { paddingTop: insets.top, paddingBottom: insets.bottom };

  return (
    <View style={[styles.root, inset]}>
      <StatusBar style="light" />

      {screen === 'brand' && <BrandSplash onDone={() => setScreen('splash')} />}

      {screen === 'splash' && (
        <SplashScreen
          captainName={captainName}
          highScore={highScore}
          lifetimeKills={lifetimeKills}
          lifetimeParts={lifetimeParts}
          onContinue={onContinue}
          onNewCaptain={onNewCaptain}
        />
      )}

      {screen === 'captain' && (
        <CaptainScreen onConfirm={onCaptainConfirm} onCancel={onCaptainCancel} />
      )}

      {screen === 'shipyard' && (
        <ShipSelectScreen
          captainName={captainName}
          unlockedShips={unlockedShips}
          selectedShipId={selectedShip}
          highScore={highScore}
          lifetimeKills={lifetimeKills}
          lifetimeParts={lifetimeParts}
          onSelectShip={onSelectShipFromTitle}
          onStart={startRun}
          onBack={onShipSelectBack}
        />
      )}

      {screen === 'playing' && w && (
        <Game initialWorld={w} onDocked={onDocked} onDied={onDied} onQuitToMenu={onQuitToMenu} />
      )}

      {screen === 'docked' && w && (
        <ShipyardScreen
          harborName={w.harbors[w.nearHarborIndex]?.name ?? 'Unknown Harbor'}
          run={w.run}
          repairCost={repairCost(w)}
          currentHullPct={(w.player.hull / w.player.maxHull) * 100}
          onRepair={onRepair}
          onUpgrade={onUpgrade}
          onSwitchShip={onSwitchShip}
          onLeave={onLeaveHarbor}
        />
      )}

      {screen === 'dead' && lastRunRef.current && (
        <GameOverScreen
          run={lastRunRef.current}
          newUnlocks={newUnlocks}
          onRetry={startRun}
          onMenu={backToSplash}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
});
