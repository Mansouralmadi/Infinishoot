/**
 * Weapon definitions. Each level lists its full parameter set (not deltas)
 * plus the text shown on the level-up card. Behaviour lives in
 * src/game/weapons/. Damage, cooldown and area are further scaled by stats.
 */
export interface WeaponLevel {
  text: string;
  p: Record<string, number>;
}

export interface WeaponDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  /** Available from the first run; otherwise unlocked by an achievement. */
  starter: boolean;
  levels: WeaponLevel[];
}

export const WEAPONS: Record<string, WeaponDef> = {
  buster: {
    id: 'buster',
    name: 'Buster',
    icon: '▶',
    color: '#ffd23f',
    desc: 'Your trusty arm cannon. Aim and fire.',
    starter: true,
    levels: [
      { text: 'Rapid shots where you aim.', p: { dmg: 10, rate: 7, shots: 1, arc: 0, pierce: 0, size: 1, speed: 28 } },
      { text: 'Faster, harder shots.', p: { dmg: 12, rate: 8.5, shots: 1, arc: 0, pierce: 0, size: 1, speed: 30 } },
      { text: 'Fires 2 shots.', p: { dmg: 12, rate: 8.5, shots: 2, arc: 10, pierce: 0, size: 1.1, speed: 30 } },
      { text: 'Shots pierce 1 enemy.', p: { dmg: 14, rate: 9.5, shots: 2, arc: 10, pierce: 1, size: 1.2, speed: 32 } },
      { text: 'Triple mega shots!', p: { dmg: 16, rate: 10.5, shots: 3, arc: 16, pierce: 2, size: 1.45, speed: 34 } },
    ],
  },
  drones: {
    id: 'drones',
    name: 'Orbit Drones',
    icon: '✦',
    color: '#4fc3ff',
    desc: 'Little drones circle you and bonk enemies.',
    starter: true,
    levels: [
      { text: '2 drones orbit you.', p: { count: 2, dmg: 8, radius: 2.4, spin: 2.6, size: 1 } },
      { text: '+1 drone.', p: { count: 3, dmg: 9, radius: 2.5, spin: 2.8, size: 1 } },
      { text: 'Wider orbit, more damage.', p: { count: 3, dmg: 13, radius: 3.0, spin: 3.0, size: 1.15 } },
      { text: '+1 drone, spins faster.', p: { count: 4, dmg: 14, radius: 3.1, spin: 3.6, size: 1.2 } },
      { text: '6 big drones!', p: { count: 6, dmg: 18, radius: 3.4, spin: 3.8, size: 1.45 } },
    ],
  },
  aura: {
    id: 'aura',
    name: 'Zap Field',
    icon: '◎',
    color: '#3de0c8',
    desc: 'An electric field shocks nearby enemies.',
    starter: true,
    levels: [
      { text: 'Shocks enemies around you.', p: { radius: 2.3, dmg: 6, tick: 0.5, slow: 0 } },
      { text: 'Bigger field.', p: { radius: 2.8, dmg: 7, tick: 0.5, slow: 0 } },
      { text: 'Stronger shocks.', p: { radius: 3.0, dmg: 10, tick: 0.45, slow: 0 } },
      { text: 'Enemies inside are slowed.', p: { radius: 3.4, dmg: 11, tick: 0.45, slow: 0.35 } },
      { text: 'Huge storm field!', p: { radius: 4.2, dmg: 15, tick: 0.4, slow: 0.45 } },
    ],
  },
  lightning: {
    id: 'lightning',
    name: 'Chain Zap',
    icon: 'ϟ',
    color: '#fff35c',
    desc: 'Lightning jumps between enemies.',
    starter: true,
    levels: [
      { text: 'Zaps an enemy, chains to 2 more.', p: { cd: 1.6, dmg: 18, chains: 2, bolts: 1, range: 10, hop: 4.5 } },
      { text: 'Chains to 3.', p: { cd: 1.5, dmg: 20, chains: 3, bolts: 1, range: 10, hop: 4.5 } },
      { text: 'More damage, faster.', p: { cd: 1.25, dmg: 27, chains: 3, bolts: 1, range: 11, hop: 5 } },
      { text: '2 bolts, chains to 5.', p: { cd: 1.25, dmg: 28, chains: 5, bolts: 2, range: 11, hop: 5 } },
      { text: '3 thunder bolts!', p: { cd: 1.0, dmg: 36, chains: 7, bolts: 3, range: 12, hop: 5.5 } },
    ],
  },
  discs: {
    id: 'discs',
    name: 'Boomer Disc',
    icon: '◐',
    color: '#ff3df0',
    desc: 'Throws a disc that slices out and back.',
    starter: true,
    levels: [
      { text: 'Throws a piercing disc.', p: { cd: 1.4, dmg: 14, count: 1, range: 7, size: 1, speed: 16 } },
      { text: 'Bigger disc.', p: { cd: 1.3, dmg: 15, count: 1, range: 7.5, size: 1.35, speed: 16 } },
      { text: 'Throws 2 discs.', p: { cd: 1.3, dmg: 16, count: 2, range: 8, size: 1.35, speed: 17 } },
      { text: 'Longer, harder throws.', p: { cd: 1.15, dmg: 22, count: 2, range: 9.5, size: 1.5, speed: 19 } },
      { text: '4 giant discs!', p: { cd: 1.0, dmg: 26, count: 4, range: 10, size: 1.6, speed: 20 } },
    ],
  },
  missiles: {
    id: 'missiles',
    name: 'Seeker Pod',
    icon: '➶',
    color: '#ff5e5e',
    desc: 'Homing missiles that explode on impact.',
    starter: false,
    levels: [
      { text: 'Fires 2 homing missiles.', p: { cd: 1.8, count: 2, dmg: 20, radius: 1.8 } },
      { text: '3 missiles.', p: { cd: 1.7, count: 3, dmg: 22, radius: 1.9 } },
      { text: 'Bigger blasts.', p: { cd: 1.6, count: 3, dmg: 30, radius: 2.3 } },
      { text: '5 missiles.', p: { cd: 1.5, count: 5, dmg: 32, radius: 2.4 } },
      { text: 'Missile swarm!', p: { cd: 1.3, count: 8, dmg: 38, radius: 2.7 } },
    ],
  },
  mines: {
    id: 'mines',
    name: 'Pop Mines',
    icon: '✷',
    color: '#ff9f3d',
    desc: 'Drops mines behind you as you run.',
    starter: false,
    levels: [
      { text: 'Drop a mine every second.', p: { cd: 1.0, dmg: 30, radius: 2.0, max: 6, per: 1 } },
      { text: 'More mines out at once.', p: { cd: 0.85, dmg: 32, radius: 2.1, max: 10, per: 1 } },
      { text: 'Stronger blasts.', p: { cd: 0.8, dmg: 44, radius: 2.4, max: 10, per: 1 } },
      { text: 'Bigger blasts.', p: { cd: 0.7, dmg: 46, radius: 2.8, max: 14, per: 1 } },
      { text: 'Drops 2 at a time!', p: { cd: 0.6, dmg: 58, radius: 3.0, max: 20, per: 2 } },
    ],
  },
  nova: {
    id: 'nova',
    name: 'Frost Nova',
    icon: '❄',
    color: '#9fe8ff',
    desc: 'Freezes enemies around you solid.',
    starter: false,
    levels: [
      { text: 'Freezes nearby enemies.', p: { cd: 4.0, radius: 4.5, freeze: 1.2, dmg: 6, shatter: 0 } },
      { text: 'Bigger nova.', p: { cd: 3.8, radius: 5.5, freeze: 1.3, dmg: 8, shatter: 0 } },
      { text: 'Longer freeze.', p: { cd: 3.6, radius: 5.8, freeze: 1.9, dmg: 12, shatter: 0 } },
      { text: 'Frozen enemies take +50% damage.', p: { cd: 3.2, radius: 6.5, freeze: 2.0, dmg: 14, shatter: 0.5 } },
      { text: 'Absolute zero!', p: { cd: 2.8, radius: 8, freeze: 2.6, dmg: 20, shatter: 1.0 } },
    ],
  },
  fire: {
    id: 'fire',
    name: 'Blaze Boots',
    icon: '♨',
    color: '#ff7a2f',
    desc: 'Leave a trail of fire when you move.',
    starter: false,
    levels: [
      { text: 'Running leaves burning flames.', p: { life: 1.6, radius: 0.8, dps: 14, dash: 0 } },
      { text: 'Flames last longer.', p: { life: 2.2, radius: 0.85, dps: 16, dash: 0 } },
      { text: 'Hotter, wider flames.', p: { life: 2.4, radius: 1.0, dps: 24, dash: 0 } },
      { text: 'Dashing leaves a firewall.', p: { life: 2.6, radius: 1.05, dps: 26, dash: 1 } },
      { text: 'Inferno!', p: { life: 3.2, radius: 1.25, dps: 36, dash: 1 } },
    ],
  },
};
