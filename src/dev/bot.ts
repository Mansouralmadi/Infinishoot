import * as THREE from 'three';
import type { Input } from '../core/input';
import { cheats, type Game } from '../game/game';
import { Team } from '../game/bullets';

/**
 * Dev-only autoplay bot for balance and performance testing. Installed on
 * `window` in dev builds:
 *   botRun(seconds, god?)  -> simulate that many seconds headlessly, returns a report
 *   botStep()              -> one simulation step with bot input
 * The bot kites in a circle, dodges enemy bullets, shoots the boss (or the
 * nearest enemy), dashes when cornered and always picks the first card.
 */
export function installBot(game: Game, input: Input): void {
  const v = new THREE.Vector3();
  // Input internals are private; the bot drives them directly.
  const inp = input as unknown as {
    keys: Set<string>;
    pressed: Set<string>;
    mouseButtons: number;
    mouse: { ndcX: number; ndcY: number };
    device: string;
    poll(): void;
  };

  /** Shop policy: buy affordable Mods left to right while slots remain, then continue. */
  const shop = () => {
    // Buying re-renders the offers, so look the buttons up again after each buy. Skips cursed Mods (Pacifist Core stalls a Buster-only bot).
    for (let k = 0; k < 5; k++) {
      const b = document.querySelector<HTMLElement>('#scr-shop [data-act=buy]:not(.cant):not(.cursed)');
      if (!b) break;
      b.click();
    }
    document.querySelector<HTMLElement>('#scr-shop [data-act=shop-done]')?.click();
  };

  const step = () => {
    const g = game;
    const p = g.player;
    inp.keys.clear();
    let best = null as null | { x: number; z: number };
    let bd = 1e9;
    let ax = 0;
    let az = 0;
    for (const e of g.enemies.list) {
      if (!e.alive) continue;
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const d = Math.hypot(dx, dz);
      if (d < bd) {
        bd = d;
        best = e;
      }
      if (d < 3.5) {
        ax += dx / (d * d + 0.1);
        az += dz / (d * d + 0.1);
      }
    }
    for (let i = 0; i < g.bullets.count; i++) {
      if (g.bullets.team[i] !== Team.Enemy) continue;
      const dx = p.x - g.bullets.x[i];
      const dz = p.z - g.bullets.z[i];
      const d = Math.hypot(dx, dz);
      if (d < 3) {
        ax += (dx / (d * d + 0.1)) * 2;
        az += (dz / (d * d + 0.1)) * 2;
      }
    }
    const boss = g.enemies.list.find((e) => e.active && e.def.boss);
    let mx: number;
    let mz: number;
    if (g.mode === 'portal') {
      mx = g.portal.x - p.x;
      mz = g.portal.z - p.z;
    } else if (boss) {
      // Circle the boss at a safe-ish distance.
      const dx = p.x - boss.x;
      const dz = p.z - boss.z;
      const d = Math.hypot(dx, dz) || 1;
      const want = (8 - d) * 0.3;
      mx = -dz / d + (dx / d) * want + ax * 3;
      mz = dx / d + (dz / d) * want + az * 3;
      best = boss;
    } else {
      // Orbit the field centre, pushed away from nearby threats.
      const r = Math.hypot(p.x, p.z) || 1;
      const radial = (14 - r) * 0.08;
      mx = -p.z / r + (p.x / r) * radial + ax * 3;
      mz = p.x / r + (p.z / r) * radial + az * 3;
    }
    const l = Math.hypot(mx, mz) || 1;
    if (Math.abs(mx / l) > 0.3) inp.keys.add(mx > 0 ? 'KeyD' : 'KeyA');
    if (Math.abs(mz / l) > 0.3) inp.keys.add(mz > 0 ? 'KeyS' : 'KeyW');
    if (best) {
      v.set(best.x, 1.05, best.z).project(g.cam.camera);
      inp.mouse.ndcX = v.x;
      inp.mouse.ndcY = v.y;
    }
    inp.mouseButtons = best ? 1 : 0;
    if (bd < 1.3 && p.dashReady01 >= 1) inp.pressed.add('Space');
    if (g.hero.bombCharge >= 1 && Math.hypot(ax, az) > 1) inp.pressed.add('KeyQ');
    // The bot picks the first card straight away (it skips the human pick lock).
    if (g.mode === 'levelup' && g.hero.needsPick) (g as unknown as { ui(a: string, i: number): void }).ui('pick', 0);
    if (g.mode === 'shop') shop();
    inp.poll();
    inp.device = 'kbm';
    g.update(1 / 60);
  };

  const run = (seconds: number, god = false) => {
    cheats.god = god;
    const g = game;
    const n = Math.round(seconds * 60);
    let total = 0;
    let worst = 0;
    let maxAlive = 0;
    let ran = 0;
    const log: string[] = [];
    for (let i = 0; i < n && g.mode !== 'dead' && g.mode !== 'title'; i++) {
      const t = performance.now();
      step();
      ran++;
      const d = performance.now() - t;
      total += d;
      if (i > 60) worst = Math.max(worst, d);
      maxAlive = Math.max(maxAlive, g.enemies.activeCount);
      if (i % 10 === 0) g.render(1, 1 / 6);
      if (i % 1800 === 0) log.push(`st${g.stage} t=${g.director.time.toFixed(0)} lv=${g.level} kills=${g.kills} alive=${g.enemies.activeCount} hp=${g.player.hp.toFixed(0)}`);
    }
    cheats.god = false;
    return {
      log,
      mode: g.mode,
      stage: g.stage,
      t: Math.round(g.director.time),
      level: g.level,
      kills: g.kills,
      alive: g.enemies.activeCount,
      maxAlive,
      hp: Math.round(g.player.hp),
      weapons: g.hero.weapons.map((w) => w.def.id + w.level).join(' '),
      passives: JSON.stringify(g.hero.passives),
      avgMs: (total / Math.max(1, ran)).toFixed(2),
      worstMs: worst.toFixed(1),
    };
  };

  Object.assign(window, { botStep: step, botRun: run });
}
