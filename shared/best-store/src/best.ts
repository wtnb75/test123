// Best record shared by every game: one localStorage key per game, one value shape, and a store that never throws.
// Pure logic: the storage is injected, so nothing here touches the browser directly except `browserStorage`.

/** What is saved and what the index page can show as-is. */
export interface Best {
    /** Higher is better. A finite number. */
    score: number;
    /** Display text for the record, e.g. "WAVE 8" or "ライン 12". */
    label: string;
}

/** The subset of Web Storage the store uses. */
export interface KeyValueStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

/** The storage key of a game's best record: `<game-dir>.best`. */
export function bestKey(game: string): string {
    return `${game}.best`;
}

/** Reads a stored value; anything that is not `{ score: finite number, label: string }` is "no record". */
export function parseBest(raw: string | null): Best | null {
    if (raw === null) return null;
    try {
        const v: unknown = JSON.parse(raw);
        if (typeof v !== 'object' || v === null) return null;
        const { score, label } = v as Record<string, unknown>;
        if (typeof score !== 'number' || !Number.isFinite(score) || typeof label !== 'string') return null;
        return { score, label };
    } catch {
        return null;
    }
}

/** The browser's localStorage, or null when it cannot be reached (access itself can throw). */
export function browserStorage(): KeyValueStorage | null {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

export interface RecordResult {
    best: Best;
    /** True when this play set the best (it beat the previous one, or there was none). */
    isNew: boolean;
}

export class BestStore {
    readonly key: string;
    /** Holds the best when the storage can't be written (lives for this page only). */
    private memory: Best | null = null;

    /** `storage` is read on every call, so a storage that appears or disappears later is handled. */
    constructor(
        game: string,
        private readonly storage: () => KeyValueStorage | null = browserStorage
    ) {
        this.key = bestKey(game);
    }

    /** The best so far (saved or kept in memory), or null when there is none. Never throws. */
    load(): Best | null {
        const stored = this.readStored();
        if (this.memory && (!stored || this.memory.score > stored.score)) return this.memory;
        return stored;
    }

    /**
     * Records a finished play. Only a score strictly above the current best replaces it.
     * A score that is not a finite number is ignored. A storage failure keeps the record in memory instead.
     */
    record(score: number, label: string): RecordResult | null {
        if (!Number.isFinite(score)) return null;
        const prev = this.load();
        if (prev && score <= prev.score) return { best: prev, isNew: false };
        const best: Best = { score, label };
        this.memory = best;
        try {
            this.storage()?.setItem(this.key, JSON.stringify(best));
        } catch {
            // Storage unavailable or full: the in-memory copy keeps it for this page.
        }
        return { best, isNew: true };
    }

    private readStored(): Best | null {
        try {
            return parseBest(this.storage()?.getItem(this.key) ?? null);
        } catch {
            return null;
        }
    }
}
