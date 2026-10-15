import { loadJson, saveJson } from '../core/storage';
import { ACHIEVEMENTS, WORKSHOP, workshopCost } from '../data/meta';
import { WEAPONS } from '../data/weapons';

/**
 * Persistent profile: Bolts, Workshop levels, unlocks, lifetime stats.
 * Stored in localStorage automatically; can be exported as a text code for
 * backup or moving to another browser/device.
 */
export interface SaveData {
  version: number;
  bolts: number;
  workshop: Record<string, number>;
  achievements: string[];
  lifetime: {
    runs: number;
    kills: number;
    elites: number;
    bosses: number;
    bestStage: number;
    bestLevel: number;
    boltsEarned: number;
    playTime: number;
  };
}

const KEY = 'save';
const VERSION = 1;
const CODE_PREFIX = 'ISAVE1:';

function fresh(): SaveData {
  return {
    version: VERSION,
    bolts: 0,
    workshop: {},
    achievements: [],
    lifetime: { runs: 0, kills: 0, elites: 0, bosses: 0, bestStage: 0, bestLevel: 0, boltsEarned: 0, playTime: 0 },
  };
}

/** Fill missing fields so older or partial saves keep working. */
function normalize(raw: unknown): SaveData {
  const d = fresh();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData>;
  if (typeof r.bolts === 'number' && r.bolts >= 0) d.bolts = Math.floor(r.bolts);
  if (r.workshop && typeof r.workshop === 'object') {
    for (const item of WORKSHOP) {
      const lv = Number((r.workshop as Record<string, unknown>)[item.id]);
      if (lv > 0) d.workshop[item.id] = Math.min(item.maxLevel, Math.floor(lv));
    }
  }
  if (Array.isArray(r.achievements)) {
    d.achievements = r.achievements.filter((a) => ACHIEVEMENTS.some((x) => x.id === a));
  }
  if (r.lifetime && typeof r.lifetime === 'object') {
    for (const k of Object.keys(d.lifetime) as (keyof SaveData['lifetime'])[]) {
      const v = Number((r.lifetime as Record<string, unknown>)[k]);
      if (Number.isFinite(v) && v >= 0) d.lifetime[k] = v;
    }
  }
  return d;
}

export const save: SaveData = normalize(loadJson<unknown>(KEY, null));

export function persist(): void {
  saveJson(KEY, save);
}

export function unlockedWeapons(): string[] {
  const ids = Object.values(WEAPONS)
    .filter((w) => w.starter)
    .map((w) => w.id);
  for (const a of ACHIEVEMENTS) if (a.unlockWeapon && save.achievements.includes(a.id)) ids.push(a.unlockWeapon);
  return ids;
}

/** Buy the next Workshop level. Returns false if unaffordable or maxed. */
export function buyWorkshop(id: string): boolean {
  const item = WORKSHOP.find((w) => w.id === id);
  if (!item) return false;
  const lv = save.workshop[id] ?? 0;
  if (lv >= item.maxLevel) return false;
  const cost = workshopCost(item, lv);
  if (save.bolts < cost) return false;
  save.bolts -= cost;
  save.workshop[id] = lv + 1;
  persist();
  return true;
}

/** Refund everything spent in the Workshop. */
export function refundWorkshop(): number {
  let refund = 0;
  for (const item of WORKSHOP) {
    const lv = save.workshop[item.id] ?? 0;
    for (let i = 0; i < lv; i++) refund += workshopCost(item, i);
  }
  save.workshop = {};
  save.bolts += refund;
  persist();
  return refund;
}

/** Grant an achievement once. Returns its def if newly earned. */
export function grantAchievement(id: string) {
  if (save.achievements.includes(id)) return null;
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) return null;
  save.achievements.push(id);
  save.bolts += def.bolts;
  persist();
  return def;
}

// ---------------------------------------------------------------- export / import

function checksum(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function exportCode(): string {
  const json = JSON.stringify(save);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return `${CODE_PREFIX}${b64}.${checksum(b64)}`;
}

/** Replace the save with an exported code. Throws a readable error if invalid. */
export function importCode(code: string): void {
  const c = code.trim();
  if (!c.startsWith(CODE_PREFIX)) throw new Error('That is not an InfiniShoot save code.');
  const [b64, sum] = c.slice(CODE_PREFIX.length).split('.');
  if (!b64 || checksum(b64) !== sum) throw new Error('The save code is damaged or incomplete.');
  let parsed: unknown;
  try {
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('The save code could not be read.');
  }
  Object.assign(save, normalize(parsed));
  persist();
}

export function resetSave(): void {
  Object.assign(save, fresh());
  persist();
}
