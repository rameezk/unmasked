import { MODES, TIERS, type Mode, type Tier } from '../engine/types';
import { ROUND_LENGTH } from '../engine/round';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Settings {
  mode: Mode;
  pool: Tier;
}

export interface Saved {
  settings(): Settings;
  saveSettings(settings: Settings): void;
  bestScore(mode: Mode, pool: Tier): number | null;
  recordScore(mode: Mode, pool: Tier, score: number): void;
}

const STORAGE_KEY = 'unmasked:v1';

const DEFAULT_SETTINGS: Settings = { mode: 'pick', pool: 'rookie' };

interface Data {
  settings: Settings;
  best: Record<string, number>;
}

const comboKey = (mode: Mode, pool: Tier) => `${mode}:${pool}`;

const isMode = (value: unknown): value is Mode => MODES.some((m) => m === value);
const isTier = (value: unknown): value is Tier => TIERS.some((t) => t === value);

function parse(raw: string | null): Data {
  const data: Data = { settings: { ...DEFAULT_SETTINGS }, best: {} };
  if (raw === null) return data;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return data;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return data;
  const record = parsed as Record<string, unknown>;
  if (isMode(record.mode)) data.settings.mode = record.mode;
  if (isTier(record.pool)) data.settings.pool = record.pool;
  const best = record.best;
  if (typeof best === 'object' && best !== null && !Array.isArray(best)) {
    for (const mode of MODES) {
      for (const pool of TIERS) {
        const key = comboKey(mode, pool);
        const value = (best as Record<string, unknown>)[key];
        if (
          Number.isInteger(value) &&
          (value as number) >= 0 &&
          (value as number) <= ROUND_LENGTH
        ) {
          data.best[key] = value as number;
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
      store?.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: data.settings.mode, pool: data.settings.pool, best: data.best }),
      );
    } catch {
      return;
    }
  }

  return {
    settings: () => ({ ...data.settings }),
    saveSettings(settings) {
      data.settings = { mode: settings.mode, pool: settings.pool };
      persist();
    },
    bestScore: (mode, pool) => data.best[comboKey(mode, pool)] ?? null,
    recordScore(mode, pool, score) {
      const key = comboKey(mode, pool);
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
