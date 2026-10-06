import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import type { Stage } from './generate';
import { makeStageFor } from './set';
import { showFirstHint } from './effects';
import { Run } from './run';

// Two differences at known places; hit circles of radius 20 around (100,100) and (300,300).
const A = { x: 100, y: 100 };
const B = { x: 300, y: 300 };
const fakeStage = (stage: number): Stage => ({
    stage,
    left: [],
    right: [],
    diffs: [
        { kind: 'color', index: 0, x: A.x, y: A.y, r: 20 },
        { kind: 'color', index: 1, x: B.x, y: B.y, r: 20 },
    ],
    bgHue: 0,
    dots: [],
});
const newRun = (startHidden = false) => new Run({ date: 20261006, setNo: 1, makeStage: fakeStage, startHidden });
const MISS = { x: 0, y: 0 };
const TIMES = PARAMS.timeLimits;

const findAll = (run: Run) => {
    for (const d of run.stage.diffs) run.click(d.x, d.y);
};

/** Clears stages 1..n-1 instantly and leaves the run in `play` on stage n. */
const advanceTo = (run: Run, n: number) => {
    while (run.stageNo < n) {
        findAll(run);
        run.tick(PARAMS.stageClearPauseMs);
    }
};

describe('Run: start of a run', () => {
    it('starts in play on stage 1 with the stage-1 time limit and no score', () => {
        const run = newRun();
        expect(run.phase).toBe('play');
        expect(run.stageNo).toBe(1);
        expect(run.timeLeft).toBe(TIMES[0]);
        expect(run.displaySeconds).toBe(60);
        expect(run.score).toBe(0);
        expect(run.found.size).toBe(0);
        expect(run.setNo).toBe(1);
        expect(run.date).toBe(20261006);
    });
});

describe('Run: time', () => {
    it('counts the stage timer down by the elapsed milliseconds', () => {
        const run = newRun();
        expect(run.tick(1500)).toBe('none');
        expect(run.timeLeft).toBeCloseTo(58.5, 9);
        expect(run.displaySeconds).toBe(59);
    });

    it('shows whole seconds rounded up, so exactly 59.0 shows 59 and 58.999 shows 59', () => {
        const run = newRun();
        run.tick(1000);
        expect(run.displaySeconds).toBe(59);
        run.tick(1);
        expect(run.displaySeconds).toBe(59);
    });

    it('ends in over with 0 seconds when the timer reaches exactly zero', () => {
        const run = newRun();
        run.tick(59500); // 0.5 s left: both values are exact in binary floating point
        expect(run.phase).toBe('play');
        run.tick(500);
        expect(run.phase).toBe('over');
        expect(run.timeLeft).toBe(0);
        expect(run.displaySeconds).toBe(0);
    });

    it('does not run the timer during the clear pause', () => {
        const run = newRun();
        run.tick(2000);
        findAll(run);
        const frozen = run.timeLeft;
        run.tick(500);
        expect(run.timeLeft).toBe(frozen);
    });
});

describe('Run: clicks', () => {
    it('finds a difference without costing time', () => {
        const run = newRun();
        expect(run.click(A.x, A.y)).toBe('hit');
        expect(run.found.has(0)).toBe(true);
        expect(run.timeLeft).toBe(60);
    });

    it('takes 5 seconds for a miss', () => {
        const run = newRun();
        expect(run.click(MISS.x, MISS.y)).toBe('miss');
        expect(run.timeLeft).toBe(55);
    });

    it('treats a second click on an already found difference as a miss', () => {
        const run = newRun();
        run.click(A.x, A.y);
        expect(run.click(A.x, A.y)).toBe('miss');
        expect(run.timeLeft).toBe(55);
        expect(run.found.size).toBe(1);
    });

    it('does not let a miss drop the time below zero and ends the run when it hits zero', () => {
        const run = newRun();
        run.tick(57000); // 3 s left
        expect(run.click(MISS.x, MISS.y)).toBe('miss');
        expect(run.timeLeft).toBe(0);
        expect(run.phase).toBe('over');
    });

    it('keeps playing when a miss leaves time over', () => {
        const run = newRun();
        run.tick(54999); // 5.001 s left
        run.click(MISS.x, MISS.y);
        expect(run.phase).toBe('play');
        expect(run.timeLeft).toBeCloseTo(0.001, 6);
    });

    it.each(['clear', 'won', 'over'] as const)('ignores clicks, even on a difference, in %s', (phase) => {
        const run = newRun();
        if (phase === 'over') run.tick(60000);
        else {
            if (phase === 'won') advanceTo(run, 5);
            run.click(A.x, A.y);
            run.click(B.x, B.y);
        }
        expect(run.phase).toBe(phase);
        const before = { time: run.timeLeft, found: run.found.size, score: run.score };
        expect(run.click(MISS.x, MISS.y)).toBe('ignored');
        expect(run.click(A.x, A.y)).toBe('ignored');
        expect({ time: run.timeLeft, found: run.found.size, score: run.score }).toEqual(before);
    });
});

describe('first-run hint with a real Run', () => {
    it('shows at the start, survives misses, disappears at the first hit', () => {
        const run = newRun();
        expect(showFirstHint(run)).toBe(true);
        run.click(MISS.x, MISS.y);
        expect(showFirstHint(run)).toBe(true);
        run.click(A.x, A.y);
        expect(showFirstHint(run)).toBe(false);
    });

    it('comes back when the same set is replayed after a time-up', () => {
        const first = newRun();
        first.click(A.x, A.y);
        first.tick(60000);
        expect(first.phase).toBe('over');
        expect(showFirstHint(first)).toBe(false);
        expect(showFirstHint(newRun())).toBe(true); // the retry is a brand-new Run of the same set
    });

    it('is not shown from the second stage on or in another set', () => {
        const run = newRun();
        advanceTo(run, 2);
        expect(showFirstHint(run)).toBe(false);
        expect(showFirstHint(new Run({ date: 20261006, setNo: 2, makeStage: fakeStage }))).toBe(false);
    });

    it('is not shown while paused', () => {
        const run = newRun();
        run.hide();
        expect(showFirstHint(run)).toBe(false);
    });
});

describe('Run: lastHit (starts the pop-in effect of the found ring)', () => {
    it('is -1 until something is found and ignores misses', () => {
        const run = newRun();
        expect(run.lastHit).toBe(-1);
        run.click(MISS.x, MISS.y);
        expect(run.lastHit).toBe(-1);
    });

    it('names the index of the difference found by the latest hit', () => {
        const run = newRun();
        run.click(B.x, B.y);
        expect(run.lastHit).toBe(1);
        run.click(MISS.x, MISS.y);
        expect(run.lastHit).toBe(1);
        run.click(A.x, A.y);
        expect(run.lastHit).toBe(0);
    });

    it('resets with a new stage', () => {
        const run = newRun();
        findAll(run);
        run.tick(PARAMS.stageClearPauseMs);
        expect(run.lastHit).toBe(-1);
    });
});

describe('Run: clearing stages and scoring', () => {
    it('clears the stage on the last difference and waits 900 ms before the next one', () => {
        const run = newRun();
        run.tick(1500); // 58.5 s left
        run.click(A.x, A.y);
        expect(run.phase).toBe('play');
        run.click(B.x, B.y);
        expect(run.phase).toBe('clear');
        expect(run.score).toBe(59); // ceil(58.5)
        expect(run.tick(899)).toBe('none');
        expect(run.phase).toBe('clear');
        expect(run.tick(1)).toBe('stage');
        expect(run.stageNo).toBe(2);
        expect(run.phase).toBe('play');
        expect(run.timeLeft).toBe(TIMES[1]);
        expect(run.found.size).toBe(0);
    });

    it('asks the generator for the new stage number when advancing', () => {
        const asked: number[] = [];
        const run = new Run({ date: 1, setNo: 1, makeStage: (s) => (asked.push(s), fakeStage(s)) });
        advanceTo(run, 3);
        expect(asked).toEqual([1, 2, 3]);
        expect(run.stage.stage).toBe(3);
    });

    it('wins after stage 5 and sums the rounded-up remaining seconds of every stage', () => {
        const run = newRun();
        advanceTo(run, 5);
        findAll(run);
        expect(run.phase).toBe('won');
        expect(run.score).toBe(60 + 55 + 50 + 45 + 40);
        expect(run.tick(899)).toBe('none');
        expect(run.tick(1)).toBe('result');
        expect(run.summary()).toEqual({ date: 20261006, setNo: 1, won: true, stage: 5, score: 250 });
    });

    it('does not add the score of a stage that ran out of time', () => {
        const run = newRun();
        findAll(run); // stage 1 cleared at 60 s
        run.tick(900);
        run.tick(55000); // stage 2 time up
        expect(run.phase).toBe('over');
        expect(run.tick(1499)).toBe('none');
        expect(run.tick(1)).toBe('result');
        expect(run.summary()).toEqual({ date: 20261006, setNo: 1, won: false, stage: 2, score: 60 });
    });

    it('reports the result only once', () => {
        const run = newRun();
        run.tick(60000);
        run.tick(1500);
        expect(run.tick(1000)).toBe('none');
    });

    it('reports the date and set number it was started with', () => {
        const run = new Run({ date: 20270215, setNo: 3, makeStage: fakeStage });
        run.tick(60000);
        run.tick(1500);
        expect(run.summary()).toEqual({ date: 20270215, setNo: 3, won: false, stage: 1, score: 0 });
    });

    it('starts the set score at 0 for each new run', () => {
        const first = newRun();
        findAll(first);
        expect(first.score).toBe(60);
        expect(newRun().score).toBe(0);
    });
});

describe('Run: auto pause', () => {
    it('enters paused when hidden and stops the timer and clicks', () => {
        const run = newRun();
        run.tick(1000);
        expect(run.hide()).toBe(true);
        expect(run.phase).toBe('paused');
        run.tick(10000);
        expect(run.timeLeft).toBe(59);
        expect(run.click(A.x, A.y)).toBe('ignored');
        expect(run.found.size).toBe(0);
    });

    it('reports entering paused only the first time', () => {
        const run = newRun();
        expect(run.hide()).toBe(true);
        expect(run.hide()).toBe(false);
        expect(run.phase).toBe('paused');
    });

    it('ignores the resume tap for 300 ms after the page becomes visible again', () => {
        const run = newRun();
        run.hide();
        run.show();
        expect(run.resume()).toBe(false);
        run.tick(299);
        expect(run.resume()).toBe(false);
        run.tick(1);
        expect(run.resume()).toBe(true);
        expect(run.phase).toBe('play');
    });

    it('does not resume while the page is still hidden, however long it waits', () => {
        const run = newRun();
        run.hide();
        run.tick(5000);
        expect(run.resume()).toBe(false);
        expect(run.phase).toBe('paused');
    });

    it('restarts the lock from the latest visible event', () => {
        const run = newRun();
        run.hide();
        run.show();
        run.tick(200);
        run.hide();
        run.tick(1000); // hidden time does not count towards the lock
        run.show();
        run.tick(299);
        expect(run.resume()).toBe(false);
        run.tick(1);
        expect(run.resume()).toBe(true);
    });

    it('does not resume when it is not paused', () => {
        expect(newRun().resume()).toBe(false);
    });

    it('resumes with the exact time left, and the resume tap is neither a hit nor a miss', () => {
        const run = newRun();
        run.tick(2500);
        run.hide();
        run.tick(30000);
        run.show();
        run.tick(300);
        run.resume();
        expect(run.timeLeft).toBe(57.5);
        expect(run.found.size).toBe(0);
        run.tick(500);
        expect(run.timeLeft).toBe(57);
    });

    it('resumes into clear and carries on with the remaining wait', () => {
        const run = newRun();
        findAll(run);
        run.tick(400);
        run.hide();
        run.tick(9000);
        run.show();
        run.tick(300);
        expect(run.resume()).toBe(true);
        expect(run.phase).toBe('clear');
        expect(run.tick(499)).toBe('none');
        expect(run.tick(1)).toBe('stage');
        expect(run.stageNo).toBe(2);
    });

    it('keeps a click that cleared the stage before the page was hidden in the same frame', () => {
        const run = newRun();
        findAll(run);
        run.hide();
        expect(run.score).toBe(60);
        run.show();
        run.tick(300);
        run.resume();
        expect(run.phase).toBe('clear');
    });

    it('resumes into over and carries on with the remaining reveal time', () => {
        const run = newRun();
        run.tick(60000);
        run.tick(1000);
        run.hide();
        run.tick(9000);
        run.show();
        run.tick(300);
        run.resume();
        expect(run.phase).toBe('over');
        expect(run.tick(499)).toBe('none');
        expect(run.tick(1)).toBe('result');
    });

    it('resumes into won and still reports a win', () => {
        const run = newRun();
        advanceTo(run, 5);
        findAll(run);
        run.tick(100);
        run.hide();
        expect(run.summary().won).toBe(true);
        run.show();
        run.tick(300);
        run.resume();
        expect(run.phase).toBe('won');
        expect(run.tick(799)).toBe('none');
        expect(run.tick(1)).toBe('result');
    });

    it('never runs a pending transition while paused, then performs it on the first tick after resume', () => {
        const run = newRun();
        findAll(run);
        run.tick(899); // 1 ms of clear left
        run.hide();
        expect(run.tick(100000)).toBe('none');
        expect(run.phase).toBe('paused');
        run.show();
        run.tick(300);
        run.resume();
        expect(run.tick(1)).toBe('stage');
    });

    it('starts paused when the page is already hidden at creation', () => {
        const run = newRun(true);
        expect(run.phase).toBe('paused');
        run.tick(5000);
        expect(run.timeLeft).toBe(60);
        run.show();
        run.tick(300);
        expect(run.resume()).toBe(true);
        expect(run.phase).toBe('play');
        expect(run.stageNo).toBe(1);
        expect(run.timeLeft).toBe(60);
    });
});

describe('Run: a whole set from the real generator', () => {
    const play = (date: number, setNo: number) => {
        const stages: Stage[] = [];
        const run = new Run({
            date,
            setNo,
            makeStage: (s) => {
                const stage = makeStageFor(date, setNo)(s);
                stages.push(stage);
                return stage;
            },
        });
        for (let s = 1; s <= PARAMS.stageCount; s++) {
            expect(run.stage.diffs).toHaveLength(PARAMS.diffCounts[s - 1]);
            for (const d of run.stage.diffs) expect(run.click(d.x, d.y)).toBe('hit');
            run.tick(PARAMS.stageClearPauseMs);
        }
        return { run, stages };
    };

    it('can be cleared by clicking each hit-circle centre, ending in a win', () => {
        const { run } = play(20261006, 1);
        expect(run.summary().won).toBe(true);
        expect(run.score).toBe(250);
    });

    it('rebuilds identical stages for the same date and set number, and different ones otherwise', () => {
        const a = play(20261006, 1).stages;
        const b = play(20261006, 1).stages;
        const nextSet = play(20261006, 2).stages;
        const nextDay = play(20261007, 1).stages;
        expect(a).toHaveLength(5);
        expect(b).toEqual(a);
        expect(nextSet).not.toEqual(a);
        expect(nextDay).not.toEqual(a);
        for (let s = 0; s < 5; s++) expect(nextSet[s]).not.toEqual(a[s]);
    });
});
