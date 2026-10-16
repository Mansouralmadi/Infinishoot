import type { Rarity } from './rarity';
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
  rarity: Rarity;
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

/** Damage from the right-click slot: the Buster's charge shot or a secondary arm weapon. */
export function isRightClick(source: string): boolean {
  return source === 'charge' || WEAPONS[source]?.slot === 'secondary';
}

export const WEAPONS: Record<string, WeaponDef> = {
  buster: {
    id: 'buster',
    rarity: 'common',
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
    rarity: 'common',
    tags: ['orbit'],
    name: 'Orbit Drones',
    icon: '✦',
    color: '#4fc3ff',
    desc: 'Little drones circle you and bonk enemies.',
    starter: true,
    levels: [
      { text: '3 drones orbit you.', p: { count: 3, dmg: 14, radius: 2.0, spin: 3.0, size: 1 } },
      { text: 'Harder hits.', p: { count: 3, dmg: 17, radius: 2.2, spin: 3.2, size: 1 } },
      { text: '+1 drone, wider orbit.', p: { count: 4, dmg: 22, radius: 2.4, spin: 3.4, size: 1.15 } },
      { text: '+1 drone, spins faster.', p: { count: 5, dmg: 27, radius: 2.6, spin: 3.6, size: 1.2 } },
      { text: '6 big drones!', p: { count: 6, dmg: 36, radius: 2.8, spin: 3.8, size: 1.45 } },
    ],
  },
  aura: {
    id: 'aura',
    rarity: 'common',
    tags: ['area', 'shock'],
    name: 'Zap Field',
    icon: '◎',
    color: '#3de0c8',
    desc: 'An electric field shocks nearby enemies.',
    starter: true,
    levels: [
      { text: 'Shocks enemies around you.', p: { radius: 2.3, dmg: 12, tick: 0.5, slow: 0 } },
      { text: 'Bigger field.', p: { radius: 2.8, dmg: 15, tick: 0.45, slow: 0 } },
      { text: 'Stronger shocks.', p: { radius: 3.0, dmg: 20, tick: 0.4, slow: 0 } },
      { text: 'Enemies inside are slowed.', p: { radius: 3.4, dmg: 24, tick: 0.35, slow: 0.35 } },
      { text: 'Huge storm field!', p: { radius: 4.2, dmg: 32, tick: 0.3, slow: 0.45 } },
    ],
  },
  lightning: {
    id: 'lightning',
    rarity: 'common',
    tags: ['chain', 'shock'],
    name: 'Chain Zap',
    icon: 'ϟ',
    color: '#fff35c',
    desc: 'Lightning jumps between enemies.',
    starter: true,
    levels: [
      { text: 'Zaps an enemy, chains to 3 more.', p: { cd: 1.3, dmg: 22, chains: 3, bolts: 1, range: 10, hop: 4.5 } },
      { text: 'Chains to 4.', p: { cd: 1.2, dmg: 25, chains: 4, bolts: 1, range: 10, hop: 4.5 } },
      { text: '2 bolts, more damage.', p: { cd: 1.1, dmg: 30, chains: 4, bolts: 2, range: 11, hop: 5 } },
      { text: 'Chains to 5, faster.', p: { cd: 1.05, dmg: 32, chains: 5, bolts: 2, range: 11, hop: 5 } },
      { text: '3 thunder bolts!', p: { cd: 1.0, dmg: 36, chains: 7, bolts: 3, range: 12, hop: 5.5 } },
    ],
  },
  discs: {
    id: 'discs',
    rarity: 'common',
    tags: ['projectile', 'orbit'],
    name: 'Boomer Disc',
    icon: '◐',
    color: '#3de0c8',
    desc: 'Throws a disc that slices out and back.',
    starter: true,
    levels: [
      { text: 'Throws a piercing disc.', p: { cd: 1.4, dmg: 22, count: 1, range: 7, size: 1, speed: 16 } },
      { text: 'Bigger disc.', p: { cd: 1.3, dmg: 26, count: 1, range: 7.5, size: 1.35, speed: 16 } },
      { text: 'Throws 2 discs.', p: { cd: 1.3, dmg: 30, count: 2, range: 8, size: 1.35, speed: 17 } },
      { text: 'Longer, harder throws.', p: { cd: 1.15, dmg: 36, count: 2, range: 9.5, size: 1.5, speed: 19 } },
      { text: '4 giant discs!', p: { cd: 1.0, dmg: 44, count: 4, range: 10, size: 1.6, speed: 20 } },
    ],
  },
  missiles: {
    id: 'missiles',
    rarity: 'uncommon',
    tags: ['projectile', 'explosive'],
    name: 'Seeker Pod',
    icon: '➶',
    color: '#ff5e5e',
    desc: 'Homing missiles that explode on impact.',
    starter: false,
    levels: [
      { text: 'Fires 2 homing missiles.', p: { cd: 1.5, count: 2, dmg: 26, radius: 1.8 } },
      { text: '3 missiles.', p: { cd: 1.4, count: 3, dmg: 28, radius: 1.9 } },
      { text: 'Bigger blasts.', p: { cd: 1.4, count: 3, dmg: 34, radius: 2.3 } },
      { text: '5 missiles.', p: { cd: 1.35, count: 5, dmg: 36, radius: 2.4 } },
      { text: 'Missile swarm!', p: { cd: 1.3, count: 8, dmg: 40, radius: 2.7 } },
    ],
  },
  mines: {
    id: 'mines',
    rarity: 'uncommon',
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
    rarity: 'rare',
    tags: ['area', 'frost'],
    name: 'Frost Nova',
    icon: '❄',
    color: '#9fe8ff',
    desc: 'Freezes enemies around you solid.',
    starter: false,
    levels: [
      { text: 'Freezes nearby enemies. Frozen enemies take +20% damage.', p: { cd: 4.0, radius: 4.5, freeze: 1.2, dmg: 15, shatter: 0.2 } },
      { text: 'Bigger nova, +30% frozen damage.', p: { cd: 3.8, radius: 5.5, freeze: 1.3, dmg: 20, shatter: 0.3 } },
      { text: 'Longer freeze, +40%.', p: { cd: 3.6, radius: 5.8, freeze: 1.9, dmg: 26, shatter: 0.4 } },
      { text: 'Frozen enemies take +50% damage.', p: { cd: 3.2, radius: 6.5, freeze: 2.0, dmg: 32, shatter: 0.5 } },
      { text: 'Absolute zero! +75%.', p: { cd: 2.8, radius: 8, freeze: 2.6, dmg: 40, shatter: 0.75 } },
    ],
  },
  fire: {
    id: 'fire',
    rarity: 'rare',
    tags: ['trail', 'fire'],
    name: 'Blaze Boots',
    icon: '♨',
    color: '#ff7a2f',
    desc: 'Leave a trail of fire when you move.',
    starter: false,
    levels: [
      { text: 'Running leaves burning flames.', p: { life: 2.0, radius: 0.8, dps: 30, dash: 0 } },
      { text: 'Flames last longer.', p: { life: 2.4, radius: 0.85, dps: 38, dash: 0 } },
      { text: 'Hotter, wider flames.', p: { life: 2.8, radius: 1.0, dps: 50, dash: 0 } },
      { text: 'Dashing leaves a firewall.', p: { life: 3.0, radius: 1.05, dps: 65, dash: 1 } },
      { text: 'Inferno!', p: { life: 3.6, radius: 1.25, dps: 90, dash: 1 } },
    ],
  },

  // ---------------------------------------------------------------- arm weapons
  scatter: {
    id: 'scatter',
    rarity: 'uncommon',
    slot: 'primary',
    evo: { name: "Dragon's Breath", color: '#ff5e3a' },
    tags: ['projectile'],
    name: 'Scattergun',
    icon: '⁂',
    color: '#ffe9a8',
    desc: 'LEFT CLICK: a close-range blast of pellets.',
    starter: true,
    levels: [
      { text: 'Blasts 8 pellets where you aim.', p: { dmg: 12, rate: 2.2, pellets: 8, spread: 40, life: 0.32, speed: 26, pierce: 0 } },
      { text: 'Faster, harder blasts.', p: { dmg: 13, rate: 2.3, pellets: 8, spread: 40, life: 0.32, speed: 26, pierce: 0 } },
      { text: '+1 pellet, pellets pierce 1.', p: { dmg: 15, rate: 2.4, pellets: 9, spread: 42, life: 0.34, speed: 27, pierce: 1 } },
      { text: '+1 pellet, wider blast.', p: { dmg: 18, rate: 2.6, pellets: 10, spread: 46, life: 0.34, speed: 28, pierce: 1 } },
      { text: '11 pellets that pierce 2!', p: { dmg: 22, rate: 2.8, pellets: 11, spread: 50, life: 0.36, speed: 28, pierce: 2 } },
      { text: 'EVOLVE: breathes fire that sets enemies ablaze.', p: { dmg: 24, rate: 3.2, pellets: 13, spread: 50, life: 0.42, speed: 30, pierce: 3 } },
    ],
  },
  laser: {
    id: 'laser',
    rarity: 'legendary',
    slot: 'primary',
    evo: { name: 'Prism Lance', color: '#fff35c' },
    tags: ['projectile', 'area'],
    name: 'Pulse Laser',
    icon: '═',
    color: '#5cf2ff',
    desc: 'LEFT CLICK: a held beam that burns through lines of enemies.',
    starter: true,
    levels: [
      { text: 'Hold to fire a piercing beam.', p: { dps: 150, range: 9, width: 0.35, beams: 1 } },
      { text: 'Longer beam.', p: { dps: 200, range: 10, width: 0.35, beams: 1 } },
      { text: 'Hotter, wider beam.', p: { dps: 260, range: 10, width: 0.45, beams: 1 } },
      { text: 'Longer, stronger beam.', p: { dps: 340, range: 11.5, width: 0.45, beams: 1 } },
      { text: 'Overclocked beam!', p: { dps: 450, range: 12.5, width: 0.55, beams: 1 } },
      { text: 'EVOLVE: splits into a 3-way rainbow lance.', p: { dps: 550, range: 14, width: 0.6, beams: 3 } },
    ],
  },
  orb: {
    id: 'orb',
    rarity: 'legendary',
    slot: 'primary',
    evo: { name: 'Storm Sphere', color: '#b48cff' },
    tags: ['projectile', 'area'],
    name: 'Plasma Orb',
    icon: '◉',
    color: '#7dff9a',
    desc: 'LEFT CLICK: slow orbs that zap everything they pass.',
    starter: true,
    levels: [
      { text: 'Fires orbs that zap nearby enemies.', p: { dmg: 14, rate: 1.6, speed: 7, radius: 2.2, tick: 0.25, life: 2.0 } },
      { text: 'Bigger zap radius.', p: { dmg: 16, rate: 1.8, speed: 7, radius: 2.5, tick: 0.25, life: 2.0 } },
      { text: 'Stronger zaps.', p: { dmg: 18, rate: 2.0, speed: 7, radius: 2.6, tick: 0.25, life: 2.0 } },
      { text: 'Orbs last longer.', p: { dmg: 20, rate: 2.2, speed: 7, radius: 2.9, tick: 0.22, life: 2.3 } },
      { text: 'Supercharged orbs!', p: { dmg: 22, rate: 2.5, speed: 7, radius: 3.2, tick: 0.2, life: 2.3 } },
      { text: 'EVOLVE: storm orbs shock enemies and burst at the end.', p: { dmg: 26, rate: 2.5, speed: 7, radius: 3.6, tick: 0.2, life: 2.5 } },
    ],
  },
  grenade: {
    id: 'grenade',
    rarity: 'legendary',
    slot: 'secondary',
    evo: { name: 'Cluster Mortar', color: '#ff3d5e' },
    tags: ['explosive'],
    name: 'Grenade Lobber',
    icon: '●',
    color: '#9be35a',
    desc: 'RIGHT CLICK: lob grenades over the crowd.',
    starter: true,
    levels: [
      { text: 'Lobs a grenade where you aim.', p: { cd: 1.2, dmg: 70, radius: 2.6, range: 8, bomblets: 0 } },
      { text: 'Bigger boom.', p: { cd: 1.1, dmg: 85, radius: 2.8, range: 8.5, bomblets: 0 } },
      { text: 'Faster reload.', p: { cd: 0.95, dmg: 100, radius: 3.0, range: 9, bomblets: 0 } },
      { text: 'Heavier grenades.', p: { cd: 0.9, dmg: 120, radius: 3.3, range: 9, bomblets: 0 } },
      { text: 'Huge blasts!', p: { cd: 0.8, dmg: 140, radius: 3.6, range: 9.5, bomblets: 0 } },
      { text: 'EVOLVE: each shell scatters 6 bomblets.', p: { cd: 0.8, dmg: 160, radius: 3.8, range: 10, bomblets: 6 } },
    ],
  },
  well: {
    id: 'well',
    rarity: 'legendary',
    slot: 'secondary',
    evo: { name: 'Event Horizon', color: '#c23dff' },
    tags: ['area'],
    name: 'Gravity Well',
    icon: '◌',
    color: '#7a8cff',
    desc: 'RIGHT CLICK: throw a vortex that drags enemies in.',
    starter: true,
    levels: [
      { text: 'Throws a vortex that pulls and grinds.', p: { cd: 3.5, radius: 4, pull: 6, dps: 40, life: 2.5, implode: 0 } },
      { text: 'Bigger vortex.', p: { cd: 3.5, radius: 4.5, pull: 6.5, dps: 50, life: 2.5, implode: 0 } },
      { text: 'Lasts longer, grinds harder.', p: { cd: 3.2, radius: 4.6, pull: 7, dps: 65, life: 3, implode: 0 } },
      { text: 'Stronger pull.', p: { cd: 3.0, radius: 5, pull: 8.5, dps: 80, life: 3, implode: 0 } },
      { text: 'Massive vortex!', p: { cd: 2.8, radius: 5.5, pull: 9, dps: 100, life: 3.5, implode: 0 } },
      { text: 'EVOLVE: a black hole that implodes at the end.', p: { cd: 2.8, radius: 6.5, pull: 11, dps: 130, life: 3.5, implode: 400 } },
    ],
  },
  shield: {
    id: 'shield',
    rarity: 'legendary',
    slot: 'secondary',
    evo: { name: 'Mirror Aegis', color: '#ffd23f' },
    tags: ['area'],
    name: 'Aegis Shield',
    icon: '◗',
    color: '#5ce1ff',
    desc: 'RIGHT CLICK: deploy a shield toward your aim that blocks bullets and slams enemies away until it breaks or times out.',
    starter: true,
    levels: [
      { text: 'Press to deploy a shield that follows your aim.', p: { dmg: 20, arc: 100, radius: 1.6, knock: 22, dur: 3, cd: 5, hp: 60 } },
      { text: 'Tougher, lasts longer.', p: { dmg: 24, arc: 110, radius: 1.6, knock: 24, dur: 3.5, cd: 4.8, hp: 80 } },
      { text: 'Wider, harder shield.', p: { dmg: 30, arc: 125, radius: 1.8, knock: 26, dur: 4, cd: 4.5, hp: 100 } },
      { text: 'Tougher, faster recharge.', p: { dmg: 38, arc: 140, radius: 1.8, knock: 28, dur: 4.5, cd: 4.2, hp: 130 } },
      { text: 'Wide bulwark!', p: { dmg: 48, arc: 160, radius: 2.0, knock: 30, dur: 5, cd: 4, hp: 170 } },
      { text: 'EVOLVE: a full mirror dome that reflects bullets.', p: { dmg: 60, arc: 360, radius: 2.2, knock: 34, dur: 6, cd: 3.5, hp: 240 } },
    ],
  },
  rail: {
    id: 'rail',
    rarity: 'legendary',
    slot: 'primary',
    evo: { name: 'Ion Rail', color: '#9b6bff' },
    tags: ['projectile'],
    name: 'Rail Driver',
    icon: '⟶',
    color: '#a0c4ff',
    desc: 'LEFT CLICK: a hyper-velocity rail that pierces everything in a long line.',
    starter: true,
    levels: [
      { text: 'Fires a rail through every enemy in line.', p: { dmg: 90, rate: 1.6, range: 18, width: 0.5, ion: 0 } },
      { text: 'Harder, faster rails.', p: { dmg: 110, rate: 1.7, range: 18, width: 0.5, ion: 0 } },
      { text: 'Wider rails.', p: { dmg: 135, rate: 1.8, range: 18, width: 0.6, ion: 0 } },
      { text: 'Longer reach.', p: { dmg: 170, rate: 1.9, range: 20, width: 0.6, ion: 0 } },
      { text: 'Overcharged coils!', p: { dmg: 200, rate: 2.1, range: 20, width: 0.7, ion: 0 } },
      { text: 'EVOLVE: rails leave an ion trail that detonates along its length.', p: { dmg: 210, rate: 2.1, range: 22, width: 0.75, ion: 1 } },
    ],
  },
  orbital: {
    id: 'orbital',
    rarity: 'legendary',
    slot: 'secondary',
    evo: { name: 'Sun Lance', color: '#ff7a2f' },
    tags: ['area', 'explosive'],
    name: 'Orbital Strike',
    icon: '⇓',
    color: '#73eff7',
    desc: 'RIGHT CLICK: call a satellite beam down from the sky.',
    starter: true,
    levels: [
      { text: 'Calls a sky beam ahead of you.', p: { cd: 2.6, dmg: 220, radius: 2.4, range: 9, delay: 0.7, linger: 0, dps: 0 } },
      { text: 'Stronger beam.', p: { cd: 2.5, dmg: 260, radius: 2.6, range: 9, delay: 0.7, linger: 0, dps: 0 } },
      { text: 'Wider beam.', p: { cd: 2.4, dmg: 310, radius: 2.8, range: 9, delay: 0.7, linger: 0, dps: 0 } },
      { text: 'Faster uplink.', p: { cd: 2.2, dmg: 370, radius: 3.0, range: 9.5, delay: 0.6, linger: 0, dps: 0 } },
      { text: 'Full satellite power!', p: { cd: 2.0, dmg: 400, radius: 3.3, range: 10, delay: 0.6, linger: 0, dps: 0 } },
      { text: 'EVOLVE: a blazing sun beam that lingers and burns.', p: { cd: 2.0, dmg: 450, radius: 3.6, range: 10, delay: 0.6, linger: 2, dps: 180 } },
    ],
  },
};
