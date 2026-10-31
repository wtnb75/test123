import { afterEach, describe, expect, it, vi } from 'vitest';
import { PARAMS } from '../params';
import { bestLabel, browserStorage, parseBest, resolveBest, type BestStorage } from './best';
import { LANDSCAPE, PORTRAIT, resultBestY } from './layout';

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

describe('resolveBest (docs/spec.md "ベスト記録")', () => {
    it('shows nothing and writes nothing for 0 lines with nothing saved', () => {
        const s = fakeStorage(null);
        expect(resolveBest(0, s.storage)).toBeNull();
        expect(s.calls).toEqual(['get pushlineBest']);
    });

    it('saves the first result and shows it without the "updated" mark', () => {
        const s = fakeStorage(null);
        expect(resolveBest(5, s.storage)).toEqual({ best: 5, updated: false });
        expect(s.calls).toEqual(['get pushlineBest', 'set pushlineBest=5']);
    });

    it('saves a single line as the first best (1 is the smallest result that counts)', () => {
        const s = fakeStorage(null);
        expect(resolveBest(1, s.storage)).toEqual({ best: 1, updated: false });
        expect(s.value()).toBe('1');
    });

    it('saves a higher result and marks it updated (saved 5, 7 lines)', () => {
        const s = fakeStorage('5');
        expect(resolveBest(7, s.storage)).toEqual({ best: 7, updated: true });
        expect(s.calls).toEqual(['get pushlineBest', 'set pushlineBest=7']);
    });

    it('keeps the saved value on a tie, with no mark and no write (saved 5, 5 lines)', () => {
        const s = fakeStorage('5');
        expect(resolveBest(5, s.storage)).toEqual({ best: 5, updated: false });
        expect(s.calls).toEqual(['get pushlineBest']);
    });

    it('shows the saved value for a lower result without writing (saved 5, 3 lines)', () => {
        const s = fakeStorage('5');
        expect(resolveBest(3, s.storage)).toEqual({ best: 5, updated: false });
        expect(s.value()).toBe('5');
    });

    it('shows the saved value for 0 lines without writing (saved 5, 0 lines)', () => {
        const s = fakeStorage('5');
        expect(resolveBest(0, s.storage)).toEqual({ best: 5, updated: false });
        expect(s.calls).toEqual(['get pushlineBest']);
    });

    it('treats a better result by exactly one line as an update (saved 9, 10 lines)', () => {
        const s = fakeStorage('9');
        expect(resolveBest(10, s.storage)).toEqual({ best: 10, updated: true });
    });

    it.each(['', '0', '-3', '2.5', 'abc', '05', '1e3', '99999999999999999999'])(
        'treats the saved value %j as nothing saved: 4 lines are saved without a mark',
        (raw) => {
            const s = fakeStorage(raw);
            expect(resolveBest(4, s.storage)).toEqual({ best: 4, updated: false });
            expect(s.calls).toEqual(['get pushlineBest', 'set pushlineBest=4']);
        },
    );

    it.each(['', '0', 'abc'])('shows no row for 0 lines when the saved value %j is invalid, and keeps it', (raw) => {
        const s = fakeStorage(raw);
        expect(resolveBest(0, s.storage)).toBeNull();
        expect(s.value()).toBe(raw);
    });

    it.each([Number.NaN, 2.5, -1, Number.POSITIVE_INFINITY, 1e21])(
        'never writes a line count that is not a whole number of lines (%s), and keeps the saved best',
        (lines) => {
            const s = fakeStorage('3');
            expect(resolveBest(lines, s.storage)).toEqual({ best: 3, updated: false });
            expect(s.calls).toEqual(['get pushlineBest']);
        },
    );

    it('shows no row and does not throw when there is no storage', () => {
        expect(resolveBest(5, null)).toBeNull();
    });

    it('shows no row and does not throw when reading throws', () => {
        const storage: BestStorage = {
            getItem: () => {
                throw new Error('denied');
            },
            setItem: () => {
                throw new Error('must not write');
            },
        };
        expect(resolveBest(5, storage)).toBeNull();
    });

    it('shows no row and does not throw when writing throws (quota)', () => {
        const storage: BestStorage = {
            getItem: () => '3',
            setItem: () => {
                throw new Error('quota');
            },
        };
        expect(resolveBest(5, storage)).toBeNull();
    });

    it('compares a later run with the value the earlier run wrote', () => {
        const s = fakeStorage(null);
        expect(resolveBest(6, s.storage)).toEqual({ best: 6, updated: false });
        expect(resolveBest(4, s.storage)).toEqual({ best: 6, updated: false });
        expect(resolveBest(8, s.storage)).toEqual({ best: 8, updated: true });
    });
});

describe('parseBest', () => {
    it('accepts positive integers in plain decimal and rejects everything else', () => {
        expect(parseBest('1')).toBe(1);
        expect(parseBest('40')).toBe(40);
        expect(parseBest('9007199254740991')).toBe(9007199254740991);
        expect(parseBest('9007199254740992')).toBeNull();
        expect(parseBest(null)).toBeNull();
        expect(parseBest(' 5')).toBeNull();
        expect(parseBest('5 ')).toBeNull();
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
        expect(PARAMS.bestKey).toBe('pushlineBest');
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
