import type { Stats } from '../game/stats';

/** Passive items: simple stat boosts, 5 levels each. `add` is applied once per level. */
export interface PassiveDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string; // per-level effect
  maxLevel: number;
  add: Partial<Stats>;
  healOnPick?: number;
}

export const PASSIVES: Record<string, PassiveDef> = {
  power_cell: {
    id: 'power_cell',
    name: 'Power Cell',
    icon: '⚡',
    color: '#ffd23f',
    desc: '+10% damage',
    maxLevel: 5,
    add: { damageMul: 0.1 },
  },
  rapid_coil: {
    id: 'rapid_coil',
    name: 'Rapid Coil',
    icon: '»',
    color: '#ff9f3d',
    desc: 'Weapons recharge 8% faster',
    maxLevel: 5,
    add: { cooldownMul: -0.08 },
  },
  magnet: {
    id: 'magnet',
    name: 'Magnet',
    icon: 'U',
    color: '#ff3d5a',
    desc: '+35% pickup range',
    maxLevel: 5,
    add: { magnet: 0.35 },
  },
  sneakers: {
    id: 'sneakers',
    name: 'Turbo Sneakers',
    icon: '→',
    color: '#3de0c8',
    desc: '+8% move speed',
    maxLevel: 5,
    add: { moveSpeedMul: 0.08 },
  },
  heart: {
    id: 'heart',
    name: 'Heart Container',
    icon: '♥',
    color: '#ff5e7a',
    desc: '+20 max life, heal 20',
    maxLevel: 5,
    add: { maxHp: 20 },
    healOnPick: 20,
  },
  armor: {
    id: 'armor',
    name: 'Armor Plate',
    icon: '▣',
    color: '#8a90c8',
    desc: 'Take 1 less damage per hit',
    maxLevel: 5,
    add: { armor: 1 },
  },
  big_bang: {
    id: 'big_bang',
    name: 'Big Bang',
    icon: '◉',
    color: '#ff7eb6',
    desc: '+10% weapon area',
    maxLevel: 5,
    add: { areaMul: 0.1 },
  },
  lucky_star: {
    id: 'lucky_star',
    name: 'Lucky Star',
    icon: '★',
    color: '#fff35c',
    desc: '+6% critical hit chance',
    maxLevel: 5,
    add: { critChance: 0.06 },
  },
  growth: {
    id: 'growth',
    name: 'Growth Chip',
    icon: '↑',
    color: '#7dffb0',
    desc: '+10% XP gained',
    maxLevel: 5,
    add: { xpMul: 0.1 },
  },
  nanobots: {
    id: 'nanobots',
    name: 'Nanobots',
    icon: '+',
    color: '#4fd36a',
    desc: 'Regenerate 0.3 life per second',
    maxLevel: 5,
    add: { regen: 0.3 },
  },
};
