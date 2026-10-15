import type { Tag } from './tags';

/**
 * Weapon definitions. Each level lists its full parameter set (not deltas)
 * plus the text shown on the level-up card. Behaviour lives in
 * src/game/weapons/. Damage, cooldown and area are further scaled by stats.
 */
export interface WeaponLevel {
  text: string;
  p: Record<string, number>;
}

/** Arm weapons replace the Buster's rapid fire (primary) or charge shot (secondary). */
export type ArmSlot = 'primary' | 'secondary';

export interface WeaponDef {
  id: string;
  /** Arm weapon slot; arm weapons don't take an auto-weapon slot. */
  slot?: ArmSlot;
  /** The last level is an evolution: new name, colour and look. */
  evo?: { name: string; color: string };
  tags: Tag[];
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
    tags: ['projectile'],
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
    tags: ['orbit'],
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
    tags: ['area', 'shock'],
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
    tags: ['chain', 'shock'],
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
    tags: ['projectile', 'orbit'],
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
    tags: ['projectile', 'explosive'],
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
    tags: ['explosive', 'trail'],
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
    tags: ['area', 'frost'],
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
    tags: ['trail', 'fire'],
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

  // ---------------------------------------------------------------- arm weapons
  scatter: {
    id: 'scatter',
    slot: 'primary',
    evo: { name: "Dragon's Breath", color: '#ff5e3a' },
    tags: ['projectile'],
    name: 'Scattergun',
    icon: '⁂',
    color: '#ffe9a8',
    desc: 'LEFT CLICK: a close-range blast of pellets.',
    starter: true,
    levels: [
      { text: 'Blasts 5 pellets where you aim.', p: { dmg: 7, rate: 1.8, pellets: 5, spread: 40, life: 0.32, speed: 26, pierce: 0 } },
      { text: '+1 pellet, fires faster.', p: { dmg: 8, rate: 2.0, pellets: 6, spread: 40, life: 0.32, speed: 26, pierce: 0 } },
      { text: 'Pellets pierce 1 enemy.', p: { dmg: 9, rate: 2.0, pellets: 7, spread: 42, life: 0.34, speed: 27, pierce: 1 } },
      { text: 'Wider, harder blasts.', p: { dmg: 11, rate: 2.3, pellets: 8, spread: 46, life: 0.34, speed: 28, pierce: 1 } },
      { text: '10 pellets!', p: { dmg: 13, rate: 2.6, pellets: 10, spread: 50, life: 0.36, speed: 28, pierce: 1 } },
      { text: 'EVOLVE: breathes fire that sets enemies ablaze.', p: { dmg: 15, rate: 3.0, pellets: 12, spread: 50, life: 0.42, speed: 30, pierce: 2 } },
    ],
  },
  laser: {
    id: 'laser',
    slot: 'primary',
    evo: { name: 'Prism Lance', color: '#ff7af0' },
    tags: ['projectile', 'area'],
    name: 'Pulse Laser',
    icon: '═',
    color: '#5cf2ff',
    desc: 'LEFT CLICK: a held beam that burns through lines of enemies.',
    starter: true,
    levels: [
      { text: 'Hold to fire a piercing beam.', p: { dps: 60, range: 9, width: 0.35, beams: 1 } },
      { text: 'Longer beam.', p: { dps: 70, range: 10, width: 0.35, beams: 1 } },
      { text: 'Hotter, wider beam.', p: { dps: 85, range: 10, width: 0.45, beams: 1 } },
      { text: 'Longer, stronger beam.', p: { dps: 100, range: 11.5, width: 0.45, beams: 1 } },
      { text: 'Overclocked beam!', p: { dps: 120, range: 12.5, width: 0.55, beams: 1 } },
      { text: 'EVOLVE: splits into a 3-way rainbow lance.', p: { dps: 135, range: 14, width: 0.6, beams: 3 } },
    ],
  },
  orb: {
    id: 'orb',
    slot: 'primary',
    evo: { name: 'Storm Sphere', color: '#b48cff' },
    tags: ['projectile', 'area'],
    name: 'Plasma Orb',
    icon: '◉',
    color: '#7dff9a',
    desc: 'LEFT CLICK: slow orbs that zap everything they pass.',
    starter: true,
    levels: [
      { text: 'Fires orbs that zap nearby enemies.', p: { dmg: 8, rate: 1.6, speed: 9, radius: 2.2, tick: 0.25, life: 1.6 } },
      { text: 'Bigger zap radius.', p: { dmg: 9, rate: 1.8, speed: 9, radius: 2.5, tick: 0.25, life: 1.6 } },
      { text: 'Stronger zaps.', p: { dmg: 12, rate: 2.0, speed: 9, radius: 2.6, tick: 0.25, life: 1.6 } },
      { text: 'Orbs last longer.', p: { dmg: 13, rate: 2.2, speed: 9, radius: 2.9, tick: 0.22, life: 1.9 } },
      { text: 'Supercharged orbs!', p: { dmg: 16, rate: 2.5, speed: 9.5, radius: 3.2, tick: 0.2, life: 1.9 } },
      { text: 'EVOLVE: storm orbs shock enemies and burst at the end.', p: { dmg: 18, rate: 2.5, speed: 9.5, radius: 3.6, tick: 0.2, life: 2.1 } },
    ],
  },
  grenade: {
    id: 'grenade',
    slot: 'secondary',
    evo: { name: 'Cluster Mortar', color: '#ff3d5e' },
    tags: ['explosive'],
    name: 'Grenade Lobber',
    icon: '●',
    color: '#9be35a',
    desc: 'RIGHT CLICK: lob grenades over the crowd.',
    starter: true,
    levels: [
      { text: 'Lobs a grenade where you aim.', p: { cd: 1.2, dmg: 50, radius: 2.6, range: 8, bomblets: 0 } },
      { text: 'Bigger boom.', p: { cd: 1.1, dmg: 60, radius: 2.8, range: 8.5, bomblets: 0 } },
      { text: 'Faster reload.', p: { cd: 0.95, dmg: 72, radius: 3.0, range: 9, bomblets: 0 } },
      { text: 'Heavier grenades.', p: { cd: 0.9, dmg: 85, radius: 3.3, range: 9, bomblets: 0 } },
      { text: 'Huge blasts!', p: { cd: 0.8, dmg: 100, radius: 3.6, range: 9.5, bomblets: 0 } },
      { text: 'EVOLVE: each shell scatters 6 bomblets.', p: { cd: 0.8, dmg: 110, radius: 3.8, range: 10, bomblets: 6 } },
    ],
  },
  well: {
    id: 'well',
    slot: 'secondary',
    evo: { name: 'Event Horizon', color: '#c23dff' },
    tags: ['area'],
    name: 'Gravity Well',
    icon: '◌',
    color: '#7a8cff',
    desc: 'RIGHT CLICK: throw a vortex that drags enemies in.',
    starter: true,
    levels: [
      { text: 'Throws a vortex that pulls and grinds.', p: { cd: 6, radius: 4, pull: 6, dps: 15, life: 2.5, implode: 0 } },
      { text: 'Bigger vortex.', p: { cd: 5.5, radius: 4.5, pull: 6.5, dps: 18, life: 2.5, implode: 0 } },
      { text: 'Lasts longer, grinds harder.', p: { cd: 5.5, radius: 4.6, pull: 7, dps: 25, life: 3, implode: 0 } },
      { text: 'Stronger pull.', p: { cd: 5, radius: 5, pull: 8.5, dps: 28, life: 3, implode: 0 } },
      { text: 'Massive vortex!', p: { cd: 4.5, radius: 5.5, pull: 9, dps: 35, life: 3.5, implode: 0 } },
      { text: 'EVOLVE: a black hole that implodes at the end.', p: { cd: 4.5, radius: 6.5, pull: 11, dps: 45, life: 3.5, implode: 120 } },
    ],
  },
  shield: {
    id: 'shield',
    slot: 'secondary',
    evo: { name: 'Mirror Aegis', color: '#ffd23f' },
    tags: ['area'],
    name: 'Aegis Shield',
    icon: '◗',
    color: '#5ce1ff',
    desc: 'RIGHT CLICK: hold up a shield that eats bullets and shoves enemies.',
    starter: true,
    levels: [
      { text: 'Hold to raise a shield in front of you.', p: { dmg: 12, arc: 100, radius: 1.6, knock: 10, dur: 2.5 } },
      { text: 'Lasts longer.', p: { dmg: 14, arc: 110, radius: 1.6, knock: 11, dur: 3 } },
      { text: 'Wider, harder shield.', p: { dmg: 18, arc: 125, radius: 1.8, knock: 12, dur: 3.5 } },
      { text: 'Lasts longer.', p: { dmg: 22, arc: 140, radius: 1.8, knock: 13, dur: 4 } },
      { text: 'Wide bulwark!', p: { dmg: 28, arc: 160, radius: 2.0, knock: 14, dur: 5 } },
      { text: 'EVOLVE: a full mirror dome that reflects bullets.', p: { dmg: 34, arc: 360, radius: 2.2, knock: 15, dur: 6 } },
    ],
  },
};
