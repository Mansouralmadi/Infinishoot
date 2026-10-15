import * as THREE from 'three';
import { createRetroMaterial, type RetroMaterial } from '../render/retroMaterial';
import { textures } from '../render/textures';

/**
 * Placeholder chunky anime hero built from primitives: big head with a
 * painted face, helmet, oversized hands and boots, arm cannon. About three
 * heads tall. Faces +Z.
 */
const PALETTE = {
  armor: '#2f7bff',
  armorDark: '#1f4fc4',
  accent: '#ffd23f',
  skin: '#ffd7b0',
  suit: '#2b2f4a',
  red: '#ff3d5a',
  hair: '#5a3a22',
};

export interface HeroRig {
  root: THREE.Group;
  body: THREE.Group; // bobs / leans
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Group;
  materials: RetroMaterial[];
}

/** `armorColor` tints the suit so co-op players are easy to tell apart. */
export function createHero(armorColor: string = PALETTE.armor): HeroRig {
  const materials: RetroMaterial[] = [];
  const mat = (color: string, extra: Parameters<typeof createRetroMaterial>[0] = {}) => {
    const m = createRetroMaterial({ color, ...extra });
    materials.push(m);
    return m;
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    return o;
  };

  const armor = mat(armorColor);
  const armorDark = mat('#' + new THREE.Color(armorColor).multiplyScalar(0.68).getHexString());
  const accent = mat(PALETTE.accent);
  const skin = mat(PALETTE.skin);
  const suit = mat(PALETTE.suit);
  const red = mat(PALETTE.red);
  const hair = mat(PALETTE.hair);
  const face = mat('#ffffff', { map: textures.face(), alphaTest: 0.5 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // --- Legs (pivot at hip) ---
  const makeLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(0.2 * side, 0.62, 0);
    leg.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 6), suit, 0, -0.18, 0));
    // Big boot
    leg.add(mesh(new THREE.BoxGeometry(0.34, 0.26, 0.48), armor, 0, -0.46, 0.05));
    leg.add(mesh(new THREE.BoxGeometry(0.36, 0.08, 0.52), accent, 0, -0.58, 0.06));
    leg.add(mesh(new THREE.BoxGeometry(0.3, 0.12, 0.2), armorDark, 0, -0.3, 0.02));
    return leg;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);
  body.add(legL, legR);

  // --- Torso ---
  body.add(mesh(new THREE.BoxGeometry(0.42, 0.18, 0.3), suit, 0, 0.7, 0)); // hips
  body.add(mesh(new THREE.BoxGeometry(0.56, 0.42, 0.38), armor, 0, 0.98, 0));
  body.add(mesh(new THREE.BoxGeometry(0.3, 0.22, 0.06), accent, 0, 1.0, 0.2)); // chest plate
  body.add(mesh(new THREE.BoxGeometry(0.1, 0.08, 0.04), red, 0, 1.0, 0.24)); // gem

  // --- Arms (pivot at shoulder) ---
  const makeArm = (side: number, cannon: boolean) => {
    const arm = new THREE.Group();
    arm.position.set(0.38 * side, 1.12, 0);
    arm.add(mesh(new THREE.SphereGeometry(0.17, 7, 5), armor, 0, 0, 0)); // shoulder pad
    arm.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6), suit, 0.02 * side, -0.22, 0));
    if (cannon) {
      // Arm buster along the forearm (-Y); the arm is raised forward when aiming
      arm.add(mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.52, 8), armor, 0.04 * side, -0.42, 0));
      arm.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 8), accent, 0.04 * side, -0.64, 0));
      arm.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 8), suit, 0.04 * side, -0.69, 0));
    } else {
      arm.add(mesh(new THREE.SphereGeometry(0.15, 6, 5), armor, 0.03 * side, -0.42, 0.02)); // big glove
    }
    return arm;
  };
  const armL = makeArm(-1, false);
  const armR = makeArm(1, true);
  body.add(armL, armR);

  // --- Head (big!) ---
  const head = new THREE.Group();
  head.position.set(0, 1.5, 0);
  body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.36, 10, 8), skin));
  // Hair tuft poking out the front
  head.add(mesh(new THREE.BoxGeometry(0.5, 0.1, 0.12), hair, 0, 0.2, 0.27));
  // Helmet: upper hemisphere shell, slightly bigger than head
  const helmet = mesh(
    new THREE.SphereGeometry(0.41, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.42),
    armor,
    0,
    0.04,
    -0.02,
  );
  helmet.rotation.x = -0.25;
  head.add(helmet);
  // Back of helmet
  head.add(mesh(new THREE.SphereGeometry(0.38, 8, 6), armorDark, 0, 0.02, -0.08));
  // Ear pieces
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 8), accent, 0.37 * s, 0, 0);
    ear.rotation.z = Math.PI / 2;
    head.add(ear);
    const fin = mesh(new THREE.BoxGeometry(0.04, 0.22, 0.14), red, 0.44 * s, 0.1, -0.02);
    head.add(fin);
  }
  // Painted face decal
  const facePlane = mesh(new THREE.PlaneGeometry(0.52, 0.52), face, 0, -0.04, 0.345);
  head.add(facePlane);

  root.traverse((o) => {
    o.castShadow = false;
    o.receiveShadow = false;
  });

  return { root, body, legL, legR, armL, armR, head, materials };
}

/**
 * Procedural walk/idle animation. `speed01` = current speed / max speed,
 * `recoil01` = 1 right after a shot, decaying to 0.
 */
export function animateHero(rig: HeroRig, time: number, speed01: number, recoil01 = 0): void {
  const walk = time * 11;
  const swing = Math.sin(walk) * 0.75 * speed01;
  rig.legL.rotation.x = swing;
  rig.legR.rotation.x = -swing;
  rig.armL.rotation.x = -swing * 0.6;
  rig.armR.rotation.x = -Math.PI / 2 + 0.1 - recoil01 * 0.45; // buster arm points forward, kicks up on fire
  const bob = Math.abs(Math.sin(walk)) * 0.08 * speed01 + Math.sin(time * 2.2) * 0.015 * (1 - speed01);
  rig.body.position.y = bob;
  rig.body.rotation.x = 0.12 * speed01 - recoil01 * 0.08; // lean into run, rock back on recoil
  rig.head.rotation.z = Math.sin(walk * 0.5) * 0.05 * speed01;
}
