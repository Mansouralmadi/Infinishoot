/**
 * Weapon tags. Mods key off tags ("Explosive weapons deal more per Explosive
 * weapon you own"), so a build becomes a set of themes that feed each other.
 */
export type Tag = 'projectile' | 'orbit' | 'area' | 'chain' | 'explosive' | 'fire' | 'frost' | 'shock' | 'trail';

export const TAGS: Record<Tag, { label: string; color: string }> = {
  projectile: { label: 'Projectile', color: '#ffd23f' },
  orbit: { label: 'Orbit', color: '#4fc3ff' },
  area: { label: 'Area', color: '#3de0c8' },
  chain: { label: 'Chain', color: '#fff35c' },
  explosive: { label: 'Explosive', color: '#ff7a2f' },
  fire: { label: 'Fire', color: '#ff5e3a' },
  frost: { label: 'Frost', color: '#9fe8ff' },
  shock: { label: 'Shock', color: '#ffe14d' },
  trail: { label: 'Trail', color: '#c4b8ff' },
};

export function tagChips(tags: readonly Tag[]): string {
  return tags.map((t) => `<span class="tag-chip" style="--c:${TAGS[t].color}">${TAGS[t].label}</span>`).join('');
}
