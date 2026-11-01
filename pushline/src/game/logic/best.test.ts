import { afterEach, describe, expect, it, vi } from 'vitest';
import { bestKey } from 'best-store';
import { PARAMS } from '../params';
import { BestKeeper, bestLabel, bestRecordLabel, browserStorage, parseBest, type BestStorage } from './best';
import { LANDSCAPE, PORTRAIT, resultBestY } from './layout';

const KEY = 'pushline.best';
/** A saved best in the shared best-store shape (docs/spec.md "保存するもの"). */
const rec = (n: number) => JSON.stringify({ score: n, label: `ライン ${n}` });
const setCall = (n: number) => `set ${KEY}=${rec(n)}`;

/** An in-memory storage that records every call. */
function fakeStorage(initial: string | null) {
    const calls: string[] = [];
    let value = initial;
    const storage: BestStorage = {
        getItem: (key) => {
            calls.push(`get ${key}`);
            return value;
        },
        setItem: (key, v) => {
            calls.push(`set ${key}=${v}`);
            value = v;
        },
    };
    return { storage, calls, value: () => value };
}

/** Saved values that count as "nothing saved" (docs/spec.md テスト観点). */
const INVALID_SAVED = [
    '',
    '{',
    'null',
    '7', // the previous plain-digit format is not read
    JSON.stringify({ score: 0, label: 'ライン 0' }),
    JSON.stringify({ score: -3, label: 'x' }),
    JSON.stringify({ score: 2.5, label: 'x' }),
    JSON.stringify({ score: '5', label: 'x' }),
    JSON.stringify({ score: 5 }),
    JSON.stringify({ score: 5, label: 7 }),
    '{"score":99999999999999999999,"label":"x"}',
];

describe('BestKeeper (docs/spec.md "ベスト記録")', () => {
    it('shows nothing and writes nothing while 0 lines with nothing saved', () => {
        const s = fakeStorage(null);
        const keeper = new BestKeeper(s.storage);
        expect(keeper.update(0)).toBeNull();
        expect(keeper.update(0)).toBeNull();
        expect(s.calls).toEqual([`get ${KEY}`]);
    });

    it('reads the saved best once, on creation, and never again', () => {
        const s = fakeStorage(rec(5));
        const keeper = new BestKeeper(s.storage);
        keeper.update(0);
        keeper.update(3);
        keeper.update(5);
        expect(s.calls).toEqual([`get ${KEY}`]);
    });

    it('saves each first-ever line count as it grows, without the "updated" mark', () => {
        const s = fakeStorage(null);
        const keeper = new BestKeeper(s.storage);
        expect(keeper.update(1)).toEqual({ best: 1, updated: false });
        expect(keeper.update(2)).toEqual({ best: 2, updated: false });
        expect(s.calls).toEqual([`get ${KEY}`, setCall(1), setCall(2)]);
    });

    it('keeps the saved value until the run beats it (saved 5: 0..5 lines show "5" and write nothing)', () => {
        const s = fakeStorage(rec(5));
        const keeper = new BestKeeper(s.storage);
        for (const lines of [0, 1, 4, 5]) {
            expect(keeper.update(lines)).toEqual({ best: 5, updated: false });
        }
        expect(s.calls).toEqual([`get ${KEY}`]);
        expect(s.value()).toBe(rec(5));
    });

    it('marks an update from the first clear beyond the saved best, and saves every step (saved 5: 6, 7)', () => {
        const s = fakeStorage(rec(5));
        const keeper = new BestKeeper(s.storage);
        expect(keeper.update(6)).toEqual({ best: 6, updated: true });
        expect(keeper.update(7)).toEqual({ best: 7, updated: true });
        expect(s.calls).toEqual([`get ${KEY}`, setCall(6), setCall(7)]);
    });

    it('reads only the score of a saved record: a different label still gives the best 5', () => {
        const s = fakeStorage(JSON.stringify({ score: 5, label: 'WAVE 5' }));
        expect(new BestKeeper(s.storage).update(3)).toEqual({ best: 5, updated: false });
    });

    it('never writes the same line count twice, however often it is asked', () => {
        const s = fakeStorage(rec(5));
        const keeper = new BestKeeper(s.storage);
        keeper.update(6);
        keeper.update(6);
        keeper.update(6);
        expect(s.calls).toEqual([`get ${KEY}`, setCall(6)]);
    });

    it('treats a best beaten by exactly one line as an update (saved 9, 10 lines)', () => {
        const s = fakeStorage(rec(9));
        expect(new BestKeeper(s.storage).update(10)).toEqual({ best: 10, updated: true });
    });

    it.each(INVALID_SAVED)(
        'treats the saved value %j as nothing saved: counts 1..4 are saved one by one without a mark',
        (raw) => {
            const s = fakeStorage(raw);
            const keeper = new BestKeeper(s.storage);
            for (const lines of [1, 2, 3]) keeper.update(lines);
            expect(keeper.update(4)).toEqual({ best: 4, updated: false });
            expect(s.calls).toEqual([
                `get ${KEY}`,
                setCall(1),
                setCall(2),
                setCall(3),
                setCall(4),
            ]);
        },
    );

    it.each(['', '7', '{', JSON.stringify({ score: 0, label: 'ライン 0' })])('shows no row at 0 lines when the saved value %j is invalid, and keeps it', (raw) => {
        const s = fakeStorage(raw);
        expect(new BestKeeper(s.storage).update(0)).toBeNull();
        expect(s.value()).toBe(raw);
    });

    it.each([Number.NaN, 2.5, -1, Number.POSITIVE_INFINITY, 1e21])(
        'never writes a line count that is not a whole number of lines (%s), and keeps the saved best',
        (lines) => {
            const s = fakeStorage(rec(3));
            expect(new BestKeeper(s.storage).update(lines)).toEqual({ best: 3, updated: false });
            expect(s.calls).toEqual([`get ${KEY}`]);
        },
    );

    it('shows no row and does not throw when there is no storage', () => {
        const keeper = new BestKeeper(null);
        expect(keeper.update(0)).toBeNull();
        expect(keeper.update(5)).toBeNull();
    });

    it('shows no row, does not throw and stops using the storage when reading throws', () => {
        const calls: string[] = [];
        const storage: BestStorage = {
            getItem: () => {
                calls.push('get');
                throw new Error('denied');
            },
            setItem: () => {
                calls.push('set');
                throw new Error('must not write');
            },
        };
        const keeper = new BestKeeper(storage);
        expect(keeper.update(5)).toBeNull();
        expect(keeper.update(6)).toBeNull();
        expect(calls).toEqual(['get']);
    });

    it('shows no row, does not throw and stops writing when writing throws (quota)', () => {
        let sets = 0;
        const storage: BestStorage = {
            getItem: () => rec(3),
            setItem: () => {
                sets += 1;
                throw new Error('quota');
            },
        };
        const keeper = new BestKeeper(storage);
        expect(keeper.update(2)).toEqual({ best: 3, updated: false });
        expect(keeper.update(5)).toBeNull();
        expect(keeper.update(6)).toBeNull();
        expect(sets).toBe(1);
    });

    it('compares a later run with the value the earlier run wrote', () => {
        const s = fakeStorage(null);
        const first = new BestKeeper(s.storage);
        first.update(4);
        expect(first.update(6)).toEqual({ best: 6, updated: false });
        const second = new BestKeeper(s.storage);
        expect(second.update(4)).toEqual({ best: 6, updated: false });
        expect(second.update(8)).toEqual({ best: 8, updated: true });
    });

    it('keeps the best of a run that is quit (not over): the value is already saved', () => {
        const s = fakeStorage(rec(2));
        new BestKeeper(s.storage).update(5);
        expect(s.value()).toBe(rec(5));
    });
});

describe('parseBest', () => {
    it('accepts a best-store record whose score is a positive safe integer', () => {
        expect(parseBest(rec(1))).toBe(1);
        expect(parseBest(rec(40))).toBe(40);
        expect(parseBest(JSON.stringify({ score: 9007199254740991, label: 'x' }))).toBe(9007199254740991);
    });

    it('rejects the unsafe, zero, negative, fractional and malformed values and the previous plain-digit format', () => {
        expect(parseBest(JSON.stringify({ score: 9007199254740992, label: 'x' }))).toBeNull();
        expect(parseBest(null)).toBeNull();
        for (const raw of INVALID_SAVED) expect(parseBest(raw)).toBeNull();
    });
});

describe('bestRecordLabel', () => {
    it('writes the line count as "ライン N"', () => {
        expect(bestRecordLabel(12)).toBe('ライン 12');
    });
});

describe('bestLabel', () => {
    it('adds the "更新!" mark only for an update', () => {
        expect(bestLabel({ best: 7, updated: true })).toBe('ベスト 7 更新!');
        expect(bestLabel({ best: 7, updated: false })).toBe('ベスト 7');
    });
});

describe('browserStorage', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('returns the global localStorage when it is reachable', () => {
        const fake = { getItem: () => null, setItem: () => undefined };
        vi.stubGlobal('localStorage', fake);
        expect(browserStorage()).toBe(fake);
    });

    it('returns null when reading localStorage throws', () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            get: () => {
                throw new Error('SecurityError');
            },
        });
        try {
            expect(browserStorage()).toBeNull();
        } finally {
            if (original) Object.defineProperty(globalThis, 'localStorage', original);
            else Reflect.deleteProperty(globalThis, 'localStorage');
        }
    });

    it('returns null when there is no localStorage', () => {
        vi.stubGlobal('localStorage', undefined);
        expect(browserStorage()).toBeNull();
    });
});

describe('Result layout with the best row (docs/spec.md "Result" table)', () => {
    const bestY = resultBestY; // the function Result.place() uses

    it('puts the best row 45 px under the shortest row: y 365 in portrait, 255 in landscape', () => {
        expect(PARAMS.resultBestGap).toBe(45);
        expect(PARAMS.bestKey).toBe('pushline.best');
        expect(PARAMS.bestKey).toBe(bestKey('pushline')); // the shared best-store convention
        expect(bestY(PORTRAIT)).toBe(365);
        expect(bestY(LANDSCAPE)).toBe(255);
        // the row shares the x of the other Result rows: the canvas centre
        expect([PORTRAIT.resultLines.x, LANDSCAPE.resultLines.x]).toEqual([240, 480]);
    });

    it.each([
        ['portrait', PORTRAIT],
        ['landscape', LANDSCAPE],
    ])('keeps the best row clear of the lines row, the shortest row and the buttons in %s', (_name, l) => {
        const halfText = 18; // button-size text is 30 px; 18 is a generous half height
        const y = bestY(l);
        expect(y - halfText).toBeGreaterThan(l.resultLines.y + PARAMS.resultShortestGap + halfText);
        expect(y + halfText).toBeLessThan(l.resultRetry.y);
        expect(y + halfText).toBeLessThan(l.viewH);
    });

    it('leaves the existing Result positions as they were (regression)', () => {
        expect([PORTRAIT.resultLines.y - PARAMS.resultCaptionGap, PORTRAIT.resultLines.y, PORTRAIT.resultLines.y + PARAMS.resultShortestGap]).toEqual([190, 260, 320]);
        expect([PORTRAIT.resultRetry.y + PORTRAIT.resultRetry.h / 2, PORTRAIT.resultToTitle.y + PORTRAIT.resultToTitle.h / 2]).toEqual([480, 600]);
        expect([LANDSCAPE.resultLines.y - PARAMS.resultCaptionGap, LANDSCAPE.resultLines.y, LANDSCAPE.resultLines.y + PARAMS.resultShortestGap]).toEqual([80, 150, 210]);
        expect([LANDSCAPE.resultRetry.y + LANDSCAPE.resultRetry.h / 2, LANDSCAPE.resultToTitle.y + LANDSCAPE.resultToTitle.h / 2]).toEqual([330, 440]);
        expect(PARAMS.resultGuardMs).toBe(400);
    });
});
