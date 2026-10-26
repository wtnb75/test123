// Best record (docs/spec.md "保存するもの" > "ベスト記録"): the highest line count, kept in localStorage.
// This is the only module that touches the browser storage API.
import { PARAMS } from '../params';

export interface BestStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

/** What Result shows on the best row: the best line count, and whether this run just set it. */
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
 * Decides the best row for a run that ended with `lines` clears, saving a new best. Returns null (no row)
 * when there is nothing to show or the storage fails; a storage error never reaches the caller.
 */
export function resolveBest(lines: number, storage: BestStorage | null): BestRow | null {
    if (storage === null) return null;
    try {
        const stored = parseBest(storage.getItem(PARAMS.bestKey));
        if (lines < 1) return stored === null ? null : { best: stored, updated: false };
        if (stored !== null && lines <= stored) return { best: stored, updated: false };
        storage.setItem(PARAMS.bestKey, String(lines));
        return { best: lines, updated: stored !== null };
    } catch {
        return null;
    }
}

/** The text of the best row ("ベスト 7", "ベスト 7 更新!"). */
export const bestLabel = (row: BestRow): string => `ベスト ${row.best}${row.updated ? ' 更新!' : ''}`;
