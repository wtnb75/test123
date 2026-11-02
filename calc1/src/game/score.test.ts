import { describe, expect, it } from 'vitest';
import { bestKey } from 'best-store';
import {
    BEST_STORAGE_KEY,
    levelLabel,
    SCORE_MOVE_WEIGHT,
    bestToShow,
    clearResult,
    SCORE_TIME_WEIGHT,
    computeScore,
    countUsedMoves,
    loadBest,
    saveBest,
    updateBest,
    type Best,
    type TurnSlot,
} from './logic';

const fakeStorage = (initial: Record<string, string> = {}) => {
    const data = new Map<string, string>(Object.entries(initial));
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => {
            data.set(key, value);
        },
        raw: () => data,
    };
};

const throwingStorage = {
    getItem: (): string | null => {
        throw new Error('blocked');
    },
    setItem: (): void => {
        throw new Error('full');
    },
};

const slot = (selected: boolean): TurnSlot => ({
    options: [],
    selected: selected ? { label: '+1', apply: (v: number) => v + 1 } : null,
});

describe('score parameters of the spec', () => {
    it('uses 1 point per second, 2 points per move saved, and the best key calc1.best', () => {
        expect([SCORE_TIME_WEIGHT, SCORE_MOVE_WEIGHT, BEST_STORAGE_KEY]).toEqual([1, 2, 'calc1.best']);
    });

    it('uses the shared best-store key of the game directory', () => {
        expect(BEST_STORAGE_KEY).toBe(bestKey('calc1'));
    });

    it('labels a best with the cleared level as "Lv.N"', () => {
        expect(levelLabel(7)).toBe('Lv.7');
    });
});

describe('computeScore', () => {
    it('gives 78 for 60 s left, max 12 moves and 3 used (60 × 1 + 9 × 2)', () => {
        expect(computeScore(60000, 12, 3)).toBe(78);
    });

    it('counts 40.9 s left as 40 whole seconds', () => {
        expect(computeScore(40900, 12, 3)).toBe(40 + 9 * 2);
    });

    it('adds nothing for the moves when every maximum move is used (12 used of 12)', () => {
        expect(computeScore(60000, 12, 12)).toBe(60);
    });

    it('adds max moves × 2 when no move is used (0 used of 12 gives 24 points)', () => {
        expect(computeScore(60000, 12, 0)).toBe(60 + 24);
    });

    it('treats remaining time at or below zero as 0 seconds left (never negative)', () => {
        expect(computeScore(-500, 12, 0)).toBe(0 + 24);
        expect(computeScore(0, 12, 12)).toBe(0);
    });
});

describe('countUsedMoves', () => {
    const slots = [slot(true), slot(false), slot(true), slot(true), slot(true)];

    it('counts the non-skip selections up to and including the winning turn', () => {
        // Turns 1..4 (1-based): non-skip at 1, 3, 4 -> 3
        expect(countUsedMoves(slots, 4)).toBe(3);
    });

    it('does not count the selections left after the winning turn (only turns up to it are read)', () => {
        // Only turns 1..2 are counted: non-skip at 1 -> 1, even though turns 3..5 have selections
        expect(countUsedMoves(slots, 2)).toBe(1);
    });

    it('counts a win on the very first turn', () => {
        expect(countUsedMoves(slots, 1)).toBe(1);
    });
});

const rec = (score: number, label: string) => JSON.stringify({ score, label });

describe('loadBest', () => {
    it('returns null when nothing is saved', () => {
        expect(loadBest(fakeStorage())).toBeNull();
    });

    it('reads a saved score and label pair', () => {
        expect(loadBest(fakeStorage({ [BEST_STORAGE_KEY]: '{"score":120,"label":"Lv.7"}' }))).toEqual({ score: 120, label: 'Lv.7' });
    });

    it('reads from the key calc1.best only', () => {
        const storage = fakeStorage({ 'calc1.best': rec(120, 'Lv.7') });
        expect(loadBest(storage)).toEqual({ score: 120, label: 'Lv.7' });
    });

    it('treats corrupt JSON as no save', () => {
        expect(loadBest(fakeStorage({ [BEST_STORAGE_KEY]: '{not json' }))).toBeNull();
    });

    it('treats a value of the wrong shape as no save (label or score missing, or of the wrong type)', () => {
        expect(loadBest(fakeStorage({ [BEST_STORAGE_KEY]: '{"score":120}' }))).toBeNull();
        expect(loadBest(fakeStorage({ [BEST_STORAGE_KEY]: '{"label":"Lv.7"}' }))).toBeNull();
        expect(loadBest(fakeStorage({ [BEST_STORAGE_KEY]: '{"score":"120","label":"Lv.7"}' }))).toBeNull();
        expect(loadBest(fakeStorage({ [BEST_STORAGE_KEY]: '{"score":120,"label":7}' }))).toBeNull();
        expect(loadBest(fakeStorage({ [BEST_STORAGE_KEY]: '{"score":1e999,"label":"Lv.1"}' }))).toBeNull(); // Infinity
    });

    it('treats the previous {level, score} shape under the new key as no save', () => {
        expect(loadBest(fakeStorage({ [BEST_STORAGE_KEY]: '{"level":7,"score":120}' }))).toBeNull();
    });

    it('does not read the previous key calcRushBest', () => {
        expect(loadBest(fakeStorage({ calcRushBest: '{"level":7,"score":120}' }))).toBeNull();
        expect(loadBest(fakeStorage({ calcRushBest: rec(120, 'Lv.7') }))).toBeNull();
    });

    it('treats a stored JSON null, a bare number and an empty value as no save', () => {
        expect(loadBest(fakeStorage({ [BEST_STORAGE_KEY]: 'null' }))).toBeNull();
        expect(loadBest(fakeStorage({ [BEST_STORAGE_KEY]: '7' }))).toBeNull();
        expect(loadBest(fakeStorage({ [BEST_STORAGE_KEY]: '' }))).toBeNull();
    });

    it('treats a read that throws, and a missing storage, as no save', () => {
        expect(loadBest(throwingStorage)).toBeNull();
        expect(loadBest(null)).toBeNull();
    });
});

describe('updateBest', () => {
    const candidate: Best = { score: 80, label: 'Lv.5' };

    it('takes the candidate when nothing is stored', () => {
        expect(updateBest(null, candidate)).toEqual(candidate);
    });

    it('takes the candidate only when its score is strictly higher', () => {
        expect(updateBest({ score: 70, label: 'Lv.4' }, candidate)).toEqual(candidate);
    });

    it('keeps the stored pair on a tie (the stored label stays too)', () => {
        const stored: Best = { score: 80, label: 'Lv.9' };
        expect(updateBest(stored, candidate)).toEqual(stored);
    });

    it('keeps the stored pair when the candidate is lower', () => {
        const stored: Best = { score: 100, label: 'Lv.9' };
        expect(updateBest(stored, candidate)).toEqual(stored);
    });
});

describe('saveBest', () => {
    it('writes {score, label} under calc1.best and reports success', () => {
        const storage = fakeStorage();
        expect(saveBest({ score: 80, label: 'Lv.5' }, storage)).toBe(true);
        expect(storage.raw().get('calc1.best')).toBe('{"score":80,"label":"Lv.5"}');
        expect(storage.raw().has('calcRushBest')).toBe(false);
    });

    it('reports failure when the write throws, without throwing', () => {
        expect(saveBest({ score: 80, label: 'Lv.5' }, throwingStorage)).toBe(false);
    });

    it('reports failure when there is no storage', () => {
        expect(saveBest({ score: 80, label: 'Lv.5' }, null)).toBe(false);
    });
});

describe('clearResult (records the level it is given as the best label)', () => {
    const save = () => true;

    it('records the cleared level as the label when it is the first record', () => {
        const result = clearResult({ remainingMs: 60000, maxMoves: 12, usedMoves: 3, clearedLevel: 4, stored: null, save });
        expect(result).toEqual({ score: 78, shownBest: { score: 78, label: 'Lv.4' } });
    });

    it('records the cleared level when the new score beats the stored best', () => {
        const stored: Best = { score: 50, label: 'Lv.9' };
        const result = clearResult({ remainingMs: 60000, maxMoves: 12, usedMoves: 3, clearedLevel: 4, stored, save });
        expect(result.shownBest).toEqual({ score: 78, label: 'Lv.4' });
    });

    it('keeps the stored pair (its own label) when the new score does not beat it', () => {
        const stored: Best = { score: 100, label: 'Lv.9' };
        const result = clearResult({ remainingMs: 60000, maxMoves: 12, usedMoves: 3, clearedLevel: 4, stored, save });
        expect(result.shownBest).toEqual(stored);
    });

    it('does not write when the score ties the stored best', () => {
        const stored: Best = { score: 78, label: 'Lv.9' };
        let writes = 0;
        const result = clearResult({
            remainingMs: 60000, maxMoves: 12, usedMoves: 3, clearedLevel: 4, stored,
            save: () => {
                writes += 1;
                return true;
            },
        });
        expect(result.shownBest).toEqual(stored);
        expect(writes).toBe(0);
    });

    it('shows no best when the write fails', () => {
        const result = clearResult({ remainingMs: 60000, maxMoves: 12, usedMoves: 3, clearedLevel: 4, stored: null, save: () => false });
        expect(result).toEqual({ score: 78, shownBest: null });
    });

    it('saves what it shows: the record in the storage is the shown pair', () => {
        const storage = fakeStorage();
        const result = clearResult({
            remainingMs: 60000, maxMoves: 12, usedMoves: 3, clearedLevel: 4,
            stored: loadBest(storage), save: (best) => saveBest(best, storage),
        });
        expect(storage.raw().get(BEST_STORAGE_KEY)).toBe('{"score":78,"label":"Lv.4"}');
        expect(loadBest(storage)).toEqual(result.shownBest);
    });
});

describe('bestToShow (the best on the clear result)', () => {
    const stored: Best = { score: 100, label: 'Lv.9' };

    it('shows the stored pair without writing when the stored best still stands', () => {
        let writes = 0;
        const shown = bestToShow(stored, stored, () => {
            writes += 1;
            return true;
        });
        expect(shown).toEqual(stored);
        expect(writes).toBe(0);
    });

    it('shows the new pair once it is written', () => {
        const next: Best = { score: 130, label: 'Lv.5' };
        expect(bestToShow(stored, next, () => true)).toEqual(next);
    });

    it('shows no best (the "ベスト —" case) when the write fails', () => {
        const next: Best = { score: 130, label: 'Lv.5' };
        expect(bestToShow(stored, next, () => false)).toBeNull();
    });

    it('shows the new pair when nothing was stored and the write works', () => {
        const next: Best = { score: 80, label: 'Lv.5' };
        expect(bestToShow(null, next, () => true)).toEqual(next);
    });
});
