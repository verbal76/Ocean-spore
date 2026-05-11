import { useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { COLORS } from './colors';
import { Game } from './game/Game';
import { GameOverScreen } from './ui/GameOverScreen';
import { ShipyardScreen } from './ui/ShipyardScreen';
import { TitleScreen } from './ui/TitleScreen';
import { GameScreen, Run, UpgradeKey } from './game/types';
import {
  applyUpgrades,
  createWorld,
  repairCost,
  switchShip,
  tryRepair,
  tryUpgrade,
  undock,
  World,
} from './game/world';
import { SHIPS_BY_ID } from './data/ships';

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('title');
  const [selectedShip, setSelectedShip] = useState<string>('raft');
  const [unlockedShips, setUnlockedShips] = useState<string[]>(['raft']);
  const [highScore, setHighScore] = useState<number>(0);
  const worldRef = useRef<World | null>(null);
  const [, force] = useState(0);
  const lastRunRef = useRef<Run | null>(null);
  const [newUnlocks, setNewUnlocks] = useState<string[]>([]);

  function startRun() {
    const w = createWorld(selectedShip, unlockedShips);
    applyUpgrades(w);
    w.player.hull = w.player.maxHull;
    worldRef.current = w;
    setScreen('playing');
  }

  function onDocked(_world: World, _idx: number) {
    setScreen('docked');
  }

  function onDied(run: Run) {
    lastRunRef.current = run;
    setHighScore((h) => Math.max(h, run.score));
    const before = new Set(unlockedShips);
    const after = new Set(run.unlockedShips);
    const newly: string[] = [];
    after.forEach((id) => {
      if (!before.has(id)) newly.push(SHIPS_BY_ID[id]?.name ?? id);
    });
    setNewUnlocks(newly);
    setUnlockedShips(Array.from(after));
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
    force((x) => x + 1);
  }

  function backToTitle() {
    setScreen('title');
  }

  const w = worldRef.current;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {screen === 'title' && (
        <TitleScreen
          unlockedShips={unlockedShips}
          highScore={highScore}
          selectedShipId={selectedShip}
          onSelectShip={setSelectedShip}
          onStart={startRun}
        />
      )}

      {screen === 'playing' && w && (
        <Game initialWorld={w} onDocked={onDocked} onDied={onDied} />
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
          onMenu={backToTitle}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
});
