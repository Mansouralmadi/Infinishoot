import type { Rarity } from './rarity';

/**
 * Specials: the screen-clearing ability on Q/E/middle click (pad RB/Y),
 * charged by XP from kills. You hold one at a time: a new special from a
 * level-up card replaces the current one (and its levels). Each has 5 levels
 * with full params per level; `charge` multiplies how fast the meter fills.
 * Behaviour: the Bomb lives in Game (tryBomb/updateBomb); the others in
 * src/game/specials.ts.
 */
export interface SpecialDef {
  id: string;
  name: string;
  /** Short label for the HUD meter. */
  short: string;
  icon: string;
  color: string;
  rarity: Rarity;
  desc: string;
  levels: { text: string; p: Record<string, number> }[];
}

export const SPECIALS: Record<string, SpecialDef> = {
  bomb: {
    id: 'bomb',
    name: 'Bomb',
    short: 'BOMB',
    icon: '✹',
    color: '#ef7d57',
    rarity: 'common',
    desc: 'A shockwave that blasts everything around you and clears enemy bullets.',
    levels: [
      { text: 'Shockwave around you.', p: { dmg: 80, radius: 10, charge: 1 } },
      { text: 'Bigger, harder blast.', p: { dmg: 110, radius: 11, charge: 1.1 } },
      { text: 'Charges faster.', p: { dmg: 140, radius: 12, charge: 1.25 } },
      { text: 'Wider shockwave.', p: { dmg: 180, radius: 13.5, charge: 1.35 } },
      { text: 'Mega bomb!', p: { dmg: 240, radius: 15, charge: 1.5 } },
    ],
  },
  storm: {
    id: 'storm',
    name: 'Thunderstorm',
    short: 'STORM',
    icon: 'ϟ',
    color: '#ffcd75',
    rarity: 'rare',
    desc: 'Calls a storm: lightning strikes enemies around you for a few seconds.',
    levels: [
      { text: 'Lightning rains on nearby enemies and chains to 2 more.', p: { dur: 3, rate: 8, dmg: 40, radius: 14, chains: 2, charge: 1 } },
      { text: 'More strikes, longer storm.', p: { dur: 3.5, rate: 9, dmg: 48, radius: 14, chains: 2, charge: 1.05 } },
      { text: 'Wider, faster storm.', p: { dur: 4, rate: 10, dmg: 58, radius: 16, chains: 2, charge: 1.1 } },
      { text: 'Bolts chain to 3.', p: { dur: 4.5, rate: 11, dmg: 70, radius: 16, chains: 3, charge: 1.2 } },
      { text: 'Supercell!', p: { dur: 5, rate: 12, dmg: 85, radius: 18, chains: 3, charge: 1.3 } },
    ],
  },
  blizzard: {
    id: 'blizzard',
    name: 'Blizzard',
    short: 'FREEZE',
    icon: '❄',
    color: '#73eff7',
    rarity: 'rare',
    desc: 'An icy wave freezes everything around you; frozen enemies take extra damage.',
    levels: [
      { text: 'Freezes enemies around you.', p: { radius: 14, freeze: 2.0, shatter: 0.4, dmg: 40, charge: 1 } },
      { text: 'Bigger wave.', p: { radius: 16, freeze: 2.2, shatter: 0.5, dmg: 55, charge: 1.05 } },
      { text: 'Longer freeze.', p: { radius: 18, freeze: 2.4, shatter: 0.6, dmg: 70, charge: 1.1 } },
      { text: 'Frozen enemies take +75%.', p: { radius: 20, freeze: 2.6, shatter: 0.75, dmg: 90, charge: 1.2 } },
      { text: 'Ice age!', p: { radius: 24, freeze: 3.0, shatter: 0.9, dmg: 120, charge: 1.3 } },
    ],
  },
  meteor: {
    id: 'meteor',
    name: 'Meteor Shower',
    short: 'METEOR',
    icon: '☄',
    color: '#ff7a2f',
    rarity: 'legendary',
    desc: 'Meteors rain down around you, exploding and setting enemies ablaze.',
    levels: [
      { text: '8 meteors crash around you.', p: { count: 8, dur: 2, dmg: 120, blast: 2.4, area: 12, charge: 1 } },
      { text: '10 meteors.', p: { count: 10, dur: 2, dmg: 135, blast: 2.5, area: 13, charge: 1.05 } },
      { text: 'Bigger impacts.', p: { count: 12, dur: 2.2, dmg: 150, blast: 2.8, area: 14, charge: 1.1 } },
      { text: '15 meteors.', p: { count: 15, dur: 2.4, dmg: 170, blast: 3.0, area: 15, charge: 1.2 } },
      { text: 'Extinction event!', p: { count: 18, dur: 2.5, dmg: 200, blast: 3.2, area: 16, charge: 1.3 } },
    ],
  },
};
