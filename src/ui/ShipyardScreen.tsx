import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../colors';
import { SHIPS, unlockLabel } from '../data/ships';
import { UPGRADES, upgradeCost } from '../data/upgrades';
import { Run, UpgradeKey } from '../game/types';

interface Props {
  harborName: string;
  run: Run;
  onRepair: () => void;
  onUpgrade: (key: UpgradeKey) => void;
  onSwitchShip: (id: string) => void;
  onLeave: () => void;
  repairCost: number;
  currentHullPct: number;
}

export function ShipyardScreen({
  harborName,
  run,
  onRepair,
  onUpgrade,
  onSwitchShip,
  onLeave,
  repairCost,
  currentHullPct,
}: Props) {
  const [tab, setTab] = useState<'upgrade' | 'ships'>('upgrade');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>SHIPYARD</Text>
        <Text style={styles.headerName}>{harborName}</Text>
        <Text style={styles.headerSub}>Welcome aboard, Captain.</Text>
      </View>

      <View style={styles.partsRow}>
        <Text style={styles.partsLabel}>PARTS</Text>
        <Text style={styles.partsValue}>{run.parts}</Text>
      </View>

      <View style={styles.repairCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.repairLabel}>HULL REPAIR</Text>
          <Text style={styles.repairSub}>Current {Math.round(currentHullPct)}% · Full restore</Text>
        </View>
        <Pressable
          onPress={onRepair}
          disabled={currentHullPct >= 99.5 || run.parts < repairCost}
          style={[
            styles.repairBtn,
            (currentHullPct >= 99.5 || run.parts < repairCost) && styles.btnDisabled,
          ]}
        >
          <Text style={styles.repairBtnText}>
            {currentHullPct >= 99.5 ? 'FULL' : `REPAIR · ${repairCost}`}
          </Text>
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === 'upgrade' && styles.tabActive]}
          onPress={() => setTab('upgrade')}
        >
          <Text style={[styles.tabText, tab === 'upgrade' && styles.tabTextActive]}>UPGRADES</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'ships' && styles.tabActive]}
          onPress={() => setTab('ships')}
        >
          <Text style={[styles.tabText, tab === 'ships' && styles.tabTextActive]}>SHIPS</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {tab === 'upgrade' &&
          UPGRADES.map((u) => {
            const lvl = run.upgrades[u.key];
            const cost = upgradeCost(u.key, lvl);
            const maxed = lvl >= u.maxLevel;
            const canAfford = run.parts >= cost;
            return (
              <View key={u.key} style={styles.upgradeCard}>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.upgradeName}>{u.name}</Text>
                    <Text style={styles.upgradeLevel}>LVL {lvl}/{u.maxLevel}</Text>
                  </View>
                  <Text style={styles.upgradeDesc}>{u.description}</Text>
                </View>
                <Pressable
                  onPress={() => onUpgrade(u.key)}
                  disabled={maxed || !canAfford}
                  style={[styles.buyBtn, (maxed || !canAfford) && styles.btnDisabled]}
                >
                  <Text style={styles.buyBtnText}>{maxed ? 'MAX' : `BUY ${cost}`}</Text>
                </Pressable>
              </View>
            );
          })}

        {tab === 'ships' &&
          SHIPS.map((s) => {
            const unlocked = run.unlockedShips.includes(s.id);
            const current = run.shipClassId === s.id;
            return (
              <View key={s.id} style={[styles.upgradeCard, current && styles.shipCardCurrent]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.upgradeName, !unlocked && { color: COLORS.textMuted }]}>
                    {s.name}
                  </Text>
                  <Text style={styles.upgradeDesc}>
                    {unlocked ? s.description : unlockLabel(s.unlockKills, run.lifetimeKillsAtStart + run.kills)}
                  </Text>
                  <Text style={styles.shipStats}>
                    HULL {s.baseHull} · SPD {s.baseSpeed} · DMG {s.baseDamage} · ROF {s.baseFireRate}
                  </Text>
                </View>
                <Pressable
                  disabled={!unlocked || current}
                  onPress={() => onSwitchShip(s.id)}
                  style={[
                    styles.buyBtn,
                    (!unlocked || current) && styles.btnDisabled,
                  ]}
                >
                  <Text style={styles.buyBtnText}>
                    {current ? 'IN USE' : unlocked ? 'BOARD' : 'LOCKED'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
      </ScrollView>

      <Pressable style={styles.leaveBtn} onPress={onLeave}>
        <Text style={styles.leaveBtnText}>RETURN TO OCEAN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.panel, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 24 },
  header: { alignItems: 'center', marginBottom: 14 },
  headerLabel: { color: COLORS.textDim, fontSize: 11, letterSpacing: 4 },
  headerName: { color: COLORS.accent, fontSize: 24, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  headerSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 4, letterSpacing: 1.5 },
  partsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(34,211,238,0.10)', borderColor: 'rgba(34,211,238,0.4)', borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 },
  partsLabel: { color: COLORS.textDim, fontSize: 12, letterSpacing: 3 },
  partsValue: { color: COLORS.accent, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  repairCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.4)', borderWidth: 1, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16, gap: 12 },
  repairLabel: { color: COLORS.text, fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  repairSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },
  repairBtn: { backgroundColor: '#4ade80', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999 },
  repairBtnText: { color: COLORS.bg, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tabActive: { backgroundColor: 'rgba(34,211,238,0.12)', borderColor: COLORS.accent },
  tabText: { color: COLORS.textDim, fontSize: 12, letterSpacing: 2, fontWeight: '700' },
  tabTextActive: { color: COLORS.accent },
  upgradeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 8, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  shipCardCurrent: { borderColor: COLORS.accent, backgroundColor: 'rgba(34,211,238,0.10)' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  upgradeName: { color: COLORS.text, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  upgradeLevel: { color: COLORS.textMuted, fontSize: 10, letterSpacing: 1.5 },
  upgradeDesc: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },
  shipStats: { color: COLORS.textDim, fontSize: 10, marginTop: 4, letterSpacing: 0.8 },
  buyBtn: { backgroundColor: COLORS.accent, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999, minWidth: 78, alignItems: 'center' },
  buyBtnText: { color: COLORS.bg, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  btnDisabled: { opacity: 0.35 },
  leaveBtn: { marginTop: 10, backgroundColor: 'transparent', borderColor: COLORS.hudBorder, borderWidth: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  leaveBtnText: { color: COLORS.textDim, fontSize: 14, fontWeight: '800', letterSpacing: 3 },
});
