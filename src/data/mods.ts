import type { ModDef } from '../game/modTypes';
import { isRightClick } from './weapons';

/**
 * Mods: bought in the shop between stages, held in ordered slots. They key
 * off weapon tags, triggers, statuses and the economy, so the best Mod is
 * the one that fits what you already have.
 *
 * Damage pipeline per hit, left to right: amount = (amount + add) * mult.
 */
export const MODS: ModDef[] = [
  // ---------------------------------------------------------------- tag synergies
  {
    id: 'demolition',
    name: 'Demolition Crew',
    icon: '✷',
    color: '#ff7a2f',
    rarity: 'uncommon',
    price: 6,
    desc: 'Explosive hits x(1 + 0.2 per Explosive weapon). Blasts +12% size per Explosive weapon.',
    synergy: ['explosive'],
    flags: { explosiveArea: 0.12 },
    dmg: (ev, api) => (ev.tags.includes('explosive') ? { mult: 1 + 0.2 * api.tagCount('explosive') } : undefined),
  },
  {
    id: 'hive_mind',
    name: 'Hive Mind',
    icon: '✦',
    color: '#4fc3ff',
    rarity: 'uncommon',
    price: 6,
    desc: 'Orbit hits x1.6.',
    synergy: ['orbit'],
    dmg: (ev) => (ev.tags.includes('orbit') ? { mult: 1.6 } : undefined),
  },
  {
    id: 'static_cling',
    name: 'Static Cling',
    icon: 'ϟ',
    color: '#ffe14d',
    rarity: 'common',
    price: 5,
    desc: 'Shocked enemies take x1.5 damage instead of x1.2. Shock lasts 1s longer.',
    synergy: ['shock'],
    flags: { shockMult: 0.3, shockTime: 1 },
  },
  {
    id: 'pyromaniac',
    name: 'Pyromaniac',
    icon: '♨',
    color: '#ff5e3a',
    rarity: 'common',
    price: 5,
    desc: 'Projectile hits set enemies on fire.',
    synergy: ['projectile', 'fire'],
    onHit: (ev, api) => {
      if (ev.tags.includes('projectile')) api.ignite(ev.e, 6);
    },
  },
  {
    id: 'kindling',
    name: 'Kindling',
    icon: '☄',
    color: '#ff9f3d',
    rarity: 'common',
    price: 4,
    desc: 'Burning enemies take x1.4 damage.',
    synergy: ['fire'],
    dmg: (ev) => (ev.e.burnT > 0 ? { mult: 1.4 } : undefined),
  },
  {
    id: 'cold_snap',
    name: 'Cold Snap',
    icon: '❄',
    color: '#9fe8ff',
    rarity: 'uncommon',
    price: 6,
    desc: 'Hits on Frozen enemies x2.',
    synergy: ['frost'],
    dmg: (ev) => (ev.e.frozen > 0 ? { mult: 2 } : undefined),
  },
  {
    id: 'lightning_rod',
    name: 'Lightning Rod',
    icon: '↯',
    color: '#fff35c',
    rarity: 'uncommon',
    price: 7,
    desc: 'Chain weapons jump +2 more times. Chain hits +6.',
    synergy: ['chain', 'shock'],
    flags: { chainBonus: 2 },
    dmg: (ev) => (ev.tags.includes('chain') ? { add: 6 } : undefined),
  },
  {
    id: 'conductor',
    name: 'Conductor',
    icon: '☇',
    color: '#ffb627',
    rarity: 'uncommon',
    price: 6,
    desc: 'Fire hits also Shock and Shock hits also Burn. (Burn + Shock = Overload blast.)',
    synergy: ['fire', 'shock'],
    onHit: (ev, api) => {
      if (ev.tags.includes('fire')) api.shock(ev.e);
      else if (ev.tags.includes('shock')) api.ignite(ev.e, 5);
    },
  },
  {
    id: 'shatterpoint',
    name: 'Shatterpoint',
    icon: '✦',
    color: '#c8f4ff',
    rarity: 'uncommon',
    price: 6,
    desc: 'Frozen enemies shatter into shards for x3 damage when killed.',
    synergy: ['frost'],
    flags: { shatterMult: 2 },
  },
  {
    id: 'overloader',
    name: 'Overloader',
    icon: '☢',
    color: '#ffe14d',
    rarity: 'uncommon',
    price: 6,
    desc: 'Overload blasts deal x3 damage and are bigger.',
    synergy: ['fire', 'shock'],
    flags: { overloadMult: 2 },
  },
  {
    id: 'specialist',
    name: 'Specialist',
    icon: '◎',
    color: '#ff3df0',
    rarity: 'rare',
    price: 9,
    desc: 'Weapons with your most common tag deal x1.75.',
    dmg: (ev, api) => {
      const t = api.topTag();
      return t && ev.tags.includes(t) ? { mult: 1.75 } : undefined;
    },
    readout: (api) => (api.topTag() ? api.topTag()!.toUpperCase() : '-'),
  },
  {
    id: 'generalist',
    name: 'Generalist',
    icon: '✱',
    color: '#7dffb0',
    rarity: 'common',
    price: 4,
    desc: 'Every hit +3 for each different tag you own.',
    dmg: (_ev, api) => ({ add: 3 * api.distinctTags() }),
    readout: (api) => `+${3 * api.distinctTags()}`,
  },

  // ---------------------------------------------------------------- triggers
  {
    id: 'hair_trigger',
    name: 'Hair Trigger',
    icon: '☢',
    color: '#ffd23f',
    rarity: 'common',
    price: 5,
    desc: 'Every 8th left-click shot is a MEGA shot: x4 damage, huge, pierces 5.',
    synergy: ['projectile'],
    flags: { busterMegaEvery: 8 },
  },
  {
    id: 'afterburner',
    name: 'Afterburner',
    icon: '☄',
    color: '#ff7a2f',
    rarity: 'common',
    price: 5,
    desc: 'Dashing leaves a fiery explosion behind you.',
    synergy: ['explosive', 'fire'],
    onDash: (api) => api.blast(api.player.x, api.player.z, 2.8, 45, '#ff7a2f', 'afterburner', ['explosive', 'fire']),
  },
  {
    id: 'adrenaline',
    name: 'Adrenaline',
    icon: '!',
    color: '#ff3d5a',
    rarity: 'common',
    price: 4,
    desc: 'After you get hit, weapons recharge twice as fast for 4s.',
    onHurt: (_api, st) => {
      st.t = 4;
    },
    tick: (dt, _api, st) => {
      st.t = Math.max(0, st.t - dt);
    },
    live: (s, _api, st) => {
      if (st.t > 0) s.cooldownMul *= 0.5;
    },
    readout: (_api, st) => (st.t > 0 ? 'ACTIVE' : ''),
  },
  {
    id: 'bloodlust',
    name: 'Bloodlust',
    icon: '☠',
    color: '#b5384a',
    rarity: 'uncommon',
    price: 6,
    desc: 'Each kill: +3% damage (max x2.8). Stacks drain when you stop killing.',
    onKill: (_e, _s, _api, st) => {
      st.n = Math.min(60, st.n + 1);
      st.t = 1.2;
    },
    tick: (dt, _api, st) => {
      st.t -= dt;
      if (st.t <= 0) st.n = Math.max(0, st.n - 25 * dt);
    },
    dmg: (_ev, _api, st) => ({ mult: 1 + 0.03 * Math.floor(st.n) }),
    readout: (_api, st) => `x${(1 + 0.03 * Math.floor(st.n)).toFixed(2)}`,
  },
  {
    id: 'sniper',
    name: 'Sniper Scope',
    icon: '⌖',
    color: '#ffd23f',
    rarity: 'common',
    price: 5,
    desc: 'Projectile hits on enemies more than 8m away x2.',
    synergy: ['projectile'],
    dmg: (ev) => (ev.tags.includes('projectile') && ev.dist > 8 ? { mult: 2 } : undefined),
  },
  {
    id: 'brawler',
    name: 'Brawler',
    icon: '✊',
    color: '#ff9f3d',
    rarity: 'common',
    price: 5,
    desc: 'Hits on enemies within 3.5m x1.6.',
    synergy: ['orbit', 'area'],
    dmg: (ev) => (ev.dist < 3.5 ? { mult: 1.6 } : undefined),
  },
  {
    id: 'turret_mode',
    name: 'Turret Mode',
    icon: '■',
    color: '#8a90c8',
    rarity: 'uncommon',
    price: 6,
    desc: 'While standing still, everything deals x1.8.',
    dmg: (_ev, api) => (api.moving ? undefined : { mult: 1.8 }),
    readout: (api) => (api.moving ? '' : 'ACTIVE'),
  },
  {
    id: 'runners_high',
    name: "Runner's High",
    icon: '→',
    color: '#3de0c8',
    rarity: 'common',
    price: 4,
    desc: 'While moving, weapons recharge 25% faster.',
    synergy: ['trail'],
    live: (s, api) => {
      if (api.moving) s.cooldownMul *= 0.75;
    },
  },
  {
    id: 'chain_reaction',
    name: 'Chain Reaction',
    icon: '✵',
    color: '#ff7a2f',
    rarity: 'uncommon',
    price: 7,
    desc: 'Kills have a 15% chance to explode (Explosive), which can kill more.',
    synergy: ['explosive'],
    onKill: (e, _s, api) => {
      if (api.chance(0.15)) api.blast(e.x, e.z, 2.4, 30, '#ffb627', 'chain_reaction', ['explosive']);
    },
  },
  {
    id: 'crit_cascade',
    name: 'Crit Cascade',
    icon: '★',
    color: '#fff35c',
    rarity: 'uncommon',
    price: 6,
    desc: 'Critical hits arc lightning to 2 nearby enemies (Chain, Shock).',
    synergy: ['chain', 'shock'],
    onCrit: (ev, api) => api.zap(ev.e, 2, 20),
  },

  // ---------------------------------------------------------------- scaling
  {
    id: 'hoarder',
    name: 'Hoarder',
    icon: '◆',
    color: '#4fc3ff',
    rarity: 'uncommon',
    price: 6,
    desc: 'Every hit +1 per 40 XP collected since you bought this. Resets when you get hit.',
    onGem: (v, _api, st) => {
      st.n += v;
    },
    onHurt: (_api, st) => {
      st.n = 0;
    },
    dmg: (_ev, _api, st) => ({ add: Math.floor(st.n / 40) }),
    readout: (_api, st) => `+${Math.floor(st.n / 40)}`,
  },
  {
    id: 'momentum',
    name: 'Momentum',
    icon: '↑',
    color: '#7dffb0',
    rarity: 'rare',
    price: 8,
    desc: 'x0.05 more damage for each level gained after buying this.',
    onLevelUp: (_api, st) => {
      st.n++;
    },
    dmg: (_ev, _api, st) => ({ mult: 1 + 0.05 * st.n }),
    readout: (_api, st) => `x${(1 + 0.05 * st.n).toFixed(2)}`,
  },
  {
    id: 'collector',
    name: 'Collector',
    icon: '●',
    color: '#ffd23f',
    rarity: 'uncommon',
    price: 6,
    desc: 'x0.02 more damage per gold you are holding.',
    dmg: (_ev, api) => ({ mult: 1 + 0.02 * api.gold }),
    readout: (api) => `x${(1 + 0.02 * api.gold).toFixed(2)}`,
  },
  {
    id: 'echo',
    name: 'Echo',
    icon: '⇉',
    color: '#ff3df0',
    rarity: 'legendary',
    price: 10,
    desc: 'Copies the Mod in the slot to its right.',
    echo: true,
  },

  // ---------------------------------------------------------------- economy
  {
    id: 'piggy_bank',
    name: 'Piggy Bank',
    icon: '¢',
    color: '#ff7eb6',
    rarity: 'common',
    price: 4,
    desc: 'Interest cap +5 gold (earn up to 10 interest per stage).',
    flags: { interestCap: 5 },
  },
  {
    id: 'coupon',
    name: 'Coupon Book',
    icon: '%',
    color: '#7dffb0',
    rarity: 'common',
    price: 4,
    desc: 'Shop prices -25%. First reroll in each shop is free.',
    flags: { shopDiscount: 0.25, freeRerolls: 1 },
  },

  {
    id: 'bounty_hunter',
    name: 'Bounty Hunter',
    icon: '⚑',
    color: '#ffb627',
    rarity: 'common',
    price: 4,
    desc: 'Elites pay 4 gold. Bosses pay 15.',
    onKill: (e, _s, api) => {
      if (e.def.boss) api.addGold(15);
      else if (e.elite) api.addGold(4);
    },
  },
  {
    id: 'tip_jar',
    name: 'Tip Jar',
    icon: '♪',
    color: '#ffd23f',
    rarity: 'common',
    price: 3,
    desc: '+1 gold every time you level up.',
    onLevelUp: (api) => api.addGold(1),
  },
  {
    id: 'lucky_coin',
    name: 'Lucky Coin',
    icon: '✪',
    color: '#ffe14d',
    rarity: 'uncommon',
    price: 5,
    desc: 'Kills have a 1% chance to pay 1 gold.',
    onKill: (_e, _s, api) => {
      if (api.chance(0.01)) api.addGold(1);
    },
  },
  {
    id: 'investor',
    name: 'Investor',
    icon: '↗',
    color: '#4fd36a',
    rarity: 'uncommon',
    price: 6,
    desc: 'Interest pays 1 gold per 3 held instead of per 5.',
    flags: { interestPer: 2 },
  },
  {
    id: 'golden_ticket',
    name: 'Golden Ticket',
    icon: '▤',
    color: '#ffb627',
    rarity: 'uncommon',
    price: 5,
    desc: 'Stage clear: +3 gold for each empty Mod slot.',
    onStageClear: (api) => api.addGold(3 * api.freeSlots),
    readout: (api) => `+${3 * api.freeSlots}`,
  },
  {
    id: 'pawn_shop',
    name: 'Pawn Shop',
    icon: '⇄',
    color: '#c8a2ff',
    rarity: 'common',
    price: 3,
    desc: 'Mods sell back for their full price.',
    flags: { sellFull: true },
  },
  {
    id: 'gold_plating',
    name: 'Gold Plating',
    icon: '⛨',
    color: '#ffd23f',
    rarity: 'uncommon',
    price: 6,
    desc: '+1 armor for every 8 gold you hold (max +5).',
    live: (s, api) => {
      s.armor += Math.min(5, Math.floor(api.gold / 8));
    },
    readout: (api) => `+${Math.min(5, Math.floor(api.gold / 8))}`,
  },

  // ---------------------------------------------------------------- charge shot (hold right mouse / X)
  {
    id: 'quick_draw',
    name: 'Quick Draw',
    icon: '⚡',
    color: '#7df9ff',
    rarity: 'common',
    price: 4,
    desc: 'Right click charges 50% faster (right-click weapons reload 50% faster).',
    synergy: ['projectile'],
    flags: { chargeSpeed: 0.5 },
  },
  {
    id: 'patience',
    name: 'Patience',
    icon: '⌛',
    color: '#3dffb0',
    rarity: 'common',
    price: 5,
    desc: 'Right-click attacks deal x1.8.',
    synergy: ['projectile'],
    dmg: (ev) => (isRightClick(ev.source) ? { mult: 1.8 } : undefined),
  },
  {
    id: 'thunder_shot',
    name: 'Thunder Shot',
    icon: '↯',
    color: '#ffe14d',
    rarity: 'uncommon',
    price: 6,
    desc: 'Right-click hits Shock and arc lightning to 3 nearby enemies.',
    synergy: ['projectile', 'shock', 'chain'],
    onHit: (ev, api) => {
      if (!isRightClick(ev.source)) return;
      // Vortex and shield hit many times a second: only some of their hits arc.
      if ((ev.source === 'well' || ev.source === 'shield') && !api.chance(0.2)) return;
      api.shock(ev.e);
      api.zap(ev.e, 3, 22);
    },
  },
  {
    id: 'mega_buster',
    name: 'Mega Buster',
    icon: '⁂',
    color: '#3dffb0',
    rarity: 'rare',
    price: 9,
    desc: 'Full-charge shots fire 3 at once. Grenades and vortexes come in 3s; the shield gets wider.',
    synergy: ['projectile'],
    flags: { chargeSplit: 2 },
  },
  {
    id: 'overcharge',
    name: 'Overcharge',
    icon: '✺',
    color: '#ff3df0',
    rarity: 'rare',
    price: 8,
    desc: 'Keep holding past full for a second charge level: x2 damage, huge pierce and a bigger blast. Grenades and vortexes get bigger; the shield reflects bullets.',
    synergy: ['projectile', 'explosive'],
    flags: { overcharge: true },
  },

  // ---------------------------------------------------------------- legendary: build-defining, with a catch
  {
    id: 'phoenix',
    name: 'Phoenix Plume',
    icon: '♆',
    color: '#ef7d57',
    rarity: 'legendary',
    price: 12,
    desc: 'Once per stage, lethal damage instead brings you back at full life in a huge fire nova (Fire, Explosive).',
    synergy: ['fire', 'explosive'],
    // Runs before the game checks for death, so the hero never goes down.
    onHurt: (api, st) => {
      const p = api.player;
      if (!p.dead || st.n) return;
      st.n = 1;
      p.dead = false;
      p.hp = p.maxHp;
      p.invuln = 2;
      p.rig.root.visible = true;
      api.blast(p.x, p.z, 7, 120 + 8 * api.level, '#ef7d57', 'phoenix', ['fire', 'explosive']);
    },
    onStageClear: (_api, st) => {
      st.n = 0;
    },
    readout: (_api, st) => (st.n ? 'SPENT' : 'READY'),
  },
  {
    id: 'storm_crown',
    name: 'Storm Crown',
    icon: '♛',
    color: '#73eff7',
    rarity: 'legendary',
    price: 12,
    desc: 'Every 20th kill calls a storm: lightning chains through 10 enemies (+3 per Chain weapon) and a thunderclap Shocks everything near the kill.',
    synergy: ['chain', 'shock'],
    onKill: (e, _s, api, st) => {
      if (++st.n < 20) return;
      st.n = 0;
      const dmg = 40 + 3 * api.level;
      api.zap(e, 10 + 3 * api.tagCount('chain'), dmg);
      api.blast(e.x, e.z, 3.5, dmg, '#73eff7', 'storm_crown', ['shock', 'chain']);
    },
    readout: (_api, st) => `${st.n}/20`,
  },
  {
    id: 'supernova',
    name: 'Supernova',
    icon: '✹',
    color: '#f4f4f4',
    rarity: 'legendary',
    price: 13,
    desc: '+10% crit chance. Critical hits explode in a fiery blast (Explosive, Fire). Every other hit deals x0.8.',
    synergy: ['explosive', 'fire'],
    stat: (s) => {
      s.critChance += 0.1;
    },
    dmg: (ev) => (ev.crit || ev.source === 'supernova' ? undefined : { mult: 0.8 }),
    onCrit: (ev, api, st) => {
      // Fast multi-hit weapons crit many times a second: at most ~8 blasts/s.
      // Its own blasts never chain into more blasts.
      if (ev.source === 'supernova' || st.t > 0) return;
      st.t = 0.12;
      api.blast(ev.e.x, ev.e.z, 2.4, 25 + 3 * api.level, '#ffcd75', 'supernova', ['explosive', 'fire']);
    },
    tick: (dt, _api, st) => {
      st.t -= dt;
    },
  },
  {
    id: 'midas',
    name: 'Midas Touch',
    icon: '♔',
    color: '#ffcd75',
    rarity: 'legendary',
    price: 11,
    desc: 'Every hit x(1 + 0.04 per gold you hold). Kills have a 1% chance to pay 1 gold. Shop prices +50%.',
    flags: { shopDiscount: -0.5 },
    dmg: (_ev, api) => ({ mult: 1 + 0.04 * api.gold }),
    onKill: (_e, _s, api) => {
      if (api.chance(0.01)) api.addGold(1);
    },
    readout: (api) => `x${(1 + 0.04 * api.gold).toFixed(2)}`,
  },

  // ---------------------------------------------------------------- cursed: big upside, real cost
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    icon: '◇',
    color: '#c8f4ff',
    rarity: 'uncommon',
    price: 5,
    cursed: true,
    desc: 'x1.6 damage. Max life x0.4.',
    stat: (s) => {
      s.damageMul *= 1.6;
      s.maxHp *= 0.4;
    },
  },
  {
    id: 'pacifist',
    name: 'Pacifist Core',
    icon: '☮',
    color: '#9b6bff',
    rarity: 'uncommon',
    price: 5,
    cursed: true,
    desc: 'Your arm cannon stops firing (left and right click). Every other weapon x1.6 and recharges 20% faster.',
    flags: { busterDisabled: true },
    stat: (s) => {
      s.cooldownMul *= 0.8;
    },
    dmg: (ev) => (ev.source !== 'buster' ? { mult: 1.6 } : undefined),
  },
  {
    id: 'overclock',
    name: 'Overclocked Heart',
    icon: '♥',
    color: '#ff3d5a',
    rarity: 'legendary',
    price: 7,
    cursed: true,
    desc: 'Weapons recharge 40% faster. You lose 1.5 life per second.',
    stat: (s) => {
      s.cooldownMul *= 0.6;
    },
    tick: (dt, api) => {
      const p = api.player;
      if (!p.dead && p.hp > 1) p.hp = Math.max(1, p.hp - 1.5 * dt);
    },
  },
  {
    id: 'gremlin',
    name: 'Greedy Gremlin',
    icon: '$',
    color: '#ffb627',
    rarity: 'common',
    price: 3,
    cursed: true,
    desc: '+75% gold. Enemies have +30% life.',
    flags: { goldMul: 0.75, enemyHp: 0.3 },
  },
];

export const MOD_BY_ID: Record<string, ModDef> = Object.fromEntries(MODS.map((m) => [m.id, m]));

export const MOD_RARITY_WEIGHT = { common: 60, uncommon: 32, rare: 10, legendary: 3 };
