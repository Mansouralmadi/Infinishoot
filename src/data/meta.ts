import type { Stats } from '../game/stats';

/**
 * Permanent progression bought with Bolts between runs (the Workshop), and
 * achievements that unlock weapons or pay out Bolts.
 */
export interface WorkshopItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string; // per level
  maxLevel: number;
  baseCost: number;
  add: Partial<Stats>;
}

export const WORKSHOP: WorkshopItem[] = [
  { id: 'might', name: 'Might', icon: '⚡', color: '#ffd23f', desc: '+5% damage', maxLevel: 5, baseCost: 60, add: { damageMul: 0.05 } },
  { id: 'vitality', name: 'Vitality', icon: '♥', color: '#ff5e7a', desc: '+10 max life', maxLevel: 5, baseCost: 50, add: { maxHp: 10 } },
  { id: 'armor', name: 'Plating', icon: '▣', color: '#8a90c8', desc: '+1 armor', maxLevel: 3, baseCost: 120, add: { armor: 1 } },
  { id: 'recovery', name: 'Recovery', icon: '+', color: '#4fd36a', desc: '+0.2 life per second', maxLevel: 3, baseCost: 100, add: { regen: 0.2 } },
  { id: 'swiftness', name: 'Swiftness', icon: '→', color: '#3de0c8', desc: '+4% move speed', maxLevel: 3, baseCost: 80, add: { moveSpeedMul: 0.04 } },
  { id: 'cooldown', name: 'Overclock', icon: '»', color: '#ff9f3d', desc: 'Weapons recharge 3% faster', maxLevel: 3, baseCost: 120, add: { cooldownMul: -0.03 } },
  { id: 'area', name: 'Amplifier', icon: '◉', color: '#ff7eb6', desc: '+5% weapon area', maxLevel: 3, baseCost: 90, add: { areaMul: 0.05 } },
  { id: 'magnetism', name: 'Magnetism', icon: 'U', color: '#ff3d5a', desc: '+20% pickup range', maxLevel: 3, baseCost: 60, add: { magnet: 0.2 } },
  { id: 'growth', name: 'Growth', icon: '↑', color: '#7dffb0', desc: '+6% XP gained', maxLevel: 5, baseCost: 70, add: { xpMul: 0.06 } },
  { id: 'greed', name: 'Greed', icon: '¢', color: '#ffb627', desc: '+10% Bolts earned', maxLevel: 5, baseCost: 60, add: { boltMul: 0.1 } },
  { id: 'reroll', name: 'Reroll', icon: '↻', color: '#9b6bff', desc: '+1 level-up reroll per run', maxLevel: 3, baseCost: 150, add: { rerolls: 1 } },
  { id: 'revival', name: 'Second Wind', icon: '✚', color: '#ffffff', desc: 'Revive once per run', maxLevel: 1, baseCost: 600, add: { revives: 1 } },
];

/** Cost of buying the next level when `level` levels are already owned. */
export function workshopCost(item: WorkshopItem, level: number): number {
  return Math.round(item.baseCost * (1 + level * 0.8));
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  /** Weapon id unlocked, if any. */
  unlockWeapon?: string;
  bolts: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_steps', name: 'First Steps', desc: 'Defeat 300 enemies in total', bolts: 50 },
  { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat a boss', unlockWeapon: 'missiles', bolts: 100 },
  { id: 'elite_hunter', name: 'Elite Hunter', desc: 'Defeat 5 elites in total', unlockWeapon: 'nova', bolts: 75 },
  { id: 'exterminator', name: 'Exterminator', desc: 'Defeat 3,000 enemies in total', unlockWeapon: 'mines', bolts: 150 },
  { id: 'speedster', name: 'Speedster', desc: 'Dash 60 times in one run', unlockWeapon: 'fire', bolts: 75 },
  { id: 'arsenal', name: 'Full Arsenal', desc: 'Hold 6 weapons at once', bolts: 150 },
  { id: 'maxed', name: 'Maxed Out', desc: 'Get a weapon to level 5', bolts: 100 },
  { id: 'stage_3', name: 'Deep Diver', desc: 'Reach stage 3', bolts: 250 },
];
