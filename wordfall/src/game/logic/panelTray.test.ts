// Panels in the tray: cover, completion, removal, cues and picking (docs/spec/letter-panel.md).
import { describe, expect, it } from 'vitest';
import { cueState } from './chance';
import { columnX, panelBandW, panelX } from './layout';
import { neededLetters } from './letters';
import { Round } from './round';
import { START_TIME_SEC } from '../params';
import { letterAtPoint, lowestLetterWithChar } from './targeting';
import { seeded, seq } from './testing';
import { addLetter, canComplete, consume, coverOf, findCompletable, isPanel, matchedMask } from './tray';
import type { Word } from './words';

const w = (en: string): Word => ({ en, ja: '' });
/** A tray from a spaced string: `W A T ER` is W, A, T and the panel ER. */
const T = (s: string): string[] => s.split(' ').filter(Boolean);
const letters = (s: ReadonlySet<string>): string[] => [...s].sort();

describe('isPanel', () => {
    it('tells a panel (2+ letters) from a single letter', () => {
        expect(isPanel('ER')).toBe(true);
        expect(isPanel('ING')).toBe(true);
        expect(isPanel('E')).toBe(false);
    });
});

describe('canComplete with panels ("完成の判定")', () => {
    it('WATER is complete with W A T and the panel ER, and with five single letters', () => {
        expect(canComplete(T('W A T ER'), 'WATER')).toBe(true);
        expect(canComplete(T('W A T E R'), 'WATER')).toBe(true);
    });

    it('WATER is not complete with the panel ER and a single E: W, A, T are missing', () => {
        expect(canComplete(T('ER E'), 'WATER')).toBe(false);
    });

    it('a panel that is not in the spelling is not used and stays out of the way: RE is no run of WATER', () => {
        const cover = coverOf(T('RE W A T E R'), 'WATER');
        expect(cover.panels).toEqual([]);
        expect(cover.covered.every(Boolean)).toBe(true);
    });

    it('a panel alone does not cover a word it is not part of, and the order of its letters matters', () => {
        expect(canComplete(T('ACT'), 'CAT')).toBe(false);
        expect(canComplete(T('CAT'), 'CAT')).toBe(true);
    });

    it('a panel can cover a whole word: CAT', () => {
        expect(findCompletable(T('CAT'), [w('DOG'), w('CAT'), w('SUN')])).toBe(1);
    });

    it('APPLE needs both P: the panel PP covers them, two single P also do, one single P does not', () => {
        expect(canComplete(T('PP A L E'), 'APPLE')).toBe(true);
        expect(canComplete(T('P P A L E'), 'APPLE')).toBe(true);
        expect(canComplete(T('PP A L'), 'APPLE')).toBe(false);
        expect(canComplete(T('P A L E'), 'APPLE')).toBe(false);
    });

    it('TREASURE: RE appears twice (chars 2-3 and 7-8); two RE panels take both places', () => {
        expect(canComplete(T('RE RE T A S U'), 'TREASURE')).toBe(true);
        expect(canComplete(T('RE T R E A S U'), 'TREASURE')).toBe(true);
    });

    it('panels go front to back, each to the leftmost free place: RE before EA blocks EA, EA before RE lets both in', () => {
        // TREASURE = T R E A S U R E; EA is chars 3-4
        const blocked = coverOf(T('RE EA T R S U'), 'TREASURE');
        expect(blocked.panels).toEqual([0]);
        expect(canComplete(T('RE EA T R S U'), 'TREASURE')).toBe(false);
        const both = coverOf(T('EA RE T R S U'), 'TREASURE');
        expect(both.panels).toEqual([0, 1]);
        expect(both.byPanel).toEqual([false, false, true, true, false, false, true, true]);
        expect(canComplete(T('EA RE T R S U'), 'TREASURE')).toBe(true);
    });

    it('an empty tray completes nothing', () => {
        expect(canComplete([], 'CAT')).toBe(false);
    });
});

describe('matchedMask with panels ("お題の文字の色")', () => {
    it('colours the letters a panel covers green and the rest by the single letters', () => {
        expect(matchedMask(T('ER T'), 'WATER')).toEqual([false, false, true, true, true]);
    });

    it('does not colour a word for a panel that does not sit in it', () => {
        expect(matchedMask(T('XY'), 'WATER')).toEqual([false, false, false, false, false]);
        expect(matchedMask(T('ER'), 'CAT')).toEqual([false, false, false]);
    });

    it('is the same as before when the tray has no panels (a letter counts once per copy)', () => {
        expect(matchedMask(T('P A'), 'APPLE')).toEqual([true, true, false, false, false]);
    });

    it('does not count a letter twice: a panel and singles of the same letters cover the word once', () => {
        // PP covers both P of APPLE; the single P is not needed again, so L and E stay grey
        expect(matchedMask(T('PP P A'), 'APPLE')).toEqual([true, true, true, false, false]);
        // WA and TER cover all of WATER; the extra singles change nothing
        expect(matchedMask(T('WA TER W A T'), 'WATER')).toEqual([true, true, true, true, true]);
    });
});

describe('consume with panels ("取り除く")', () => {
    it('takes the used panel out whole and keeps one that does not sit in the word', () => {
        // the panel XY is no part of WATER; CAT (another target) still wants A and T
        expect(consume(T('ER W A T XY'), 'WATER', ['CAT', 'DOG'])).toEqual(T('A T XY'));
    });

    it('counts only the letters no panel covers for the keep rule: a second single T stays for TOP', () => {
        // WATER: ER covers E R; a = 1 for each of W A T; the tray has two single T, TOP wants one
        expect(consume(T('ER W A T T'), 'WATER', ['TOP', 'DOG'])).toEqual(['T']);
    });

    it('takes a panel out whole even when another word spells a letter of it; single letters follow the keep rule', () => {
        // UP is gone (it cannot be split); CAT needs A, T and C, and C: a=1, t=1, m=1 -> max(0, min(1, 1)) = 1 stays
        expect(consume(T('UP A T C'), 'CUP', ['CAT', 'DOG'])).toEqual(T('A T C'));
        // the panel covers U and P, so the single U and P are not taken; only the single C is
        expect(consume(T('UP C U P'), 'CUP', ['DOG', 'SUN'])).toEqual(T('U P'));
    });

    it('with no panels in the tray the result is the old one: DOG removed from D O G X', () => {
        expect(consume(T('D O G X'), 'DOG', ['CAT', 'SUN'])).toEqual(['X']);
    });

    it('keeps the order of what stays', () => {
        expect(consume(T('XY ER Q W A T Z'), 'WATER', [])).toEqual(T('XY Q Z'));
    });

    it('removes nothing when the whole word is covered by letters the other targets keep', () => {
        expect(consume(T('S U N'), 'SUN', ['SUN', 'SUN'])).toEqual(T('S U N'));
    });

    it('leaves panels that the word cannot use untouched even when the word is complete', () => {
        expect(consume(T('RE W A T E R'), 'WATER', [])).toEqual(['RE']);
    });

    it('invariant over random trays: the result is a subsequence, unused panels all stay, used ones all go', () => {
        const rng = seeded(7);
        const words = ['WATER', 'TREASURE', 'APPLE', 'CAT', 'MOUNTAIN'];
        let withPanels = 0;
        for (let n = 0; n < 400; n++) {
            const word = words[Math.floor(rng() * words.length)];
            const tray: string[] = [];
            const size = 1 + Math.floor(rng() * 9);
            for (let i = 0; i < size; i++) {
                if (rng() < 0.4) {
                    const k = 2 + Math.floor(rng() * 2);
                    const start = Math.floor(rng() * (word.length - k + 1));
                    tray.push(word.slice(start, start + k));
                } else {
                    tray.push(String.fromCharCode(65 + Math.floor(rng() * 26)));
                }
            }
            const cover = coverOf(tray, word);
            const rest = consume(tray, word, []);
            let at = 0;
            for (const item of rest) {
                at = tray.indexOf(item, at);
                if (at < 0) expect.fail(`not a subsequence: ${tray.join(' ')} -> ${rest.join(' ')}`);
                at += 1;
            }
            const used = new Set(cover.panels);
            const unusedPanels = tray.filter((it, i) => isPanel(it) && !used.has(i));
            const keptPanels = rest.filter(isPanel);
            // the kept panels are exactly the unused ones (same panels, same order), never a used one
            if (keptPanels.join(',') !== unusedPanels.join(',')) expect.fail(`panels: ${tray.join(' ')} for ${word}`);
            // every used panel is gone and was in the word at its place
            for (const i of cover.panels) {
                if (!word.includes(tray[i])) expect.fail(`used panel ${tray[i]} is no run of ${word}`);
            }
            // the single letters that stay are never more than the tray held (no letter appears from nowhere)
            const had = tray.filter((it) => !isPanel(it)).sort().join('');
            const kept = rest.filter((it) => !isPanel(it)).sort();
            for (const c of new Set(kept)) {
                const left = kept.filter((x) => x === c).length;
                if (left > (had.match(new RegExp(c, 'g')) ?? []).length) expect.fail(`extra ${c}: ${tray.join(' ')}`);
            }
            if (cover.panels.length > 0) withPanels += 1;
        }
        expect(withPanels).toBeGreaterThan(100); // the loop really exercised used panels
    });
});

describe('neededLetters with panels', () => {
    it('does not ask for the letters a panel already covers', () => {
        expect(neededLetters(T('ER'), [w('WATER')])).toEqual(['W', 'A', 'T']);
    });
});

describe('Round with panels', () => {
    const zero = seq(0);

    it('takes a panel into one tray slot and completes the word it spells', () => {
        const r = new Round(zero);
        r.targets = [w('CAT'), w('DOG'), w('SUN')];
        r.tray = ['T'];
        const res = r.pick('CA');
        expect(res.kind === 'picked' && res.completed.map((x) => x.en)).toEqual(['CAT']);
        expect(r.tray).toEqual([]); // CA goes whole, T is not needed by another word
        expect(r.score).toBe(30);
        expect(r.timeLeft).toBe(START_TIME_SEC + 3);
    });

    it('completes two words at once with a panel: UP then A T, pick C -> CAT, then CUP', () => {
        const r = new Round(zero);
        r.targets = [w('CAT'), w('CUP'), w('DOG')];
        r.tray = T('UP A T');
        const res = r.pick('C');
        expect(res.kind === 'picked' && res.completed.map((x) => x.en)).toEqual(['CAT', 'CUP']);
        expect(r.tray).toEqual([]);
        expect(r.score).toBe(30 + 30 + 100);
        expect(r.timeLeft).toBe(START_TIME_SEC + 3 + 3 + 5);
        expect(r.completedCount).toBe(2);
    });

    it('a panel needs a free slot like any letter: a full tray refuses it and stays unchanged', () => {
        const r = new Round(zero);
        r.tray = T('Q Q Q Q Q Q Q Q Q Q');
        expect(r.pick('ER')).toEqual({ kind: 'full' });
        expect(r.tray).toHaveLength(10);
    });

    it('a panel counts as one element of the tray capacity', () => {
        expect(addLetter(T('Q Q Q Q Q Q Q Q Q'), 'ER')).toHaveLength(10);
        expect(addLetter(T('Q Q Q Q Q Q Q Q Q Q'), 'ER')).toBeNull();
    });

    it('discarding a panel removes the whole panel; Backspace takes the last element, panel or letter', () => {
        const r = new Round(zero);
        r.tray = T('A ER B');
        expect(r.discardAt(1)).toBe(true);
        expect(r.tray).toEqual(T('A B'));
        r.tray = T('A ER');
        expect(r.discardLast()).toBe(true);
        expect(r.tray).toEqual(['A']);
    });
});

describe('cueState with panels', () => {
    it('UP A T with CAT CUP DOG: picking C completes two words -> reach C, rows 0 and 1', () => {
        const cue = cueState(T('UP A T'), [w('CAT'), w('CUP'), w('DOG')]);
        expect(letters(cue.reach)).toEqual(['C']);
        expect(cue.reachRows).toEqual([0, 1]);
    });

    it('CA U P: T completes CAT only and C completes CUP only, so there is no reach letter', () => {
        const cue = cueState(T('CA U P'), [w('CAT'), w('CUP'), w('DOG')]);
        expect(letters(cue.reach)).toEqual([]);
    });

    it('counts the letters a panel covers as met for the "near" rule: CAT is 1 short and SCAT 2 short with CA', () => {
        // T is wanted by both near words -> near; S by one word only -> not. A tray that ignored the panel
        // would see CAT 3 short and give no near letter at all.
        const cue = cueState(T('CA'), [w('CAT'), w('SCAT'), w('DOG')]);
        expect(letters(cue.near)).toEqual(['T']);
        expect(letters(cue.reach)).toEqual([]); // T completes CAT, which takes CA whole: SCAT cannot follow
    });
});

describe('panelX', () => {
    it('is the mean of the end columns\' centres: a 3-wide panel at column 0 sits on the centre of column 1', () => {
        expect(panelX(0, 3, 7)).toBeCloseTo(columnX(1, 7), 9);
        expect(panelX(0, 3, 7)).toBeCloseTo(77.142857, 5); // 1.5 * 360 / 7
    });

    it('a 2-wide panel at columns 5-6 sits between them, a 1-wide one on its column', () => {
        expect(panelX(5, 2, 7)).toBeCloseTo(6 * (360 / 7), 9); // (5.5 + 6.5) / 2 columns
        expect(panelX(3, 1, 7)).toBeCloseTo(columnX(3, 7), 9);
    });
});

describe('panelBandW', () => {
    it('is (span - 1) column widths plus a tile: 91.4 for two letters, 142.9 for three (inside 3 columns = 154.3)', () => {
        expect(panelBandW(2, 7)).toBeCloseTo(360 / 7 + 40, 9);
        expect(panelBandW(3, 7)).toBeCloseTo(142.857143, 5);
        expect(panelBandW(3, 7)).toBeLessThan(3 * (360 / 7));
    });
});

describe('picking a panel (docs/spec/letter-panel.md "操作仕様")', () => {
    const panel = { ch: 'ER', x: 100, y: 100 };
    const ING = { ch: 'ING', x: 200, y: 100 };

    it('the tap area is LETTER_HIT_SIZE per letter wide: 100 for two, 150 for three, 50 high', () => {
        expect(letterAtPoint([panel], 149, 100)).toBe(panel);
        expect(letterAtPoint([panel], 151, 100)).toBeUndefined();
        expect(letterAtPoint([ING], 275, 100)).toBe(ING);
        expect(letterAtPoint([ING], 276, 100)).toBeUndefined();
        expect(letterAtPoint([panel], 100, 125)).toBe(panel);
        expect(letterAtPoint([panel], 100, 126)).toBeUndefined();
    });

    it('where a panel and a single letter overlap, the nearer centre wins', () => {
        const single = { ch: 'A', x: 130, y: 100 };
        expect(letterAtPoint([panel, single], 118, 100)).toBe(single); // 12 from the letter, 18 from the panel
        expect(letterAtPoint([panel, single], 110, 100)).toBe(panel); // 10 from the panel, 20 from the letter
    });

    it('a panel and the single letters in the next columns never take each other\'s taps (real column centres)', () => {
        const colPanel = { ch: 'ER', x: panelX(2, 2, 7), y: 100 }; // columns 2-3, centre 154.29
        const right = { ch: 'A', x: columnX(4, 7), y: 100 }; // 231.43; its area starts at 206.43
        const left = { ch: 'B', x: columnX(1, 7), y: 100 }; // 77.14; its area ends at 102.14
        const all = [left, colPanel, right];
        expect(letterAtPoint(all, 204, 100)).toBe(colPanel); // inside the panel's right end (204.29)
        expect(letterAtPoint(all, 205.3, 100)).toBeUndefined(); // in the 2.1 px gap
        expect(letterAtPoint(all, 207, 100)).toBe(right);
        expect(letterAtPoint(all, 102, 100)).toBe(left);
        expect(letterAtPoint(all, 103, 100)).toBeUndefined();
        expect(letterAtPoint(all, 105, 100)).toBe(colPanel); // inside the panel's left end (104.29)
    });

    it('overlapping panels one above the other: equal distance picks the lower one', () => {
        const upper = { ch: 'ER', x: 100, y: 90 };
        const lower = { ch: 'ER', x: 100, y: 110 };
        expect(letterAtPoint([upper, lower], 100, 100)).toBe(lower);
    });

    it('a letter key never picks a panel, even when the panel holds that letter', () => {
        const single = { ch: 'E', x: 10, y: 10 };
        expect(lowestLetterWithChar([panel], 'E')).toBeUndefined();
        expect(lowestLetterWithChar([panel], 'R')).toBeUndefined();
        expect(lowestLetterWithChar([panel, single], 'E')).toBe(single);
    });
});
