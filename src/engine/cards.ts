export const CARD_COUNTS = [5, 10, 20, 30, 50, 75, 100] as const;
export const DEFAULT_CARDS = 10;

export function isCardCount(value: unknown): value is (typeof CARD_COUNTS)[number] {
  return CARD_COUNTS.some((count) => count === value);
}

export function largestCardCount(poolSize: number): number {
  const fits = CARD_COUNTS.filter((count) => count <= poolSize);
  return fits[fits.length - 1] ?? CARD_COUNTS[0];
}

export function stepCards(current: number, direction: 1 | -1, poolSize: number): number {
  const allowed = CARD_COUNTS.filter((count) => count <= largestCardCount(poolSize));
  const next = allowed[allowed.indexOf(current as (typeof CARD_COUNTS)[number]) + direction];
  return next ?? current;
}
