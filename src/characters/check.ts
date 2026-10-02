import { normalise } from '../engine/normalise';
import { PICTURE_STYLES, SIDES, TIERS, UNIVERSES, type Character } from '../engine/types';

export function checkCharacters(
  characters: readonly Character[],
  fileExists: (file: string) => boolean,
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const owners = new Map<string, string>();

  for (const c of characters) {
    const fail = (message: string) => problems.push(`${c.id}: ${message}`);

    if (ids.has(c.id)) fail('duplicate id');
    ids.add(c.id);

    if (!c.name.trim()) fail('empty name');
    if (!(TIERS as readonly string[]).includes(c.tier)) fail(`invalid tier "${c.tier}"`);
    if (!(SIDES as readonly string[]).includes(c.side)) fail(`invalid side "${c.side}"`);
    if (!(UNIVERSES as readonly string[]).includes(c.universe))
      fail(`invalid universe "${c.universe}"`);
    if (c.pictures.length < 1 || c.pictures.length > 3) {
      fail(`has ${c.pictures.length} pictures, expected 1 to 3`);
    }
    for (const p of c.pictures) {
      if (!(PICTURE_STYLES as readonly string[]).includes(p.style))
        fail(`invalid picture style "${p.style}" for ${p.file}`);
      if (!fileExists(p.file)) fail(`missing picture file ${p.file}`);
    }

    const ownKeys = new Set<string>();
    for (const text of [c.name, ...c.aliases]) {
      const key = normalise(text);
      if (!key) {
        fail(`"${text}" normalises to nothing`);
        continue;
      }
      if (ownKeys.has(key)) continue;
      ownKeys.add(key);
      const owner = owners.get(key);
      if (owner !== undefined) fail(`"${text}" clashes with ${owner}`);
      else owners.set(key, c.id);
    }
  }
  return problems;
}
