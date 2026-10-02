export type Tier = 'rookie' | 'pro' | 'legend';
export type Side = 'hero' | 'villain';
export type Universe = 'marvel';
export type PictureStyle = 'comic' | 'movie' | 'cartoon';

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
