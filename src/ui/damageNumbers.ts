import * as THREE from 'three';

/**
 * Pooled floating damage numbers as HTML elements projected from world space.
 * Pop in, float up, fade out.
 */
const MAX = 48;
const LIFE = 0.7;

interface Num {
  el: HTMLDivElement;
  x: number;
  y: number;
  z: number;
  t: number;
  active: boolean;
}

export class DamageNumbers {
  private pool: Num[] = [];
  private next = 0;
  private v = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    for (let i = 0; i < MAX; i++) {
      const el = document.createElement('div');
      el.className = 'dmg';
      el.style.display = 'none';
      parent.appendChild(el);
      this.pool.push({ el, x: 0, y: 0, z: 0, t: 0, active: false });
    }
  }

  spawn(x: number, y: number, z: number, value: number | string, kind: 'hit' | 'crit' | 'player' | 'heal' | 'score' = 'hit'): void {
    const n = this.pool[this.next];
    this.next = (this.next + 1) % MAX; // overwrite oldest when full
    n.x = x + (Math.random() - 0.5) * 0.4;
    n.y = y;
    n.z = z + (Math.random() - 0.5) * 0.4;
    n.t = 0;
    n.active = true;
    n.el.textContent = String(value);
    n.el.className = `dmg dmg-${kind}`;
    n.el.style.display = '';
  }

  clear(): void {
    for (const n of this.pool) {
      n.active = false;
      n.el.style.display = 'none';
    }
  }

  render(frameDt: number, camera: THREE.Camera): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const n of this.pool) {
      if (!n.active) continue;
      n.t += frameDt;
      if (n.t >= LIFE) {
        n.active = false;
        n.el.style.display = 'none';
        continue;
      }
      const k = n.t / LIFE;
      this.v.set(n.x, n.y + k * 1.2, n.z).project(camera);
      const sx = ((this.v.x + 1) / 2) * w;
      const sy = ((1 - this.v.y) / 2) * h;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.8 : 1.4 - Math.min(0.4, (k - 0.15) * 2);
      n.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${pop})`;
      n.el.style.opacity = String(k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
    }
  }
}
