// Personal best score (docs/spec.md "自己ベスト"). Storage itself (key, value shape, in-memory fallback) is the
// shared `best-store` package; this module adds only the typerain rules on top of it.
import type { BestStore } from 'best-store';

/** The label saved with a best: shown as-is by the index page. */
export const bestLabel = (score: number): string => `SCORE ${score}`;

/** The best score so far, or null when there is no record. */
export function loadBest(store: BestStore): number | null {
    return store.load()?.score ?? null;
}

/**
 * Records a finished play. The best changes only when `score` beats it (a tie doesn't), a score of 0
 * never does (the shared store would accept it), and with no record any score of 1 or more does.
 */
export function recordBest(store: BestStore, score: number): { best: number | null; isNew: boolean } {
    if (score <= 0) return { best: loadBest(store), isNew: false };
    const rec = store.record(score, bestLabel(score));
    return rec ? { best: rec.best.score, isNew: rec.isNew } : { best: loadBest(store), isNew: false };
}

export const formatBest = (best: number | null): string => (best === null ? 'BEST ---' : `BEST ${best}`);
