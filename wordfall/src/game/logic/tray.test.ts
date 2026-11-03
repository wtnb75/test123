import { describe, expect, it } from 'vitest';
import { seq } from './testing';
import { addLetter, canComplete, consume, findCompletable, matchedMask, removeAt, resolveCompletions } from './tray';
import type { Word } from './words';

const w = (en: string): Word => ({ en, ja: '' });
const L = (s: string): string[] => [...s];

describe('canComplete', () => {
    it('needs both Ps of APPLE: one P is not enough, two are', () => {
        expect(canComplete(L('APLE'), 'APPLE')).toBe(false);
        expect(canComplete(L('APPLE'), 'APPLE')).toBe(true);
    });

    it('accepts extra letters and any order', () => {
        expect(canComplete(L('XTACZ'), 'CAT')).toBe(true);
    });

    it('is false for an empty tray and when one letter is missing', () => {
        expect(canComplete([], 'CAT')).toBe(false);
        expect(canComplete(L('CA'), 'CAT')).toBe(false);
    });
});

describe('findCompletable', () => {
    it('returns the first completable target, top row first', () => {
        const targets = [w('CAT'), w('DOG'), w('SUN')];
        expect(findCompletable(L('GODSUNTAC'), targets)).toBe(0);
        expect(findCompletable(L('GODSUN'), targets)).toBe(1);
        expect(findCompletable(L('XYZ'), targets)).toBe(-1);
    });
});

describe('consume', () => {
    it('removes one copy of each letter and keeps the others in order', () => {
        expect(consume(L('XCATY'), 'CAT')).toEqual(['X', 'Y']);
        expect(consume(L('CATA'), 'CAT')).toEqual(['A']);
    });

    it('leaves the tray alone for letters it does not hold', () => {
        expect(consume(L('XY'), 'CAT')).toEqual(['X', 'Y']);
    });

    it('does not change its input', () => {
        const tray = L('CAT');
        consume(tray, 'CAT');
        expect(tray).toEqual(L('CAT'));
    });
});

describe('consume keeps the letters the other words still need (docs/spec.md "完成")', () => {
    it('keeps the C that CUP needs when CAT completes: A T U P C -> U P C', () => {
        expect(consume(L('ATUPC'), 'CAT', ['CUP', 'DOG'])).toEqual(['U', 'P', 'C']);
    });

    it('takes out letters no other word needs, as before: D O G X with CAT and SUN left -> X', () => {
        expect(consume(L('DOGX'), 'DOG', ['CAT', 'SUN'])).toEqual(['X']);
    });

    it('keeps max(t - a, min(t, m)) copies: APPLE with A P P L E P and PICTURE left -> E P (P: max(1, min(3, 1)) = 1, E kept)', () => {
        expect(consume(L('APPLEP'), 'APPLE', ['PICTURE', 'DOG'])).toEqual(['E', 'P']);
    });

    it('keeps more copies than the leftover when another word needs two: P P I T, word PIT, other APPLE -> P P', () => {
        expect(consume(L('PPIT'), 'PIT', ['APPLE'])).toEqual(['P', 'P']);
    });

    it('counts one copy for several words that need the same letter', () => {
        expect(consume(L('CAT'), 'CAT', ['CUP', 'COT'])).toEqual(['C', 'T']);
    });

    it('keeps one copy, not two, when two other words each need one C: C C A T with CAT done, CUP and COT left -> C T', () => {
        expect(consume(L('CCAT'), 'CAT', ['CUP', 'COT'])).toEqual(['C', 'T']);
    });

    it('takes the copies nearest the front first', () => {
        expect(consume(L('CXCC'), 'C', [])).toEqual(['X', 'C', 'C']);
        expect(consume(L('CXCC'), 'CC', ['CAT'])).toEqual(['X', 'C']);
    });

    it('does nothing for a letter the tray does not hold even if another word needs it', () => {
        expect(consume(L('X'), 'CAT', ['CUP'])).toEqual(['X']);
    });

    it('removes nothing when every letter of the word is needed by the others', () => {
        expect(consume(L('SUN'), 'SUN', ['SKY', 'MOUNTAIN'])).toEqual(['S', 'U', 'N']);
    });
});

describe('matchedMask', () => {
    it('marks APPLE letters covered by the tray A, P', () => {
        expect(matchedMask(L('PA'), 'APPLE')).toEqual([true, true, false, false, false]);
    });

    it('marks only the later Ps when the tray has two Ps and no A', () => {
        expect(matchedMask(L('PP'), 'APPLE')).toEqual([false, true, true, false, false]);
    });

    it('is all grey for an empty tray and all green for a complete one', () => {
        expect(matchedMask([], 'CAT')).toEqual([false, false, false]);
        expect(matchedMask(L('TAC'), 'CAT')).toEqual([true, true, true]);
    });
});

describe('addLetter / removeAt', () => {
    it('appends a letter without changing the input', () => {
        const tray = L('AB');
        expect(addLetter(tray, 'C')).toEqual(L('ABC'));
        expect(tray).toEqual(L('AB'));
    });

    it('refuses a letter when the tray holds 10 and accepts at 9', () => {
        expect(addLetter(L('ZZZZZZZZZZ'), 'A')).toBeNull();
        expect(addLetter(L('ZZZZZZZZZ'), 'A')).toHaveLength(10);
    });

    it('removes the letter at an index and closes the gap', () => {
        expect(removeAt(L('ABCD'), 1)).toEqual(L('ACD'));
        expect(removeAt(L('ABCD'), 3)).toEqual(L('ABC'));
    });

    it('returns a copy for an index outside the tray', () => {
        const tray = L('AB');
        const same = removeAt(tray, 2);
        expect(same).toEqual(L('AB'));
        expect(same).not.toBe(tray);
        expect(removeAt(tray, -1)).toEqual(L('AB'));
    });
});

describe('resolveCompletions', () => {
    const targets = [w('CAT'), w('DOG'), w('SUN')];

    it('changes nothing when no target is complete', () => {
        const res = resolveCompletions(L('CA'), targets, seq(0));
        expect(res.completed).toEqual([]);
        expect(res.drawn).toEqual([]);
        expect(res.tray).toEqual(L('CA'));
        expect(res.targets).toEqual(targets);
    });

    it('completes the top row first and replaces it with a word that is not on screen', () => {
        const res = resolveCompletions(L('TACX'), targets, seq(0));
        expect(res.completed.map((x) => x.en)).toEqual(['CAT']);
        // with a constant 0 the replacement is the first listed word not on screen: SKY (CAT is excluded too)
        expect(res.targets.map((x) => x.en)).toEqual(['SKY', 'DOG', 'SUN']);
        expect(res.tray).toEqual(['X']);
    });

    it('reports the row each completed word was in (0 = top)', () => {
        expect(resolveCompletions(L('NUS'), targets, seq(0)).rows).toEqual([2]); // SUN is the third row
        expect(resolveCompletions(L('GODTAC'), targets, seq(0)).rows).toEqual([0, 1]);
        // the chain case: the row that completed CAT draws SKY, which completes at once in the same row
        expect(resolveCompletions(L('SKYTAC'), targets, seq(0)).rows).toEqual([0, 0]);
        expect(resolveCompletions(L('CA'), targets, seq(0)).rows).toEqual([]);
    });

    it('completes two targets from one tray, top first, each replaced in place', () => {
        const res = resolveCompletions(L('GODTAC'), targets, seq(0));
        expect(res.completed.map((x) => x.en)).toEqual(['CAT', 'DOG']);
        // CAT's row draws SKY (excluding CAT, DOG, SUN); DOG's row then draws CAT (excluding SKY, DOG, SUN)
        expect(res.drawn.map((x) => x.en)).toEqual(['SKY', 'CAT']);
        expect(res.targets.map((x) => x.en)).toEqual(['SKY', 'CAT', 'SUN']);
        expect(res.tray).toEqual([]);
    });

    it('keeps completing when a replacement is already spelled by the leftover letters', () => {
        // CAT completes, its row becomes SKY, and the leftover S, K, Y spell it at once
        const res = resolveCompletions(L('SKYTAC'), targets, seq(0));
        expect(res.completed.map((x) => x.en)).toEqual(['CAT', 'SKY']);
        expect(res.drawn.map((x) => x.en)).toEqual(['SKY', 'CAT']);
        expect(res.targets.map((x) => x.en)).toEqual(['CAT', 'DOG', 'SUN']);
        // SKY's S stays: SUN, still on screen, needs it
        expect(res.tray).toEqual(['S']);
    });

    it('completes two words from one pick when the shared letter stays: A T U P C with CAT, CUP, DOG', () => {
        const res = resolveCompletions(L('ATUPC'), [w('CAT'), w('CUP'), w('DOG')], seq(0));
        expect(res.completed.map((x) => x.en)).toEqual(['CAT', 'CUP']);
        expect(res.rows).toEqual([0, 1]);
        // CAT's row draws SUN (CAT, CUP, DOG are excluded); then CUP's row draws CAT (SUN, CUP, DOG are excluded)
        expect(res.drawn.map((x) => x.en)).toEqual(['SUN', 'CAT']);
        expect(res.targets.map((x) => x.en)).toEqual(['SUN', 'CAT', 'DOG']);
        // CUP's U stays because the new SUN needs it
        expect(res.tray).toEqual(['U']);
    });

    it('takes the C out when no word on screen needs it, so only CAT completes: A T U P C with CAT, DOG, SUN', () => {
        const res = resolveCompletions(L('ATUPC'), [w('CAT'), w('DOG'), w('SUN')], seq(0));
        expect(res.completed.map((x) => x.en)).toEqual(['CAT']);
        expect(res.tray).toEqual(['U', 'P']);
    });

    it('counts a completion that removes no letters and replaces its row', () => {
        const res = resolveCompletions(L('SUN'), [w('SUN'), w('SKY'), w('MOUNTAIN')], seq(0));
        expect(res.completed.map((x) => x.en)).toEqual(['SUN']);
        expect(res.tray).toEqual(['S', 'U', 'N']);
        expect(res.targets.map((x) => x.en)).toEqual(['CAT', 'SKY', 'MOUNTAIN']);
    });

    it('does not change its inputs', () => {
        const tray = L('TAC');
        const before = [...targets];
        resolveCompletions(tray, targets, seq(0));
        expect(tray).toEqual(L('TAC'));
        expect(targets).toEqual(before);
    });
});

// ---- independent oracle -------------------------------------------------------------------------------

/** Letters of `s` equal to `c` among the first `n` characters. */
const countIn = (s: string[], c: string, n = s.length): number => s.slice(0, n).filter((x) => x === c).length;

describe('oracle: every small tray and word over {A, B}', () => {
    const strings = (maxLen: number): string[][] => {
        const out: string[][] = [[]];
        for (let len = 1; len <= maxLen; len++) {
            for (let n = 0; n < 2 ** len; n++) {
                out.push([...n.toString(2).padStart(len, '0')].map((b) => (b === '0' ? 'A' : 'B')));
            }
        }
        return out;
    };

    it('matchedMask(i) is true exactly when the tray holds at least as many copies as the i-th letter needs so far', () => {
        let green = 0;
        let grey = 0;
        for (const tray of strings(4)) {
            for (const word of strings(4)) {
                if (word.length === 0) continue;
                const mask = matchedMask(tray, word.join(''));
                word.forEach((c, i) => {
                    const expected = countIn(word, c, i + 1) <= countIn(tray, c);
                    if (mask[i] !== expected) expect.fail(`tray ${tray.join('')} word ${word.join('')} index ${i}`);
                    if (expected) green++;
                    else grey++;
                });
            }
        }
        expect(green).toBeGreaterThan(0);
        expect(grey).toBeGreaterThan(0);
    });

    it('canComplete is true exactly when every letter of the word is green', () => {
        let yes = 0;
        let no = 0;
        for (const tray of strings(4)) {
            for (const word of strings(4)) {
                if (word.length === 0) continue;
                const expected = word.every((c, i) => countIn(word, c, i + 1) <= countIn(tray, c));
                if (canComplete(tray, word.join('')) !== expected) {
                    expect.fail(`tray ${tray.join('')} word ${word.join('')}`);
                }
                if (expected) yes++;
                else no++;
            }
        }
        expect(yes).toBeGreaterThan(0);
        expect(no).toBeGreaterThan(0);
    });

    it('consume with other words keeps max(t - a, min(t, m)) copies per letter and the order of what stays', () => {
        // The oracle scans left to right with a per-letter removal budget (an independent route to the same spec rule).
        const oracle = (tray: string[], word: string[], others: string[][]): string[] => {
            const budget: Record<string, number> = {};
            for (const c of 'AB') {
                const t = countIn(tray, c);
                const a = countIn(word, c);
                const m = Math.max(0, ...others.map((o) => countIn(o, c)));
                const keep = Math.max(t - a, Math.min(t, m));
                budget[c] = t - keep;
            }
            return tray.filter((c) => {
                if (budget[c] > 0) {
                    budget[c] -= 1;
                    return false;
                }
                return true;
            });
        };
        const pool = strings(3).filter((s) => s.length > 0);
        const otherSets: string[][][] = [[], ...pool.map((o) => [o]), ...pool.flatMap((o) => pool.map((p) => [o, p]))];
        let keptMore = 0;
        let removedSome = 0;
        for (const tray of strings(4)) {
            for (const word of pool) {
                if (!canComplete(tray, word.join(''))) continue;
                for (const others of otherSets) {
                    const got = consume(tray, word.join(''), others.map((o) => o.join('')));
                    const want = oracle(tray, word, others);
                    if (got.join('') !== want.join('')) {
                        expect.fail(`tray ${tray.join('')} word ${word.join('')} others ${others.map((o) => o.join('')).join(',')}`);
                    }
                    if (got.length > tray.length - word.length) keptMore++;
                    if (got.length < tray.length) removedSome++;
                }
            }
        }
        expect(keptMore).toBeGreaterThan(0);
        expect(removedSome).toBeGreaterThan(0);
    });

    it('consume leaves the tray size minus the word size when the tray completes the word', () => {
        let checked = 0;
        for (const tray of strings(4)) {
            for (const word of strings(3)) {
                if (word.length === 0 || !canComplete(tray, word.join(''))) continue;
                const rest = consume(tray, word.join(''));
                if (rest.length !== tray.length - word.length) expect.fail(`${tray.join('')} - ${word.join('')}`);
                for (const c of 'AB') {
                    if (countIn(rest, c) !== countIn(tray, c) - countIn(word, c)) expect.fail(`count ${c}`);
                }
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(0);
    });
});
