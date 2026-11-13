// Best height record (docs/spec.md "自己ベスト（記録）"). Storage itself (key, value shape, fallbacks) is the
// shared `best-store` package; this module only decides what to save and what to show.
import type { BestStore } from 'best-store';
import { BEST_MIN_METERS, GOAL_METERS } from '../params';
import type { Outcome } from './sim';

/** The record of a finished run: the score that orders records and the label shown for it. */
export interface RunRecord {
    score: number;
    label: string;
}

/**
 * What a run saves, or null when the run is not recorded (below BEST_MIN_METERS).
 * A clear scores one above the goal height so it always beats a run that reached the goal and then failed.
 */
export function runRecord(outcome: Outcome, shownMeters: number): RunRecord | null {
    if (!(shownMeters >= BEST_MIN_METERS)) return null;
    if (outcome === 'clear') return { score: GOAL_METERS + 1, label: `${GOAL_METERS} m クリア` };
    return { score: shownMeters, label: `${shownMeters} m` };
}

/** `自己ベスト 137 m`: the saved label, never rebuilt from the score. */
export const bestRowText = (label: string): string => `自己ベスト ${label}`;

export const NEW_BEST_TEXT = 'NEW BEST!';

/** What Result shows under the height row; null when there is nothing to show. */
export interface ResultBestRow {
    text: string;
    isNew: boolean;
}

/** Records the run (once) and returns the row Result shows: `NEW BEST!` on a new record, else the saved best. */
export function recordRun(store: BestStore, outcome: Outcome, shownMeters: number): ResultBestRow | null {
    const run = runRecord(outcome, shownMeters);
    const result = run ? store.record(run.score, run.label) : null;
    if (result?.isNew) return { text: NEW_BEST_TEXT, isNew: true };
    const best = result?.best ?? store.load();
    return best ? { text: bestRowText(best.label), isNew: false } : null;
}

/** The row Title shows, or null when there is no record. Reads the store every time. */
export function titleBestText(store: BestStore): string | null {
    const best = store.load();
    return best ? bestRowText(best.label) : null;
}
