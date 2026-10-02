import { describe, expect, it } from 'vitest';
import { answerPick, currentCard, nextCard, roundScore, startRound } from './round';
import { seededRandom } from './random';
import type { Character, Tier } from './types';

const tiers: Tier[] = ['rookie', 'pro', 'legend'];

const cast: Character[] = tiers.flatMap((tier) =>
  Array.from({ length: 12 }, (_, i) => ({
    id: `${tier}-${i}`,
    name: `${tier} ${i}`,
    aliases: [],
    tier,
    side: i % 2 === 0 ? ('hero' as const) : ('villain' as const),
    universe: 'marvel' as const,
    pictures: [
      { file: `${tier}-${i}-a.svg`, style: 'comic' as const },
      { file: `${tier}-${i}-b.svg`, style: 'movie' as const },
    ],
  })),
);

const tierOf = (id: string) => cast.find((c) => c.id === id)!.tier;

describe('startRound', () => {
  it('deals ten distinct Characters', () => {
    const round = startRound({
      characters: cast,
      pool: 'legend',
      random: seededRandom(1),
    });
    const ids = round.cards.map((c) => c.character.id);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });

  it('draws Rookie Cards and choices only from Rookie Characters', () => {
    for (let seed = 0; seed < 20; seed++) {
      const round = startRound({
        characters: cast,
        pool: 'rookie',
        random: seededRandom(seed),
      });
      for (const card of round.cards) {
        expect(card.choices).toHaveLength(4);
        expect(card.choices.every((c) => tierOf(c.id) === 'rookie')).toBe(true);
      }
    }
  });

  it('makes pools cumulative', () => {
    for (let seed = 0; seed < 20; seed++) {
      const round = startRound({
        characters: cast,
        pool: 'pro',
        random: seededRandom(seed),
      });
      expect(round.cards.every((c) => tierOf(c.character.id) !== 'legend')).toBe(true);
    }
    const tiersSeen = new Set(
      Array.from({ length: 20 }, (_, seed) =>
        startRound({
          characters: cast,
          pool: 'pro',
          random: seededRandom(seed),
        }).cards.map((c) => tierOf(c.character.id)),
      ).flat(),
    );
    expect(tiersSeen).toEqual(new Set(['rookie', 'pro']));
  });

  it('offers four distinct names with exactly one correct, in varying positions', () => {
    const positions = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      const round = startRound({
        characters: cast,
        pool: 'legend',
        random: seededRandom(seed),
      });
      for (const card of round.cards) {
        const ids = card.choices.map((c) => c.id);
        expect(new Set(ids).size).toBe(4);
        expect(ids.filter((id) => id === card.character.id)).toHaveLength(1);
        positions.add(ids.indexOf(card.character.id));
      }
    }
    expect(positions).toEqual(new Set([0, 1, 2, 3]));
  });

  it('shows one of the Character pictures', () => {
    const round = startRound({
      characters: cast,
      pool: 'legend',
      random: seededRandom(3),
    });
    for (const card of round.cards) {
      expect(card.character.pictures).toContainEqual(card.picture);
    }
  });

  it('is deterministic for the same random source', () => {
    const a = startRound({
      characters: cast,
      pool: 'legend',
      random: seededRandom(7),
    });
    const b = startRound({
      characters: cast,
      pool: 'legend',
      random: seededRandom(7),
    });
    expect(a).toEqual(b);
  });
});

describe('answerPick', () => {
  const setup = () => startRound({ characters: cast, pool: 'rookie', random: seededRandom(5) });

  it('scores a correct first tap and reveals the Card', () => {
    let round = setup();
    const card = currentCard(round);
    round = answerPick(round, card.character.id);
    expect(currentCard(round).revealed).toBe(true);
    expect(roundScore(round)).toBe(1);
  });

  it('greys out a wrong tap and lets the player keep tapping without scoring', () => {
    let round = setup();
    const card = currentCard(round);
    const wrong = card.choices.find((c) => c.id !== card.character.id)!;
    round = answerPick(round, wrong.id);
    expect(currentCard(round).revealed).toBe(false);
    expect(currentCard(round).wrongIds).toEqual([wrong.id]);
    round = answerPick(round, card.character.id);
    expect(currentCard(round).revealed).toBe(true);
    expect(roundScore(round)).toBe(0);
  });

  it('ignores taps after the Card is revealed', () => {
    let round = setup();
    const card = currentCard(round);
    round = answerPick(round, card.character.id);
    const again = answerPick(round, card.choices.find((c) => c.id !== card.character.id)!.id);
    expect(again).toEqual(round);
  });
});

describe('nextCard', () => {
  it('finishes after ten Cards with the Score out of ten', () => {
    let round = startRound({
      characters: cast,
      pool: 'legend',
      random: seededRandom(2),
    });
    for (let i = 0; i < 10; i++) {
      expect(round.finished).toBe(false);
      round = answerPick(round, currentCard(round).character.id);
      round = nextCard(round);
    }
    expect(round.finished).toBe(true);
    expect(roundScore(round)).toBe(10);
    expect(round.cards).toHaveLength(10);
  });

  it('does not advance past an unrevealed Card', () => {
    const round = startRound({
      characters: cast,
      pool: 'legend',
      random: seededRandom(2),
    });
    expect(nextCard(round)).toEqual(round);
  });
});
