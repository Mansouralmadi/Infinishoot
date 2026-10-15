import type * as THREE from 'three';
import { WEAPONS } from '../../data/weapons';
import { Aura } from './aura';
import type { Weapon } from './base';
import { Buster } from './buster';
import { Discs } from './discs';
import { Drones } from './drones';
import { Fire } from './fire';
import { Lightning } from './lightning';
import { Mines } from './mines';
import { Missiles } from './missiles';
import { Nova } from './nova';

export { Weapon } from './base';
export type { WeaponCtx, DamageOpts } from './base';
export { Buster } from './buster';

/** Create a weapon instance by id. */
export function createWeapon(id: string, scene: THREE.Scene): Weapon {
  const def = WEAPONS[id];
  switch (id) {
    case 'buster':
      return new Buster(def);
    case 'drones':
      return new Drones(def, scene);
    case 'aura':
      return new Aura(def, scene);
    case 'lightning':
      return new Lightning(def, scene);
    case 'discs':
      return new Discs(def, scene);
    case 'missiles':
      return new Missiles(def, scene);
    case 'mines':
      return new Mines(def, scene);
    case 'nova':
      return new Nova(def);
    case 'fire':
      return new Fire(def, scene);
    default:
      throw new Error(`Unknown weapon: ${id}`);
  }
}
