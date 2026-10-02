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
  it('given no saved data, defaults to Pick + Rookie with no best Scores', () => {
    const saved = createSaved(memoryStore());
    expect(saved.settings()).toEqual({ mode: 'pick', pool: 'rookie' });
    expect(saved.bestScore('pick', 'rookie')).toBeNull();
  });

  it('given remembered settings, a new session restores them', () => {
    const store = memoryStore();
    createSaved(store).saveSettings({ mode: 'type', pool: 'legend' });
    expect(createSaved(store).settings()).toEqual({ mode: 'type', pool: 'legend' });
  });

  it('given a previous best of 6, a Score of 8 replaces it only for its own combination', () => {
    const store = memoryStore();
    const saved = createSaved(store);
    saved.recordScore('type', 'legend', 6);
    saved.recordScore('pick', 'pro', 3);
    saved.recordScore('type', 'legend', 8);
    const reloaded = createSaved(store);
    expect(reloaded.bestScore('type', 'legend')).toBe(8);
    expect(reloaded.bestScore('pick', 'pro')).toBe(3);
    expect(reloaded.bestScore('pick', 'legend')).toBeNull();
  });

  it('given a best of 8, a Score of 5 does not replace it', () => {
    const store = memoryStore();
    const saved = createSaved(store);
    saved.recordScore('pick', 'rookie', 8);
    saved.recordScore('pick', 'rookie', 5);
    expect(saved.bestScore('pick', 'rookie')).toBe(8);
    expect(createSaved(store).bestScore('pick', 'rookie')).toBe(8);
  });

  it('given a best Score of 0, it is kept as a best Score', () => {
    const saved = createSaved(memoryStore());
    saved.recordScore('pick', 'rookie', 0);
    expect(saved.bestScore('pick', 'rookie')).toBe(0);
  });

  it.each([
    ['not json', '{nope'],
    ['wrong shape', '[1,2]'],
    ['null', 'null'],
    [
      'bad values',
      '{"mode":"x","pool":5,"best":{"pick:rookie":"high","pick:pro":-2,"zzz":4,"type:pro":99}}',
    ],
  ])('given corrupt saved data (%s), falls back to defaults', (_name, raw) => {
    const saved = createSaved(memoryStore({ 'unmasked:v1': raw }));
    expect(saved.settings()).toEqual({ mode: 'pick', pool: 'rookie' });
    expect(saved.bestScore('pick', 'rookie')).toBeNull();
    expect(saved.bestScore('pick', 'pro')).toBeNull();
    expect(saved.bestScore('type', 'pro')).toBeNull();
  });

  it.each([
    ['throwing storage', throwingStore],
    ['unavailable storage', null],
  ])('given %s, still works in memory without throwing', (_name, store) => {
    const saved = createSaved(store);
    expect(saved.settings()).toEqual({ mode: 'pick', pool: 'rookie' });
    saved.saveSettings({ mode: 'type', pool: 'pro' });
    saved.recordScore('type', 'pro', 4);
    expect(saved.bestScore('type', 'pro')).toBe(4);
  });
});
