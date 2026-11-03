import { describe, expect, it } from 'vitest';
import { cueState, haloAlpha, NO_CUE, nextReachClock, pulse, reachScale, rowRimAlpha } from './chance';
import { canComplete, resolveCompletions } from './tray';
import { seq } from './testing';
import { WORDS, type Word } from './words';

const w = (en: string): Word => ({ en, ja: '' });
const L = (s: string): string[] => [...s];
const letters = (s: ReadonlySet<string>): string[] => [...s].sort();

describe('cueState: reach letters (docs/spec/multi-complete.md "手がかりの状態")', () => {
    it('finds C when picking it completes CAT and CUP together: tray A T U P, words CAT CUP DOG', () => {
        const cue = cueState(L('ATUP'), [w('CAT'), w('CUP'), w('DOG')]);
        expect(letters(cue.reach)).toEqual(['C']);
        expect(cue.reachRows).toEqual([0, 1]);
        expect(letters(cue.near)).toEqual([]);
    });

    it('lists every row that completes, across the words: tray A T U P O, words CAT CUP COT -> rows 0, 1, 2', () => {
        const cue = cueState(L('ATUPO'), [w('CAT'), w('CUP'), w('COT')]);
        expect(letters(cue.reach)).toEqual(['C']);
        expect(cue.reachRows).toEqual([0, 1, 2]);
    });

    it('is not reach when the pick completes only one word', () => {
        const cue = cueState(L('AT'), [w('CAT'), w('DOG'), w('SUN')]);
        expect(letters(cue.reach)).toEqual([]);
        expect(cue.reachRows).toEqual([]);
    });

    it('has no reach letter when the tray is full, because the pick would be refused', () => {
        const cue = cueState(L('ATUPZZZZZZ'), [w('CAT'), w('CUP'), w('DOG')]);
        expect(letters(cue.reach)).toEqual([]);
        expect(cue.reachRows).toEqual([]);
    });

    it('still finds reach with 9 letters in the tray (one slot left)', () => {
        const cue = cueState(L('ATUPZZZZZ'), [w('CAT'), w('CUP'), w('DOG')]);
        expect(letters(cue.reach)).toEqual(['C']);
    });

    it('promises at least what really happens: every reach letter completes 2+ words in resolveCompletions', () => {
        let checked = 0;
        const targets = [w('CAT'), w('CUP'), w('DOG')];
        for (const tray of [L('ATUP'), L('ATUPX'), L('ATUPDOG')]) {
            for (const c of cueState(tray, targets).reach) {
                const res = resolveCompletions([...tray, c], targets, seq(0));
                if (res.completed.length < 2) expect.fail(`${tray.join('')} + ${c}`);
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(0);
    });
});

describe('cueState: near letters', () => {
    it('marks C when CAT (short C, T) and CUP (short C, P) both nearly need it: tray A U', () => {
        const cue = cueState(L('AU'), [w('CAT'), w('CUP'), w('DOG')]);
        expect(letters(cue.reach)).toEqual([]);
        expect(letters(cue.near)).toEqual(['C']);
    });

    it('keeps near for a full tray, where the reach letter would be refused', () => {
        const cue = cueState(L('ATUPZZZZZZ'), [w('CAT'), w('CUP'), w('DOG')]);
        expect(letters(cue.near)).toEqual(['C']);
    });

    it('never puts a letter in both sets', () => {
        const cue = cueState(L('ATUP'), [w('CAT'), w('CUP'), w('DOG')]);
        expect(letters(cue.near).filter((c) => cue.reach.has(c))).toEqual([]);
    });

    it('counts a word short by exactly 2 and ignores one short by 3: only CAT and CAP count for C', () => {
        const cue = cueState(L('A'), [w('CAT'), w('CAP'), w('CUPS')]);
        expect(letters(cue.near)).toEqual(['C']);
    });

    it('needs two words: C is not near when only one word within reach needs it', () => {
        const cue = cueState(L('A'), [w('CAT'), w('CUPS'), w('DOG')]);
        expect(letters(cue.near)).toEqual([]);
    });

    it('ignores a word short by exactly 3 (the 2 + 1 case): COT does not make T near together with CAT', () => {
        const cue = cueState(L('A'), [w('CAT'), w('CAP'), w('COT')]);
        // C is near through CAT and CAP (both short by 2); COT is short C, O, T = 3, so it would be the only
        // second word for T (with CAT) if the limit were 3, and T must not be near
        expect(letters(cue.near)).toEqual(['C']);
    });

    it('has no cue for an empty tray (every word is short by 3 or more)', () => {
        const cue = cueState([], [w('CAT'), w('CUP'), w('DOG')]);
        expect(letters(cue.reach)).toEqual([]);
        expect(letters(cue.near)).toEqual([]);
        expect(cue.reachRows).toEqual([]);
    });
});

describe('oracle: cueState over every small tray and word set from {A, B}', () => {
    const bits = (maxLen: number): string[] => {
        const out: string[] = [''];
        for (let len = 1; len <= maxLen; len++) {
            for (let n = 0; n < 2 ** len; n++) out.push(n.toString(2).padStart(len, '0').replace(/0/g, 'A').replace(/1/g, 'B'));
        }
        return out;
    };
    const count = (s: string, c: string): number => [...s].filter((x) => x === c).length;
    const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    /** How many of `words` (top first) complete when `tray` is the tray: written with per-letter counters. */
    const completes = (tray: string, words: string[]): number[] => {
        let have = tray;
        const live = words.map((en, row) => ({ en, row }));
        const rows: number[] = [];
        for (;;) {
            const idx = live.findIndex((w) => [...'AB'].every((c) => count(have, c) >= count(w.en, c)));
            if (idx < 0) return rows;
            const [done] = live.splice(idx, 1);
            rows.push(done.row);
            let next = '';
            const budget: Record<string, number> = {};
            for (const c of 'AB') {
                const t = count(have, c);
                const m = Math.max(0, ...live.map((w) => count(w.en, c)));
                budget[c] = t - Math.max(t - count(done.en, c), Math.min(t, m));
            }
            for (const ch of have) {
                if (budget[ch] > 0) budget[ch] -= 1;
                else next += ch;
            }
            have = next;
        }
    };

    it('reach is exactly the letters whose pick completes 2+ of the current words, near follows its definition', () => {
        const wordPool = ['A', 'AB', 'AAB', 'ABB', 'BB'];
        const sets: string[][] = [];
        for (let i = 0; i < wordPool.length; i++)
            for (let j = i + 1; j < wordPool.length; j++)
                for (let k = j + 1; k < wordPool.length; k++) sets.push([wordPool[i], wordPool[j], wordPool[k]]);
        let reachCases = 0;
        let nearCases = 0;
        let emptyCases = 0;
        for (const tray of bits(4)) {
            for (const words of sets) {
                const cue = cueState(L(tray), words.map(w));
                const wantReach = new Set<string>();
                const wantRows = new Set<number>();
                if (tray.length < 10) {
                    for (const c of ALPHABET) {
                        const rows = completes(tray + c, words);
                        if (rows.length >= 2) {
                            wantReach.add(c);
                            rows.forEach((r) => wantRows.add(r));
                        }
                    }
                }
                // near: a letter the word still lacks (more copies in the word than in the tray), short by <= 2 in total
                const wantNear = new Set<string>();
                for (const c of 'AB') {
                    const asking = words.filter((en) => {
                        const short = [...'AB'].reduce((s, x) => s + Math.max(0, count(en, x) - count(tray, x)), 0);
                        return count(en, c) > count(tray, c) && short >= 1 && short <= 2;
                    });
                    if (asking.length >= 2 && !wantReach.has(c)) wantNear.add(c);
                }
                if (letters(cue.reach).join('') !== [...wantReach].sort().join('')) expect.fail(`reach: ${tray} / ${words}`);
                if (cue.reachRows.join(',') !== [...wantRows].sort((a, b) => a - b).join(',')) expect.fail(`rows: ${tray} / ${words}`);
                if (letters(cue.near).join('') !== [...wantNear].sort().join('')) expect.fail(`near: ${tray} / ${words}`);
                if (wantReach.size > 0) reachCases++;
                if (wantNear.size > 0) nearCases++;
                if (wantReach.size === 0 && wantNear.size === 0) emptyCases++;
            }
        }
        expect(reachCases).toBeGreaterThan(0);
        expect(nearCases).toBeGreaterThan(0);
        expect(emptyCases).toBeGreaterThan(0);
    });
});

describe('reach versus the real completion over the real word list', () => {
    it('every reach letter really completes those words (and at least 2) for every pair of listed words that share a letter', () => {
        let pairs = 0;
        for (const a of WORDS) {
            for (const b of WORDS) {
                if (a.en >= b.en) continue;
                const shared = [...a.en].find((c) => b.en.includes(c));
                if (shared === undefined) continue;
                // The most of each letter either word needs, minus one copy of the shared letter: a state play can
                // reach (neither word is complete yet) where one pick of the shared letter finishes both
                const tray: string[] = [];
                for (const x of new Set([...a.en, ...b.en])) {
                    const need = Math.max([...a.en].filter((y) => y === x).length, [...b.en].filter((y) => y === x).length);
                    for (let i = 0; i < need - (x === shared ? 1 : 0); i++) tray.push(x);
                }
                if (tray.length > 9) continue;
                const third = WORDS.find((x) => x.en !== a.en && x.en !== b.en);
                if (!third) continue;
                const targets = [a, b, third];
                if (targets.some((t) => canComplete(tray, t.en))) continue; // play would have completed it already
                const cue = cueState(tray, targets);
                const realRows = new Set<string>();
                for (const c of cue.reach) {
                    const real = resolveCompletions([...tray, c], targets, seq(0)).completed.map((x) => x.en);
                    if (real.length < 2) expect.fail(`${a.en}/${b.en} + ${c}: real ${real.join(',')}`);
                    real.forEach((en) => realRows.add(en));
                }
                for (const row of cue.reachRows) {
                    if (!realRows.has(targets[row].en)) expect.fail(`${a.en}/${b.en}: row ${row} not completed`);
                }
                if (cue.reach.has(shared)) pairs++;
            }
        }
        expect(pairs).toBeGreaterThan(0);
    });
});

describe('pulse and its values (REACH_PULSE_MS = 400)', () => {
    it('is a triangle wave: 0 at 0, 0.5 at 100, 1 at 200, 0.5 at 300, 0 at 400', () => {
        expect([0, 100, 200, 300, 400].map((t) => pulse(t))).toEqual([0, 0.5, 1, 0.5, 0]);
    });

    it('repeats every period: 500 -> 0.5, 600 -> 1, and before the start it still lies in [0, 1] (-100 -> 0.5)', () => {
        expect(pulse(500)).toBe(0.5);
        expect(pulse(600)).toBe(1);
        expect(pulse(-100)).toBe(0.5);
    });

    it('scales the tile 1.0 to 1.15, the halo 0.25 to 0.7 and the row frame 1 to 0.4', () => {
        expect(reachScale(0)).toBe(1);
        expect(reachScale(1)).toBeCloseTo(1.15, 10);
        expect(haloAlpha(0)).toBeCloseTo(0.25, 10);
        expect(haloAlpha(1)).toBeCloseTo(0.7, 10);
        expect(rowRimAlpha(0)).toBe(1);
        expect(rowRimAlpha(1)).toBeCloseTo(0.4, 10);
    });
});

describe('nextReachClock', () => {
    it('starts at 0 when the reach set becomes non-empty and is dropped when it empties', () => {
        expect(nextReachClock(-1, new Set(['C']))).toBe(0);
        expect(nextReachClock(-1, new Set())).toBe(-1);
        expect(nextReachClock(250, new Set())).toBe(-1);
    });

    it('keeps counting when the set changes but stays non-empty', () => {
        expect(nextReachClock(250, new Set(['C', 'E']))).toBe(250);
    });
});

describe('NO_CUE', () => {
    it('is empty everywhere', () => {
        expect(NO_CUE.reach.size).toBe(0);
        expect(NO_CUE.near.size).toBe(0);
        expect(NO_CUE.reachRows).toEqual([]);
    });
});
