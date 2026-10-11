// Saved values (high score, start stage): a failing storage never stops the game (docs/spec.md 技術要件).
import { parseLeadingInteger } from './startStage';

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

/** A saved high score: a finite integer >= 0 (leading integer part), else 0. */
export const parseHighScore = (raw: string | null): number => {
  const value = parseLeadingInteger(raw);
  return value !== null && Number.isFinite(value) && value >= 0 ? value : 0;
};

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
    safeSetItem(store, key, String(score));
  }
};
