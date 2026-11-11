import { MODES, TIERS, type Mode, type Tier } from '../engine/types';
import { CARD_COUNTS, DEFAULT_CARDS } from '../engine/cards';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Saved {
  bestScore(mode: Mode, pool: Tier, cards: number): number | null;
  recordScore(mode: Mode, pool: Tier, cards: number, score: number): void;
}

const STORAGE_KEY = 'unmasked:v1';

interface Data {
  best: Record<string, number>;
}

const comboKey = (mode: Mode, pool: Tier, cards: number) => `${mode}:${pool}:${cards}`;

function parse(raw: string | null): Data {
  const data: Data = { best: {} };
  if (raw === null) return data;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return data;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return data;
  const record = parsed as Record<string, unknown>;
  const best = record.best;
  if (typeof best === 'object' && best !== null && !Array.isArray(best)) {
    const stored = best as Record<string, unknown>;
    for (const mode of MODES) {
      for (const pool of TIERS) {
        for (const cards of CARD_COUNTS) {
          const key = comboKey(mode, pool, cards);
          const value =
            stored[key] ?? (cards === DEFAULT_CARDS ? stored[`${mode}:${pool}`] : undefined);
          if (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= cards) {
            data.best[key] = value as number;
          }
        }
      }
    }
  }
  return data;
}

function read(store: KeyValueStore | null): string | null {
  try {
    return store?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function createSaved(store: KeyValueStore | null): Saved {
  const data = parse(read(store));

  function persist() {
    try {
      store?.setItem(STORAGE_KEY, JSON.stringify({ best: data.best }));
    } catch {
      return;
    }
  }

  return {
    bestScore: (mode, pool, cards) => data.best[comboKey(mode, pool, cards)] ?? null,
    recordScore(mode, pool, cards, score) {
      const key = comboKey(mode, pool, cards);
      const previous = data.best[key];
      if (previous !== undefined && previous >= score) return;
      data.best[key] = score;
      persist();
    },
  };
}

export function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
