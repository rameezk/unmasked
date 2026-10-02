import { TIERS, type Character, type Picture, type Random, type Tier } from './types';

export const ROUND_LENGTH = 10;
export const CHOICE_COUNT = 4;

export interface Card {
  character: Character;
  picture: Picture;
  choices: Character[];
  wrongIds: string[];
  firstTapCorrect: boolean | null;
  revealed: boolean;
}

export interface Round {
  pool: Tier;
  cards: Card[];
  index: number;
  finished: boolean;
}

export interface StartRoundOptions {
  characters: readonly Character[];
  pool: Tier;
  random: Random;
}

export function poolCharacters(characters: readonly Character[], pool: Tier): Character[] {
  const max = TIERS.indexOf(pool);
  return characters.filter((c) => TIERS.indexOf(c.tier) <= max);
}

function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function startRound({ characters, pool, random }: StartRoundOptions): Round {
  const available = poolCharacters(characters, pool);
  if (available.length < ROUND_LENGTH) {
    throw new Error(`Pool ${pool} has too few Characters`);
  }
  const chosen = shuffle(available, random).slice(0, ROUND_LENGTH);
  const cards = chosen.map((character): Card => {
    const wrong = shuffle(
      available.filter((c) => c.id !== character.id),
      random,
    ).slice(0, CHOICE_COUNT - 1);
    const picture = character.pictures[Math.floor(random() * character.pictures.length)]!;
    return {
      character,
      picture,
      choices: shuffle([character, ...wrong], random),
      wrongIds: [],
      firstTapCorrect: null,
      revealed: false,
    };
  });
  return { pool, cards, index: 0, finished: false };
}

export function currentCard(round: Round): Card {
  return round.cards[round.index]!;
}

function withCurrentCard(round: Round, card: Card): Round {
  return {
    ...round,
    cards: round.cards.map((c, i) => (i === round.index ? card : c)),
  };
}

export function answerPick(round: Round, choiceId: string): Round {
  const card = currentCard(round);
  if (round.finished || card.revealed || card.wrongIds.includes(choiceId)) return round;
  if (!card.choices.some((c) => c.id === choiceId)) return round;
  const correct = choiceId === card.character.id;
  const firstTapCorrect = card.firstTapCorrect ?? correct;
  if (correct) return withCurrentCard(round, { ...card, firstTapCorrect, revealed: true });
  return withCurrentCard(round, {
    ...card,
    firstTapCorrect,
    wrongIds: [...card.wrongIds, choiceId],
  });
}

export function nextCard(round: Round): Round {
  if (round.finished || !currentCard(round).revealed) return round;
  if (round.index + 1 >= round.cards.length) return { ...round, finished: true };
  return { ...round, index: round.index + 1 };
}

export function roundScore(round: Round): number {
  return round.cards.filter((c) => c.firstTapCorrect === true).length;
}
