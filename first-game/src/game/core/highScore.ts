// Saved values (high score, start stage): a failing storage never stops the game (docs/spec.md 技術要件).
import { bestKey, parseBest, type Best } from 'best-store';

/** The storage key of the high score: `first-game.best` (docs/spec.md 技術要件). */
export const HIGHSCORE_KEY = bestKey('first-game');

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** The browser's localStorage, or null when even touching it throws (blocked storage). */
export const browserStore = (): KeyValueStore | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const safeGetItem = (store: KeyValueStore | null, key: string): string | null => {
  try {
    return store === null ? null : store.getItem(key);
  } catch {
    return null;
  }
};

/** True when the value was written. */
export const safeSetItem = (store: KeyValueStore | null, key: string, value: string): boolean => {
  try {
    if (store === null) {
      return false;
    }
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

/** A saved high score: the `score` of a best-store record when it is a safe integer >= 0, else 0. */
export const parseHighScore = (raw: string | null): number => {
  const best = parseBest(raw);
  // `|| 0` turns a saved -0 into 0.
  return best !== null && Number.isSafeInteger(best.score) && best.score >= 0 ? best.score || 0 : 0;
};

/** The best-store `label` of a high score: the stage reached (score = stage number - 1). */
export const highScoreLabel = (score: number): string => `Stage ${score + 1}`;

/** The best score of this page's session: kept outside the Scene so NEW GAME and RETRY do not lose it. */
export type SessionBest = { best: number };

export const createSessionBest = (): SessionBest => ({ best: 0 });

/** max(saved value, best of the session). */
export const currentHighScore = (store: KeyValueStore | null, key: string, session: SessionBest): number =>
  Math.max(parseHighScore(safeGetItem(store, key)), session.best);

/**
 * A score fixed at death. The session best always takes it; it is written only when it beats the current
 * high score, and a failing write is ignored.
 */
export const recordScore = (store: KeyValueStore | null, key: string, session: SessionBest, score: number): void => {
  const high = currentHighScore(store, key, session);
  session.best = Math.max(session.best, score);
  if (score > high) {
    const record: Best = { score, label: highScoreLabel(score) };
    safeSetItem(store, key, JSON.stringify(record));
  }
};
