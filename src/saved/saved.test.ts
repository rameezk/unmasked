import { describe, expect, it } from 'vitest';
import { createSaved, type KeyValueStore } from './saved';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const throwingStore: KeyValueStore = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
};

describe('createSaved', () => {
  it('given no saved data, has no best Scores', () => {
    const saved = createSaved(memoryStore());
    expect(saved.bestScore('pick', 'rookie', 10)).toBeNull();
  });

  it('given a previous best of 6, a Score of 8 replaces it only for its own combination', () => {
    const store = memoryStore();
    const saved = createSaved(store);
    saved.recordScore('type', 'legend', 10, 6);
    saved.recordScore('pick', 'pro', 10, 3);
    saved.recordScore('type', 'legend', 10, 8);
    const reloaded = createSaved(store);
    expect(reloaded.bestScore('type', 'legend', 10)).toBe(8);
    expect(reloaded.bestScore('pick', 'pro', 10)).toBe(3);
    expect(reloaded.bestScore('pick', 'legend', 10)).toBeNull();
  });

  it('given a best of 8, a Score of 5 does not replace it', () => {
    const store = memoryStore();
    const saved = createSaved(store);
    saved.recordScore('pick', 'rookie', 10, 8);
    saved.recordScore('pick', 'rookie', 10, 5);
    expect(saved.bestScore('pick', 'rookie', 10)).toBe(8);
    expect(createSaved(store).bestScore('pick', 'rookie', 10)).toBe(8);
  });

  it('given a best Score of 0, it is kept as a best Score', () => {
    const saved = createSaved(memoryStore());
    saved.recordScore('pick', 'rookie', 10, 0);
    expect(saved.bestScore('pick', 'rookie', 10)).toBe(0);
  });

  it('given a best saved before Cards were chosen, reads it as Cards 10', () => {
    const saved = createSaved(
      memoryStore({ 'unmasked:v1': '{"best":{"pick:rookie":7,"type:pro":3}}' }),
    );
    expect(saved.bestScore('pick', 'rookie', 10)).toBe(7);
    expect(saved.bestScore('type', 'pro', 10)).toBe(3);
    expect(saved.bestScore('pick', 'rookie', 20)).toBeNull();
  });

  it('keeps bests apart per number of Cards', () => {
    const store = memoryStore();
    const saved = createSaved(store);
    saved.recordScore('pick', 'rookie', 5, 4);
    saved.recordScore('pick', 'rookie', 20, 15);
    const reloaded = createSaved(store);
    expect(reloaded.bestScore('pick', 'rookie', 5)).toBe(4);
    expect(reloaded.bestScore('pick', 'rookie', 20)).toBe(15);
    expect(reloaded.bestScore('pick', 'rookie', 10)).toBeNull();
  });

  it.each([
    ['not json', '{nope'],
    ['wrong shape', '[1,2]'],
    ['null', 'null'],
    [
      'bad values',
      '{"mode":"x","pool":5,"best":{"pick:rookie":"high","pick:pro":-2,"zzz":4,"type:pro":99,"pick:legend:7":3,"type:rookie:5":6}}',
    ],
  ])('given corrupt saved data (%s), falls back to defaults', (_name, raw) => {
    const saved = createSaved(memoryStore({ 'unmasked:v1': raw }));
    expect(saved.bestScore('pick', 'rookie', 10)).toBeNull();
    expect(saved.bestScore('pick', 'pro', 10)).toBeNull();
    expect(saved.bestScore('type', 'pro', 10)).toBeNull();
    expect(saved.bestScore('pick', 'legend', 7)).toBeNull();
    expect(saved.bestScore('type', 'rookie', 5)).toBeNull();
  });

  it.each([
    ['throwing storage', throwingStore],
    ['unavailable storage', null],
  ])('given %s, still works in memory without throwing', (_name, store) => {
    const saved = createSaved(store);
    saved.recordScore('type', 'pro', 10, 4);
    expect(saved.bestScore('type', 'pro', 10)).toBe(4);
  });
});
