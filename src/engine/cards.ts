export const CARD_COUNTS: readonly number[] = [5, 10, 20, 30, 50, 75, 100];
export const DEFAULT_CARDS = 10;

export function largestCardCount(poolSize: number): number {
  const fits = CARD_COUNTS.filter((count) => count <= poolSize);
  return fits[fits.length - 1] ?? CARD_COUNTS[0]!;
}

export function stepCards(current: number, direction: 1 | -1, poolSize: number): number {
  const allowed = CARD_COUNTS.filter((count) => count <= largestCardCount(poolSize));
  return allowed[allowed.indexOf(current) + direction] ?? current;
}
