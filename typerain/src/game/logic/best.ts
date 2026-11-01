// Personal best score, kept in localStorage with an in-memory fallback (docs/spec.md "ルール > スコア").
import { BEST_KEY } from '../params';

/** The subset of Web Storage the store uses. */
export interface KeyValueStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

/** A stored value counts only when it is a non-negative integer written in plain digits. */
function parseBest(raw: string | null): number | null {
    if (raw === null || !/^\d+$/.test(raw)) return null;
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : null;
}

export class BestStore {
    /** Holds the best when the storage can't be written (lives for this page only). */
    private memory: number | null = null;

    constructor(private readonly storage: () => KeyValueStorage | null) {}

    /** The best so far, or null when there is no record. */
    load(): number | null {
        const stored = this.readStored();
        if (this.memory !== null && (stored === null || this.memory > stored)) return this.memory;
        return stored;
    }

    private readStored(): number | null {
        try {
            return parseBest(this.storage()?.getItem(BEST_KEY) ?? null);
        } catch {
            return null;
        }
    }

    /**
     * Records a finished play. The best changes only when `score` beats it (a tie doesn't), a score of 0
     * never does, and with no record any score of 1 or more does.
     */
    record(score: number): { best: number | null; isNew: boolean } {
        const prev = this.load();
        const beats = score > 0 && (prev === null || score > prev);
        if (!beats) return { best: prev, isNew: false };
        this.memory = score;
        try {
            this.storage()?.setItem(BEST_KEY, String(score));
        } catch {
            // Storage unavailable or full: the in-memory copy keeps it for this page.
        }
        return { best: score, isNew: true };
    }
}

export const formatBest = (best: number | null): string => (best === null ? 'BEST ---' : `BEST ${best}`);
