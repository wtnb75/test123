// Best record (docs/spec.md "保存するもの" > "ベスト記録"): the highest line count, kept in localStorage.
// This is the only module that touches the browser storage API.
import { PARAMS } from '../params';

export interface BestStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

/** What the best row shows (in the HUD and on Result): the best line count, and whether this run has set it. */
export interface BestRow {
    readonly best: number;
    readonly updated: boolean;
}

/** A stored value counts only when it is a positive integer written in plain decimal digits. */
export function parseBest(raw: string | null): number | null {
    if (raw === null || !/^[1-9][0-9]*$/.test(raw)) return null;
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : null;
}

/** The browser's localStorage, or null when it cannot be reached (access can throw). */
export function browserStorage(): BestStorage | null {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

/**
 * The best record of one run. It reads the saved best once, when the run starts, and then decides the best row for
 * the run's line count as it grows, saving each new best at once (so a run that is never "over" still counts).
 * A storage error never reaches the caller: the row just disappears and the storage is left alone from then on.
 */
export class BestKeeper {
    private storage: BestStorage | null;
    /** The best saved before this run started; null when nothing valid was saved. */
    private readonly baseline: number | null;
    /** The highest line count this run has already written. */
    private written = 0;

    constructor(storage: BestStorage | null) {
        let baseline: number | null = null;
        let usable = storage;
        if (usable !== null) {
            try {
                baseline = parseBest(usable.getItem(PARAMS.bestKey));
            } catch {
                usable = null;
            }
        }
        this.storage = usable;
        this.baseline = baseline;
    }

    /**
     * The row for a run at `lines` clears, saving `lines` when it beats the saved best. Safe to call again with the
     * same count (nothing is written twice). Null when there is nothing to show or the storage fails.
     */
    update(lines: number): BestRow | null {
        if (this.storage === null) return null;
        const base = this.baseline;
        // A count that is not a whole, safely readable number of lines never counts (and is never written).
        const counts = Number.isSafeInteger(lines) && lines >= 1 && (base === null || lines > base);
        if (!counts) return base === null ? null : { best: base, updated: false };
        if (lines > this.written) {
            try {
                this.storage.setItem(PARAMS.bestKey, String(lines));
            } catch {
                this.storage = null;
                return null;
            }
            this.written = lines;
        }
        return { best: lines, updated: base !== null };
    }
}

/** The text of the best row ("ベスト 7", "ベスト 7 更新!"). */
export const bestLabel = (row: BestRow): string => `ベスト ${row.best}${row.updated ? ' 更新!' : ''}`;
