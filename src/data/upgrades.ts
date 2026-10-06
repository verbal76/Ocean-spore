import { UpgradeKey } from '../game/types';

export interface UpgradeDef {
  key: UpgradeKey;
  name: string;
  description: string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
}

export const UPGRADES: UpgradeDef[] = [
  {
    key: 'hullLevel',
    name: 'Reinforced Hull',
    description: '+30 max hull per level',
    baseCost: 12,
    costGrowth: 1.4,
    maxLevel: 20,
  },
  {
    key: 'speedLevel',
    name: 'Tuned Engines',
    description: '+8% speed, +3% turning per level',
    baseCost: 16,
    costGrowth: 1.45,
    maxLevel: 15,
  },
  {
    key: 'damageLevel',
    name: 'Heavy Munitions',
    description: '+18% bullet damage per level',
    baseCost: 18,
    costGrowth: 1.5,
    maxLevel: 20,
  },
  {
    key: 'fireRateLevel',
    name: 'Auto-Loaders',
    description: '+15% fire rate per level',
    baseCost: 20,
    costGrowth: 1.55,
    maxLevel: 15,
  },
  {
    key: 'magnetLevel',
    name: 'Salvage Magnet',
    description: '+22 magnet range per level',
    baseCost: 10,
    costGrowth: 1.35,
    maxLevel: 10,
  },
  {
    key: 'regenLevel',
    name: 'Hull Regen',
    description: '+1.2 hull/sec regen per level',
    baseCost: 30,
    costGrowth: 1.6,
    maxLevel: 8,
  },
];

export function upgradeCost(key: UpgradeKey, currentLevel: number): number {
  const def = UPGRADES.find((u) => u.key === key);
  if (!def) return 99999;
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}

export function getUpgradeDef(key: UpgradeKey): UpgradeDef | undefined {
  return UPGRADES.find((u) => u.key === key);
}
