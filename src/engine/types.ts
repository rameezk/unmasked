export const TIERS = ['rookie', 'pro', 'legend'] as const;
export const SIDES = ['hero', 'villain'] as const;
export const UNIVERSES = ['marvel'] as const;
export const PICTURE_STYLES = ['comic', 'movie', 'cartoon'] as const;

export type Tier = (typeof TIERS)[number];
export type Side = (typeof SIDES)[number];
export type Universe = (typeof UNIVERSES)[number];
export type PictureStyle = (typeof PICTURE_STYLES)[number];

export interface Picture {
  file: string;
  style: PictureStyle;
}

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  tier: Tier;
  side: Side;
  universe: Universe;
  pictures: Picture[];
}

export type Random = () => number;
