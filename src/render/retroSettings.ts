import { retroGlobals } from './retroMaterial';
import { postSettings } from './renderer';

/**
 * Single "Retro strength" knob (0..1) that drives all the PS1-style effects.
 * 0 = clean modern low-poly, 0.5 = default subtle, 1 = full wobbly PS1.
 * Individual values can still be overridden from the debug panel afterwards.
 */
export const retro = { strength: 0.5 };

export function applyRetroStrength(s: number): void {
  retro.strength = s;
  retroGlobals.uSnapPx.value = s; // fraction of an internal pixel
  retroGlobals.uAffine.value = s;
  postSettings.dither = s;
  postSettings.colorBits = s > 0 ? 5 : 8;
}
