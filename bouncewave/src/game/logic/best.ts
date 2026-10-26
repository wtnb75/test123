// Personal best (score and the wave it reached), kept in localStorage with an in-memory fallback.

export const BEST_KEY = 'bouncewave.best';

export interface Best {
    score: number;
    wave: number;
}

/** The subset of Web Storage the store uses. */
export interface KeyValueStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

function parseBest(raw: string | null): Best | null {
    if (raw === null) return null;
    try {
        const v: unknown = JSON.parse(raw);
        if (typeof v !== 'object' || v === null) return null;
        const { score, wave } = v as Record<string, unknown>;
        if (typeof score !== 'number' || typeof wave !== 'number' || !Number.isFinite(score) || !Number.isFinite(wave)) {
            return null;
        }
        return { score, wave };
    } catch {
        return null;
    }
}

export class BestStore {
    /** Holds the best when the storage can't be written (lives for this page only). */
    private memory: Best | null = null;

    constructor(private readonly storage: () => KeyValueStorage | null) {}

    load(): Best | null {
        const stored = this.readStored();
        if (this.memory && (!stored || this.memory.score > stored.score)) return this.memory;
        return stored;
    }

    private readStored(): Best | null {
        try {
            return parseBest(this.storage()?.getItem(BEST_KEY) ?? null);
        } catch {
            return null;
        }
    }

    /** Records a finished play; returns the best afterwards and whether this play set it. */
    record(score: number, wave: number): { best: Best; isNew: boolean } {
        const prev = this.load();
        if (prev && score <= prev.score) return { best: prev, isNew: false };
        const best = { score, wave };
        this.memory = best;
        try {
            this.storage()?.setItem(BEST_KEY, JSON.stringify(best));
        } catch {
            // Storage unavailable or full: the in-memory copy keeps it for this page.
        }
        return { best, isNew: true };
    }
}

export function formatBest(best: Best | null): string {
    return best ? `BEST ${best.score}（WAVE ${best.wave}）` : 'BEST ---';
}
