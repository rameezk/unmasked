import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Character } from '../engine/types';
import { characters } from './characters';
import { checkCharacters } from './check';
import { startRound } from '../engine/round';
import { TIERS } from '../engine/types';

const publicDir = resolve(import.meta.dirname, '../../public');
const fileExists = (file: string) => existsSync(resolve(publicDir, file));

const valid: Character = {
  id: 'spider-man',
  name: 'Spider-Man',
  aliases: ['spidey'],
  tier: 'rookie',
  side: 'hero',
  universe: 'marvel',
  pictures: [{ file: 'pictures/spider-man-1.svg', style: 'comic' }],
};

const other: Character = {
  ...valid,
  id: 'thor',
  name: 'Thor',
  aliases: [],
  pictures: [{ file: 'pictures/thor-1.svg', style: 'movie' }],
};

const allExist = () => true;

describe('the shipped character list', () => {
  it('passes every check', () => {
    expect(checkCharacters(characters, fileExists)).toEqual([]);
  });

  it('has about 100 Characters', () => {
    expect(characters.length).toBeGreaterThanOrEqual(95);
    expect(characters.length).toBeLessThanOrEqual(105);
  });

  it('is roughly 40 Rookie, 40 Pro and 20 Legend', () => {
    const count = (tier: string) => characters.filter((c) => c.tier === tier).length;
    expect(count('rookie')).toBeGreaterThanOrEqual(36);
    expect(count('rookie')).toBeLessThanOrEqual(44);
    expect(count('pro')).toBeGreaterThanOrEqual(36);
    expect(count('pro')).toBeLessThanOrEqual(44);
    expect(count('legend')).toBeGreaterThanOrEqual(18);
    expect(count('legend')).toBeLessThanOrEqual(22);
  });

  it('balances heroes and villains within each Tier', () => {
    for (const tier of TIERS) {
      const inTier = characters.filter((c) => c.tier === tier);
      const ratio = inTier.filter((c) => c.side === 'hero').length / inTier.length;
      expect(ratio).toBeGreaterThanOrEqual(0.4);
      expect(ratio).toBeLessThanOrEqual(0.6);
    }
  });

  it.each(TIERS)('fills a Pick Round from the %s Pool with distinct names', (pool) => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const round = startRound({ characters, mode: 'pick', pool, random });
    expect(new Set(round.cards.map((c) => c.character.id)).size).toBe(10);
    for (const card of round.cards) {
      expect(new Set(card.choices.map((c) => c.name)).size).toBe(4);
    }
  });
});

describe('checkCharacters', () => {
  it('accepts a valid list', () => {
    expect(checkCharacters([valid, other], allExist)).toEqual([]);
  });

  it('names a Character whose Picture file is missing', () => {
    const problems = checkCharacters([valid, other], (f) => f !== 'pictures/thor-1.svg');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('thor');
    expect(problems[0]).toContain('pictures/thor-1.svg');
  });

  it('names a Character with an Alias clashing with another Character', () => {
    const clash = { ...other, aliases: ['spider man'] };
    const problems = checkCharacters([valid, clash], allExist);
    expect(problems.some((p) => p.includes('thor') && p.includes('spider-man'))).toBe(true);
  });

  it('names a Character whose Alias clashes with another Alias', () => {
    const a = { ...valid, aliases: ['Web-Head'] };
    const b = { ...other, aliases: ['webhead'] };
    expect(checkCharacters([a, b], allExist).length).toBeGreaterThan(0);
  });

  it('flags duplicate ids', () => {
    const problems = checkCharacters([valid, { ...other, id: 'spider-man' }], allExist);
    expect(problems.some((p) => p.includes('spider-man') && p.includes('duplicate'))).toBe(true);
  });

  it('flags zero or more than three Pictures', () => {
    expect(checkCharacters([{ ...valid, pictures: [] }], allExist)[0]).toContain('spider-man');
    const four = Array.from({ length: 4 }, (_, i) => ({
      file: `pictures/${i}.svg`,
      style: 'comic' as const,
    }));
    expect(checkCharacters([{ ...valid, pictures: four }], allExist)[0]).toContain('spider-man');
  });

  it('flags invalid Tier, Side, Universe and Picture style values', () => {
    const bad = {
      ...valid,
      tier: 'epic',
      side: 'neutral',
      universe: 'dc',
      pictures: [{ file: 'pictures/x.svg', style: 'photo' }],
    } as unknown as Character;
    const problems = checkCharacters([bad], allExist);
    for (const field of ['tier', 'side', 'universe', 'style']) {
      expect(problems.some((p) => p.includes(field))).toBe(true);
    }
  });
});
