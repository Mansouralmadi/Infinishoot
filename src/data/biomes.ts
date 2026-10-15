import type { textures } from '../render/textures';

type TexKey = keyof typeof textures;

/**
 * Biomes cycle by stage. Each has its own ground, trail, wall and tree
 * textures, cover props, sea, light and fog, so every stage reads as a new
 * place while the layout rules stay the same.
 */
export interface BiomeDef {
  id: string;
  name: string;
  ground: TexKey;
  path: TexKey;
  /** Island rim (the cliff band around the field). */
  rim: TexKey;
  wall: TexKey;
  wallTint: string;
  capColor: string;
  pillarTint: string;
  /** Edge ring around the field (bushes, rocks, drifts). */
  edge: { tex: TexKey; colors: string[] };
  /** Tree-like cover style. */
  tree: 'round' | 'cactus' | 'pine' | 'dead';
  leaves: TexKey;
  trunk: string;
  /** Cluster mix: chance weights for ruin / crates / trees / rocks. */
  clusters: [number, number, number, number];
  rockColors: string[];
  /** Flat decoration patches (lava pools, frozen ponds); never block movement. */
  pools?: { tex: TexKey; count: number; unlit: number; scroll: [number, number] };
  sea: { tex: TexKey; unlit: number; scroll: [number, number] };
  light: { sun: [number, number, number]; sky: [number, number, number]; ground: [number, number, number] };
  fog: string;
}

export const BIOMES: BiomeDef[] = [
  {
    id: 'meadow',
    name: 'Bright Meadow',
    ground: 'grass',
    path: 'path',
    rim: 'sand',
    wall: 'brick',
    wallTint: '#ffffff',
    capColor: '#fff4c9',
    pillarTint: '#ffd6f0',
    edge: { tex: 'leaves', colors: ['#4fd36a', '#3fbf5a', '#6ee07a', '#38b06a'] },
    tree: 'round',
    leaves: 'leaves',
    trunk: '#a86a3c',
    clusters: [0.35, 0.3, 0.35, 0],
    rockColors: ['#c4b8ff'],
    sea: { tex: 'water', unlit: 0.35, scroll: [0.05, 0.03] },
    light: { sun: [0.72, 0.66, 0.52], sky: [0.5, 0.56, 0.78], ground: [0.36, 0.3, 0.4] },
    fog: '#9fd8ff',
  },
  {
    id: 'dunes',
    name: 'Sunset Dunes',
    ground: 'dunes',
    path: 'clay',
    rim: 'sandstone',
    wall: 'sandstone',
    wallTint: '#ffffff',
    capColor: '#ffe9c4',
    pillarTint: '#ffd0a8',
    edge: { tex: 'sandstone', colors: ['#ffb36b', '#ff9f5a', '#ffc98a'] },
    tree: 'cactus',
    leaves: 'cactus',
    trunk: '#3fbf6a',
    clusters: [0.35, 0.2, 0.25, 0.2],
    rockColors: ['#ff9f5a', '#e8803f', '#ffb36b'],
    sea: { tex: 'water', unlit: 0.45, scroll: [0.04, 0.02] },
    light: { sun: [0.78, 0.68, 0.54], sky: [0.58, 0.52, 0.62], ground: [0.42, 0.32, 0.34] },
    fog: '#ffc58f',
  },
  {
    id: 'peaks',
    name: 'Frosty Peaks',
    ground: 'snow',
    path: 'ice',
    rim: 'iceBrick',
    wall: 'iceBrick',
    wallTint: '#ffffff',
    capColor: '#ffffff',
    pillarTint: '#d8f0ff',
    edge: { tex: 'snow', colors: ['#ffffff', '#e6f2ff', '#d4e8ff'] },
    tree: 'pine',
    leaves: 'pine',
    trunk: '#8a5a3c',
    clusters: [0.25, 0.25, 0.4, 0.1],
    rockColors: ['#9fc8f0', '#bfe0ff', '#8ab4e8'],
    pools: { tex: 'ice', count: 7, unlit: 0.3, scroll: [0, 0] },
    sea: { tex: 'ice', unlit: 0.3, scroll: [0.01, 0.005] },
    light: { sun: [0.58, 0.6, 0.66], sky: [0.5, 0.58, 0.8], ground: [0.38, 0.42, 0.56] },
    fog: '#cfe8ff',
  },
  {
    id: 'magma',
    name: 'Magma Isle',
    ground: 'ash',
    path: 'crust',
    rim: 'obsidian',
    wall: 'obsidian',
    wallTint: '#ffffff',
    capColor: '#ff9f3d',
    pillarTint: '#c8a2ff',
    edge: { tex: 'obsidian', colors: ['#6a4a9a', '#55407a', '#7d5aa8'] },
    tree: 'dead',
    leaves: 'obsidian',
    trunk: '#4a3358',
    clusters: [0.35, 0.15, 0.2, 0.3],
    rockColors: ['#55407a', '#6a4a9a', '#3f2d58'],
    pools: { tex: 'lava', count: 9, unlit: 1, scroll: [0.03, 0.02] },
    sea: { tex: 'lava', unlit: 1, scroll: [0.02, 0.015] },
    light: { sun: [0.9, 0.56, 0.4], sky: [0.46, 0.36, 0.62], ground: [0.56, 0.28, 0.24] },
    fog: '#b0517a',
  },
];

/** Stage 1 is the meadow; then dunes, peaks, magma, and round again. */
export function biomeForStage(stage: number): BiomeDef {
  return BIOMES[(Math.max(1, stage) - 1) % BIOMES.length];
}
