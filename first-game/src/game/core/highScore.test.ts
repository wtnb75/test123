import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  browserStore,
  createSessionBest,
  currentHighScore,
  parseHighScore,
  recordScore,
  safeGetItem,
  safeSetItem,
  type KeyValueStore,
} from './highScore';

const KEY = 'hs';

const memoryStore = (initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } => {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
};

const throwingStore: KeyValueStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
};

describe('parseHighScore', () => {
  it.each([
    ['12', 12],
    ['12x', 12],
    ['0', 0],
    ['-3', 0],
    ['-1', 0],
    ['abc', 0],
    ['', 0],
    [null, 0],
    ['9'.repeat(400), 0],
  ])('reads %j as %i', (raw, expected) => {
    expect(parseHighScore(raw)).toBe(expected);
  });
});

describe('safe storage access', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null / false instead of throwing', () => {
    expect(safeGetItem(throwingStore, KEY)).toBeNull();
    expect(safeSetItem(throwingStore, KEY, '1')).toBe(false);
    expect(safeGetItem(null, KEY)).toBeNull();
    expect(safeSetItem(null, KEY, '1')).toBe(false);
  });

  it('reads and writes a working store', () => {
    const store = memoryStore();
    expect(safeSetItem(store, KEY, '4')).toBe(true);
    expect(safeGetItem(store, KEY)).toBe('4');
  });

  it('gives no store when window is missing', () => {
    vi.stubGlobal('window', undefined);
    expect(browserStore()).toBeNull();
  });

  it('gives no store when touching localStorage throws (blocked storage)', () => {
    vi.stubGlobal('window', {
      get localStorage (): Storage {
        throw new Error('SecurityError');
      },
    });
    expect(browserStore()).toBeNull();
  });

  it('returns the window storage when it is available', () => {
    const store = memoryStore();
    vi.stubGlobal('window', { localStorage: store });
    expect(browserStore()).toBe(store);
  });
});

describe('recordScore', () => {
  it('writes only when the score beats the high score', () => {
    const store = memoryStore({ [KEY]: '5' });
    const session = createSessionBest();
    recordScore(store, KEY, session, 5);
    recordScore(store, KEY, session, 3);
    expect(store.data[KEY]).toBe('5');
    recordScore(store, KEY, session, 6);
    expect(store.data[KEY]).toBe('6');
  });

  it('keeps the session best when the write fails, so High does not drop after a new game', () => {
    const session = createSessionBest();
    recordScore(throwingStore, KEY, session, 7);
    expect(currentHighScore(throwingStore, KEY, session)).toBe(7);
    recordScore(throwingStore, KEY, session, 4);
    expect(currentHighScore(throwingStore, KEY, session)).toBe(7);
  });

  it('uses the larger of the stored value and the session best', () => {
    const store = memoryStore({ [KEY]: '9' });
    const session = { best: 2 };
    expect(currentHighScore(store, KEY, session)).toBe(9);
    expect(currentHighScore(memoryStore(), KEY, session)).toBe(2);
  });

  it('does not write a score equal to the session best that a failed write left behind', () => {
    const store = memoryStore();
    const session = { best: 6 };
    recordScore(store, KEY, session, 6);
    expect(store.data[KEY]).toBeUndefined();
  });
});
