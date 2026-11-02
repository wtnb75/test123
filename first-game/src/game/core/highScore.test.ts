import { afterEach, describe, expect, it, vi } from 'vitest';
import { bestKey } from 'best-store';
import {
  HIGHSCORE_KEY,
  browserStore,
  createSessionBest,
  currentHighScore,
  highScoreLabel,
  parseHighScore,
  recordScore,
  safeGetItem,
  safeSetItem,
  type KeyValueStore,
} from './highScore';

const KEY = 'hs';
/** A saved high score in the shared best-store shape (docs/spec.md 技術要件). */
const rec = (score: number): string => JSON.stringify({ score, label: `Stage ${score + 1}` });

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
    [rec(12), 12],
    [rec(0), 0],
    ['{"score":12,"label":"x"}', 12],
    ['{"score":12,"label":""}', 12],
    ['{"score":9007199254740991,"label":"x"}', 9007199254740991],
    ['{"score":-0,"label":"x"}', 0], // toBe uses Object.is: a returned -0 would fail
    ['{"score":-1,"label":"x"}', 0],
    ['{"score":-3,"label":"x"}', 0],
    ['{"score":2.5,"label":"x"}', 0],
    ['{"score":1e21,"label":"x"}', 0],
    ['{"score":1e999,"label":"x"}', 0], // Infinity
    ['{"score":9007199254740992,"label":"x"}', 0],
    ['{"score":12}', 0],
    ['{"score":"12","label":"x"}', 0],
    ['{"score":12,"label":7}', 0],
    ['12', 0], // the previous plain-decimal format is not read
    ['12x', 0],
    ['{', 0],
    ['null', 0],
    ['', 0],
    [null, 0],
  ])('reads %j as %i', (raw, expected) => {
    expect(parseHighScore(raw)).toBe(expected);
  });
});

describe('storage key and label', () => {
  it('uses the shared best-store key of the game directory, first-game.best', () => {
    expect(HIGHSCORE_KEY).toBe('first-game.best');
    expect(HIGHSCORE_KEY).toBe(bestKey('first-game'));
  });

  it('labels a score by the stage it reaches (score 12 -> Stage 13)', () => {
    expect(highScoreLabel(12)).toBe('Stage 13');
    expect(highScoreLabel(0)).toBe('Stage 1');
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
    const store = memoryStore({ [KEY]: rec(5) });
    const session = createSessionBest();
    recordScore(store, KEY, session, 5);
    recordScore(store, KEY, session, 3);
    expect(store.data[KEY]).toBe(rec(5));
    recordScore(store, KEY, session, 6);
    expect(store.data[KEY]).toBe('{"score":6,"label":"Stage 7"}');
  });

  it('writes the record once per beating score, as {score, label} under the given key only', () => {
    const store = memoryStore();
    recordScore(store, HIGHSCORE_KEY, createSessionBest(), 7);
    expect(store.data).toEqual({ 'first-game.best': '{"score":7,"label":"Stage 8"}' });
  });

  it('does not read the previous key minefield-rogue-highscore, and leaves it alone', () => {
    const store = memoryStore({ 'minefield-rogue-highscore': '9' });
    const session = createSessionBest();
    expect(currentHighScore(store, HIGHSCORE_KEY, session)).toBe(0);
    recordScore(store, HIGHSCORE_KEY, session, 2);
    expect(store.data['minefield-rogue-highscore']).toBe('9');
    expect(store.data[HIGHSCORE_KEY]).toBe('{"score":2,"label":"Stage 3"}');
  });

  it('writes over a broken saved value when the score is above 0, and not for score 0', () => {
    const store = memoryStore({ [KEY]: '{' });
    recordScore(store, KEY, createSessionBest(), 0);
    expect(store.data[KEY]).toBe('{');
    recordScore(store, KEY, createSessionBest(), 1);
    expect(store.data[KEY]).toBe(rec(1));
  });

  it('keeps the session best when the write fails, so High does not drop after a new game', () => {
    const session = createSessionBest();
    recordScore(throwingStore, KEY, session, 7);
    expect(currentHighScore(throwingStore, KEY, session)).toBe(7);
    recordScore(throwingStore, KEY, session, 4);
    expect(currentHighScore(throwingStore, KEY, session)).toBe(7);
  });

  it('uses the larger of the stored value and the session best', () => {
    const store = memoryStore({ [KEY]: rec(9) });
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
