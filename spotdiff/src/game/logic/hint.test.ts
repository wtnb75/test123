import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import type { Diff, Stage } from './generate';
import { hintTarget, inHintSquare } from './hint';
import { Run } from './run';

const diff = (index: number, x: number, y: number): Diff => ({ kind: 'color', index, x, y, r: 20 });
const A = { x: 100, y: 100 };
const B = { x: 300, y: 200 };
const C = { x: 500, y: 300 };

const fakeStage = (stage: number): Stage => ({
    stage,
    shapes: [],
    left: [],
    right: [],
    diffs: [diff(0, A.x, A.y), diff(1, B.x, B.y), diff(2, C.x, C.y)],
    bgHue: 0,
    dots: [],
});

const newRun = () => new Run({ date: 20261006, setNo: 1, makeStage: fakeStage });

describe('hintTarget', () => {
    it('picks the undiscovered difference with the smallest index', () => {
        expect(hintTarget(fakeStage(1).diffs, new Set([0]))).toBe(1);
        expect(hintTarget(fakeStage(1).diffs, new Set())).toBe(0);
    });

    it('is null when every difference is already found', () => {
        expect(hintTarget(fakeStage(1).diffs, new Set([0, 1, 2]))).toBeNull();
    });
});

describe('inHintSquare', () => {
    it('counts the edges and the centre as inside, and a point just past an edge as outside', () => {
        expect(inHintSquare(50, 50, 50, 50, 136)).toBe(true);
        expect(inHintSquare(118, 50, 50, 50, 136)).toBe(true); // right edge (50 + 68)
        expect(inHintSquare(118.5, 50, 50, 50, 136)).toBe(false);
        expect(inHintSquare(50, -18, 50, 50, 136)).toBe(true); // top edge (50 - 68)
        expect(inHintSquare(50, -18.5, 50, 50, 136)).toBe(false);
    });
});

describe('Run: the HINT', () => {
    it('marks the smallest undiscovered difference, costs the penalty, and shows for hintShowMs', () => {
        const run = newRun();
        const before = run.timeLeft;
        expect(run.useHint()).toBe(0);
        expect(run.hintUsed).toBe(true);
        expect(run.hintShown).toBe(0);
        expect(run.timeLeft).toBeCloseTo(before - PARAMS.hintPenaltySec, 9);
    });

    it('works once per stage: a second press does nothing', () => {
        const run = newRun();
        run.useHint();
        const left = run.timeLeft;
        expect(run.useHint()).toBeNull();
        expect(run.timeLeft).toBe(left);
    });

    it('hides the circle after exactly hintShowMs (1499 ms still shows it, 1500 ms ends it)', () => {
        const run = newRun();
        run.useHint();
        run.tick(1499);
        expect(run.hintShown).toBe(0);
        run.tick(1);
        expect(run.hintShown).toBeNull();
    });

    it('does not count the circle time while paused', () => {
        const run = newRun();
        run.useHint();
        run.hide();
        const left = run.timeLeft;
        run.tick(5000);
        expect(run.hintMs).toBe(PARAMS.hintShowMs);
        expect(run.timeLeft).toBe(left);
        expect(run.useHint()).toBeNull();
    });

    it('is not available outside the play (clear, paused)', () => {
        const run = newRun();
        run.click(A.x, A.y);
        run.click(B.x, B.y);
        run.click(C.x, C.y);
        expect(run.phase).toBe('clear');
        expect(run.useHint()).toBeNull();
    });

    it('a time-up by the clock ends the stage and clears the circle, and no hint is left to use', () => {
        const run = newRun();
        run.timeLeft = 6;
        run.useHint(); // 1 s left, the circle shows
        expect(run.hintShown).toBe(0);
        run.timeLeft = 0.01;
        run.tick(100); // the clock runs out while the circle still shows
        expect(run.phase).toBe('over');
        expect(run.hintShown).toBeNull();
        expect(run.useHint()).toBeNull();
    });

    it('a miss that uses up the time ends the stage and clears the circle', () => {
        const run = newRun();
        run.timeLeft = 10;
        run.useHint(); // 5 s left after the hint
        expect(run.click(0, 0)).toBe('miss'); // 5 s penalty: 0 left
        expect(run.phase).toBe('over');
        expect(run.hintShown).toBeNull();
    });

    it('ends the circle when the marked difference is found', () => {
        const run = newRun();
        run.useHint();
        expect(run.click(A.x, A.y)).toBe('hit');
        expect(run.hintShown).toBeNull();
    });

    it('a press that costs all the time ends the stage as time-up and clears the circle', () => {
        const run = newRun();
        run.timeLeft = 4;
        run.useHint();
        expect(run.timeLeft).toBe(0);
        expect(run.phase).toBe('over');
        expect(run.hintShown).toBeNull();
    });

    it('the first press at 5.1 s left leaves 0.1 s (not time-up)', () => {
        const run = newRun();
        run.timeLeft = 5.1;
        run.useHint();
        expect(run.phase).toBe('play');
        expect(run.timeLeft).toBeCloseTo(0.1, 9);
        expect(run.displaySeconds).toBe(1);
    });

    it('is available again on the next stage', () => {
        const run = newRun();
        run.useHint();
        run.click(A.x, A.y);
        run.click(B.x, B.y);
        run.click(C.x, C.y);
        run.tick(PARAMS.stageClearPauseMs + 1);
        expect(run.stageNo).toBe(2);
        expect(run.hintUsed).toBe(false);
        expect(run.useHint()).toBe(0);
    });
});
