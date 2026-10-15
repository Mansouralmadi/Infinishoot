import type { BiomeDef } from '../data/biomes';
import { retroGlobals } from './retroMaterial';

/** Set the shared light and fog uniforms for a biome (every retro material follows). */
export function applyBiomeLook(b: BiomeDef): void {
  retroGlobals.uSunColor.value.setRGB(...b.light.sun);
  retroGlobals.uSkyColor.value.setRGB(...b.light.sky);
  retroGlobals.uGroundColor.value.setRGB(...b.light.ground);
  retroGlobals.uFogColor.value.set(b.fog);
}
