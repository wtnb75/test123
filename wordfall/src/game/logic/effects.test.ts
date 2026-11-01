import { describe, expect, it } from 'vitest';
import {
    blinkTween,
    bumpTween,
    countUpValue,
    effectCounts,
    flyPlan,
    ghostTween,
    isLowTime,
    popText,
    popTween,
    shouldBumpTime,
    valueAt,
} from './effects';
import { FONT_POP } from '../params';
import type { PickResult } from './round';

const w = (en: string) => ({ en, ja: '' });

describe('valueAt (linear, clamped)', () => {
    it('is the start at t = 0, the middle halfway and the end from t = duration on', () => {
        expect(valueAt(210, 170, 0, 600)).toBe(210);
        expect(valueAt(210, 170, 300, 600)).toBe(190);
        expect(valueAt(210, 170, 600, 600)).toBe(170);
        expect(valueAt(210, 170, 9999, 600)).toBe(170);
    });

    it('stays at the start before t = 0 and jumps to the end for a zero duration', () => {
        expect(valueAt(0, 10, -5, 100)).toBe(0);
        expect(valueAt(0, 10, 0, 0)).toBe(10);
    });
});

describe('pop-up (docs/spec.md "点数・時間のポップアップ")', () => {
    it('shows the word score and the added seconds: 3 letters +30 +3s, 7 letters +170 +7s, 8 letters +230 +8s', () => {
        expect(popText(3)).toBe('+30  +3s');
        expect(popText(7)).toBe('+170  +7s');
        expect(popText(8)).toBe('+230  +8s');
    });

    it('starts the first pop-up at y = 210 and rises 40 px over 600 ms to y = 170, with no delay', () => {
        expect(popTween(0)).toEqual({ delayMs: 0, fromY: 210, toY: 170, alphaFrom: 1, alphaTo: 0, durationMs: 600 });
    });

    it('fades the pop-up out: opacity 1 at the start, 0.5 at 300 ms, 0 at 600 ms', () => {
        const p = popTween(0);
        expect(valueAt(p.alphaFrom, p.alphaTo, 0, p.durationMs)).toBe(1);
        expect(valueAt(p.alphaFrom, p.alphaTo, 300, p.durationMs)).toBe(0.5);
        expect(valueAt(p.alphaFrom, p.alphaTo, 600, p.durationMs)).toBe(0);
    });

    it('starts the k-th pop-up of one pick 120 ms later and 24 px lower (k = 1: 234, k = 2: 258)', () => {
        expect(popTween(1)).toMatchObject({ delayMs: 120, fromY: 234, toY: 194, durationMs: 600 });
        expect(popTween(2)).toMatchObject({ delayMs: 240, fromY: 258, toY: 218, durationMs: 600 });
    });

    it('keeps pop-ups of one pick apart by more than the text height (FONT_POP), at every moment', () => {
        const a = popTween(0);
        const b = popTween(1);
        for (let t = b.delayMs; t <= a.durationMs; t += 10) {
            const ya = valueAt(a.fromY, a.toY, t - a.delayMs, a.durationMs);
            const yb = valueAt(b.fromY, b.toY, t - b.delayMs, b.durationMs);
            if (yb - ya < FONT_POP) expect.fail(`overlap at t = ${t}: ${ya} vs ${yb}`);
        }
    });

    it('finishes the last of 3 pop-ups at 840 ms, 40 ms after the 800 ms before Result', () => {
        const last = popTween(2);
        expect(last.delayMs + last.durationMs).toBe(840);
    });
});

describe('TIME warning and pulse (docs/spec.md "時間の警告")', () => {
    it('is red at 10 and below, white at 11 and above, and red at 0', () => {
        expect(isLowTime(11)).toBe(false);
        expect(isLowTime(10)).toBe(true);
        expect(isLowTime(1)).toBe(true);
        expect(isLowTime(0)).toBe(true);
    });

    const frame = (prevShown: number, shown: number, completed = false, entersEnding = false) =>
        shouldBumpTime({ completed, prevShown, shown, entersEnding });

    it('pulses on a completion, whatever the time', () => {
        expect(frame(40, 43, true)).toBe(true);
        expect(frame(5, 8, true)).toBe(true);
    });

    it('pulses when the display drops into or inside the warning range: 11 -> 10, 10 -> 9', () => {
        expect(frame(11, 10)).toBe(true);
        expect(frame(10, 9)).toBe(true);
    });

    it('does not pulse for a drop above the warning range: 12 -> 11', () => {
        expect(frame(12, 11)).toBe(false);
    });

    it('pulses once for a drop of several seconds that ends in the warning range: 12 -> 10', () => {
        expect(frame(12, 10)).toBe(true);
    });

    it('does not pulse for the drop that ends the play (1 -> 0), but does for a completion in that frame', () => {
        expect(frame(1, 0, false, true)).toBe(false);
        expect(frame(1, 4, true, true)).toBe(true);
    });

    it('does not pulse when the display did not change or went up without a completion', () => {
        expect(frame(8, 8)).toBe(false);
        expect(frame(8, 9)).toBe(false);
    });

    it('pulses up to 1.25 times in 150 ms and back down in another 150 ms', () => {
        expect(bumpTween()).toEqual({ halfMs: 150, scaleTo: 1.25 });
    });
});

describe('completed-row highlight and flight', () => {
    it('grows to 1.2 times and fades from 0.7 to 0 over 250 ms', () => {
        expect(ghostTween()).toEqual({ durationMs: 250, scaleTo: 1.2, alphaFrom: 0.7, alphaTo: 0 });
    });

    it('flies a letter into the slot numbered by the tray length before the pick (H = 528)', () => {
        const first = flyPlan(0, 528);
        expect(first).toMatchObject({ slot: 0, toX: 36, toY: 452, durationMs: 120 });
        expect(first.scaleTo).toBeCloseTo(1.1, 10); // 44 / 40
        expect(flyPlan(9, 528)).toMatchObject({ slot: 9, toX: 324, toY: 500 });
        expect(flyPlan(5, 528)).toMatchObject({ toX: 36, toY: 500 });
    });
});

describe('effectCounts: what one pick triggers', () => {
    const picked = (n: number): PickResult => ({
        kind: 'picked',
        completed: Array.from({ length: n }, () => w('CAT')),
        rows: Array.from({ length: n }, (_, i) => i),
    });

    it('a pick that completes nothing only flies the letter', () => {
        expect(effectCounts(picked(0))).toEqual({ flash: 0, ghosts: 0, pops: 0, fly: 1, fullHint: 0, shake: 0 });
    });

    it('two completions give one flash and two highlights and pop-ups', () => {
        expect(effectCounts(picked(2))).toEqual({ flash: 1, ghosts: 2, pops: 2, fly: 1, fullHint: 0, shake: 0 });
    });

    it('a pick refused because the tray is full gives the red rim and the shake, and no flight', () => {
        expect(effectCounts({ kind: 'full' })).toEqual({ flash: 0, ghosts: 0, pops: 0, fly: 0, fullHint: 1, shake: 1 });
    });

    it('an ignored pick (after the end) triggers nothing', () => {
        expect(effectCounts({ kind: 'ignored' })).toEqual({ flash: 0, ghosts: 0, pops: 0, fly: 0, fullHint: 0, shake: 0 });
    });
});

describe('Result effects (docs/spec.md "演出・UI（Result）")', () => {
    it('counts the score up: 350 gives 0, 175 at 300 ms, 350 at 600 ms and after', () => {
        expect(countUpValue(0, 350)).toBe(0);
        expect(countUpValue(300, 350)).toBe(175);
        expect(countUpValue(600, 350)).toBe(350);
        expect(countUpValue(900, 350)).toBe(350);
    });

    it('rounds halves up and always shows 0 for a score of 0', () => {
        expect(countUpValue(300, 1)).toBe(1); // 0.5 rounds up
        expect(countUpValue(299, 1)).toBe(0);
        expect(countUpValue(0, 0)).toBe(0);
        expect(countUpValue(600, 0)).toBe(0);
    });

    it('shows 0 before the count starts', () => {
        expect(countUpValue(-50, 350)).toBe(0);
    });

    it('blinks NEW BEST! three times, 300 ms each, after the 600 ms count-up, dipping to 0.2', () => {
        expect(blinkTween()).toEqual({ delayMs: 600, alphaTo: 0.2, halfMs: 150, repeat: 2 });
    });
});
