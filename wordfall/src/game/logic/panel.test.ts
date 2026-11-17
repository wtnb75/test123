import { describe, expect, it } from 'vitest';
import { freeColumns } from './letters';
import { pickPanelColumn, pickPanelText, planSpawn } from './panel';
import { seq } from './testing';
import type { Word } from './words';

const w = (en: string): Word => ({ en, ja: '' });
const TARGETS = [w('WATER'), w('CAT'), w('DOG')];

describe('pickPanelText (docs/spec/letter-panel.md "パネルの文字列")', () => {
    // draws, in order: length, word, start
    it('takes 2 letters when the length draw is at or above PANEL_LEN3_RATIO (1/3 exactly is still 2)', () => {
        expect(pickPanelText(seq(1 / 3, 0, 0), TARGETS)).toBe('WA');
        expect(pickPanelText(seq(0.9, 0, 0), TARGETS)).toBe('WA');
    });

    it('takes 3 letters when the length draw is below PANEL_LEN3_RATIO', () => {
        expect(pickPanelText(seq(0.33, 0, 0), TARGETS)).toBe('WAT');
    });

    it('reaches the last start of the word at the top of the draw range: WATER gives ER and TER', () => {
        expect(pickPanelText(seq(0.9, 0, 0.999), TARGETS)).toBe('ER');
        expect(pickPanelText(seq(0.2, 0, 0.999), TARGETS)).toBe('TER');
    });

    it('picks the middle start too: ATE is the 2nd of the three 3-letter runs of WATER', () => {
        expect(pickPanelText(seq(0.2, 0, 0.5), TARGETS)).toBe('ATE');
    });

    it('picks one of the words equally: the last word at the top of the range', () => {
        expect(pickPanelText(seq(0.9, 0.999, 0), TARGETS)).toBe('DO');
        expect(pickPanelText(seq(0.9, 0.5, 0), TARGETS)).toBe('CA');
    });

    it('shortens the panel to the word when the word is shorter than the length drawn', () => {
        expect(pickPanelText(seq(0.1, 0, 0.5), [w('AB')])).toBe('AB');
    });

    it('is always a run of the word, whatever the draws', () => {
        for (const a of [0, 0.2, 0.5, 0.999]) {
            for (const b of [0, 0.4, 0.999]) {
                for (const c of [0, 0.5, 0.999]) {
                    const text = pickPanelText(seq(a, b, c), TARGETS);
                    if (!TARGETS.some((t) => t.en.includes(text))) expect.fail(`${text} is no run (${a} ${b} ${c})`);
                    if (text.length < 2 || text.length > 3) expect.fail(`${text} has a bad length`);
                }
            }
        }
    });
});

describe('pickPanelColumn', () => {
    const ALL = [0, 1, 2, 3, 4, 5, 6];

    it('chooses among the 5 starts of a 3-wide panel (0..4) equally', () => {
        expect(pickPanelColumn(seq(0), ALL, 3)).toBe(0);
        expect(pickPanelColumn(seq(0.999), ALL, 3)).toBe(4);
        expect(pickPanelColumn(seq(0.5), ALL, 3)).toBe(2);
    });

    it('chooses among the 6 starts of a 2-wide panel (0..5)', () => {
        expect(pickPanelColumn(seq(0.999), ALL, 2)).toBe(5);
    });

    it('never starts where one of its columns is blocked', () => {
        const free = [0, 1, 3, 4, 6]; // columns 2 and 5 are blocked
        expect(pickPanelColumn(seq(0), free, 2)).toBe(0);
        expect(pickPanelColumn(seq(0.999), free, 2)).toBe(3);
    });

    it('returns -1 when no start has all its columns free (a 3-wide panel with columns 2 and 5 blocked)', () => {
        expect(pickPanelColumn(seq(0), [0, 1, 3, 4, 6], 3)).toBe(-1);
        expect(pickPanelColumn(seq(0), [], 2)).toBe(-1);
    });
});

describe('freeColumns with panels', () => {
    it('blocks every column a panel spans until it has fallen LETTER_SIZE (exactly LETTER_SIZE frees them)', () => {
        const panel = (y: number) => [{ col: 2, span: 3, y }];
        expect(freeColumns(panel(39), 0)).toEqual([0, 1, 5, 6]);
        expect(freeColumns(panel(40), 0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('still treats a letter without a span as one column', () => {
        expect(freeColumns([{ col: 3, y: 0 }], 0)).toEqual([0, 1, 2, 4, 5, 6]);
    });
});

describe('planSpawn (docs/spec/letter-panel.md "出現")', () => {
    // draws: panel?, [length, word, start, column] | [column, letter...]
    it('makes a panel when the first draw is below PANEL_RATIO', () => {
        expect(planSpawn(seq(0.1, 0.9, 0, 0, 0), [], TARGETS, [], 0)).toEqual({ text: 'WA', col: 0 });
    });

    it('makes a single letter when the first draw is exactly PANEL_RATIO (0.15)', () => {
        // column draw 0 -> column 0; needed-letter draw 0 -> the first needed letter, W
        expect(planSpawn(seq(0.15, 0, 0, 0), [], TARGETS, [], 0)).toEqual({ text: 'W', col: 0 });
    });

    it('turns into a single letter when no column start fits the panel', () => {
        const falling = [
            { col: 2, y: 0 },
            { col: 5, y: 0 },
        ];
        // length draw 0.2 -> 3 letters (WAT); columns 2 and 5 blocked -> no start; the beat becomes a letter
        expect(planSpawn(seq(0.1, 0.2, 0, 0, 0), [], TARGETS, falling, 0)).toEqual({ text: 'W', col: 0 });
    });

    it('never makes a panel when the ratio is 0, and always tries when it is 1', () => {
        expect(planSpawn(seq(0), [], TARGETS, [], 0, 0)?.text).toHaveLength(1);
        expect(planSpawn(seq(0.999, 0.9, 0, 0, 0), [], TARGETS, [], 0, 1)?.text).toHaveLength(2);
    });

    it('returns null when every column is held', () => {
        const falling = [{ col: 0, span: 7, y: 0 }];
        expect(planSpawn(seq(0.1), [], TARGETS, falling, 0)).toBeNull();
        expect(planSpawn(seq(0.9), [], TARGETS, falling, 0)).toBeNull();
    });
});
