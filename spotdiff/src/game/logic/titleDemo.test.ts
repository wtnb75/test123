import { describe, expect, it } from 'vitest';
import { generateStage } from './generate';
import type { Diff, Stage } from './generate';
import { judgeClick } from './judge';
import { mulberry32, seedFor } from './random';
import { makeStageFor } from './set';
import { botPlan, createTitleDemo, demoDateFrom, demoStage } from './titleDemo';
import type { DemoTap, StageMaker } from './titleDemo';

/** A fixed random source, so the demo date (and so the pictures) are known. */
const rngOf = (seed: number) => mulberry32(seed);

/** The demo date the demo draws first from `rngOf(seed)`. */
const firstDate = (seed: number): number => demoDateFrom(rngOf(seed));

/** A seed whose first demo game has 3 differences in stage 1 and 4 in stage 2 (the spec's worked timeline). */
const SEED = (() => {
    for (let s = 1; s < 500; s++) {
        const d = firstDate(s);
        if (demoStage(d, 1).diffs.length === 3 && demoStage(d, 2).diffs.length === 4) return s;
    }
    throw new Error('no seed with 3 + 4 differences');
})();

const kinds = (e: { kind: string } | null) => (e ? e.kind : null);

describe('demoDateFrom', () => {
    it('is a floored draw times 2^31, in [0, 2^31)', () => {
        expect(demoDateFrom(() => 0)).toBe(0);
        expect(demoDateFrom(() => 0.5)).toBe(2 ** 30);
        expect(demoDateFrom(() => 0.9999999999)).toBe(2 ** 31 - 1);
        expect(Number.isInteger(demoDateFrom(() => 0.123456789))).toBe(true);
    });
});

describe('demoStage', () => {
    it('is made from set number 0 (the seed of (date, 0, stage)), the same for the same date', () => {
        const date = 123456789;
        const expected = generateStage(2, mulberry32(seedFor(date, 0, 2)));
        expect(demoStage(date, 2)).toEqual(expected);
        expect(demoStage(date, 2)).toEqual(demoStage(date, 2));
    });

    it('differs for another demo date and for another stage', () => {
        expect(demoStage(1, 1)).not.toEqual(demoStage(2, 1));
        expect(demoStage(1, 1)).not.toEqual(demoStage(1, 2));
    });

    it('never shows a real set: at the same date, the picture differs from every real set number 1..3 and stage', () => {
        // The same date on purpose: only the set number (0 for the demo, 1 and up for real sets) tells them apart.
        const dates = [20260101, 20261011, 20301231, 1, 2 ** 30];
        let compared = 0;
        for (const date of dates) {
            for (const setNo of [1, 2, 3]) {
                for (let stageNo = 1; stageNo <= 5; stageNo++) {
                    const demo = demoStage(date, stageNo);
                    const real = makeStageFor(date, setNo)(stageNo);
                    const same =
                        JSON.stringify(demo.left) === JSON.stringify(real.left) && JSON.stringify(demo.diffs) === JSON.stringify(real.diffs);
                    if (same) expect.fail(`demo stage ${stageNo} of ${date} equals set ${setNo}`);
                    compared++;
                }
            }
        }
        expect(compared).toBe(75);
    });

    it('has 3 and 4 differences in stages 1 and 2 (the demo shows these two)', () => {
        const counts = new Set<string>();
        const rng = rngOf(5);
        for (let i = 0; i < 40; i++) {
            const date = demoDateFrom(rng);
            counts.add(`${demoStage(date, 1).diffs.length}/${demoStage(date, 2).diffs.length}`);
        }
        expect([...counts]).toEqual(['3/4']);
    });
});

describe('botPlan', () => {
    it('taps every difference in index order', () => {
        const stage = demoStage(firstDate(SEED), 2);
        expect(botPlan(stage)).toEqual([0, 1, 2, 3]);
    });

    it('skips the differences that are already found (a re-made plan carries on from where the bot was)', () => {
        const stage = demoStage(firstDate(SEED), 2);
        expect(botPlan(stage, new Set([0, 2]))).toEqual([1, 3]);
    });

    it('has no plan once every difference is found', () => {
        const stage = demoStage(firstDate(SEED), 2);
        expect(botPlan(stage, new Set([0, 1, 2, 3]))).toBeNull();
    });

    it('has no plan for a picture without differences', () => {
        expect(botPlan({ ...demoStage(1, 1), diffs: [] })).toBeNull();
    });
});

describe('Title demo timing', () => {
    // t = 0 is the moment the Title is entered; the spec's worked timeline (3 + 4 differences).
    const run = () => createTitleDemo(rngOf(SEED), 0);

    it('taps the first difference at 900 ms and then every 700 ms, finding all three of stage 1', () => {
        const demo = run();
        expect(demo.tick(0)).toBeNull();
        expect(demo.tick(899)).toBeNull();
        const first = demo.tick(900);
        expect(first && first.kind === 'action' && first.detail.diff).toBe(0);
        expect(demo.tick(1599)).toBeNull();
        const second = demo.tick(1600);
        expect(second && second.kind === 'action' && second.detail.diff).toBe(1);
        expect(demo.tick(2299)).toBeNull();
        const third = demo.tick(2300);
        expect(third && third.kind === 'action' && third.detail.diff).toBe(2);
        expect(demo.state.found.size).toBe(3);
        expect(demo.rounds).toBe(1);
    });

    it('swaps to stage 2 at 3200 ms, taps its four differences at 4100 / 4800 / 5500 / 6200 ms', () => {
        const demo = run();
        [900, 1600, 2300].forEach((t) => demo.tick(t));
        expect(demo.tick(3199)).toBeNull();
        expect(demo.state.stageNo).toBe(1);
        expect(demo.tick(3200)).toEqual({ kind: 'advance' });
        expect(demo.state.stageNo).toBe(2);
        expect(demo.state.found.size).toBe(0);
        expect(demo.state.stage.diffs).toHaveLength(4);
        expect(demo.tick(4099)).toBeNull();
        const taps = [4100, 4800, 5500, 6200].map((t) => {
            expect(demo.tick(t - 1)).toBeNull();
            return demo.tick(t);
        });
        expect(taps.map(kinds)).toEqual(['action', 'action', 'action', 'action']);
        expect(demo.state.found.size).toBe(4);
        expect(demo.rounds).toBe(2);
    });

    it('fades out at 7100 ms, fades in a new game at 7400 ms, taps again at 8600 ms', () => {
        const demo = run();
        [900, 1600, 2300, 3200, 4100, 4800, 5500, 6200].forEach((t) => demo.tick(t));
        const oldDate = demo.state.date;
        expect(demo.tick(7099)).toBeNull();
        expect(demo.tick(7100)).toEqual({ kind: 'fade-out' });
        expect(demo.opacity(7100)).toBe(1);
        expect(demo.opacity(7250)).toBe(0.5);
        expect(demo.tick(7399)).toBeNull();
        expect(demo.tick(7400)).toEqual({ kind: 'fade-in' });
        expect(demo.opacity(7400)).toBe(0);
        expect(demo.state.date).not.toBe(oldDate); // a new random demo date
        expect(demo.state.stageNo).toBe(1);
        expect(demo.state.found.size).toBe(0);
        expect(demo.rounds).toBe(0);
        expect(demo.tick(7699)).toBeNull();
        expect(demo.tick(7700)).toBeNull();
        expect(demo.phase).toBe('waiting');
        expect(demo.tick(8599)).toBeNull();
        expect(kinds(demo.tick(8600))).toBe('action');
    });

    it('makes at most one tap per call, even after a long frame', () => {
        const demo = run();
        expect(kinds(demo.tick(5000))).toBe('action');
        expect(demo.tick(5000)).toBeNull();
        expect(demo.tick(5001)).toBeNull();
    });
});

describe('Title demo taps', () => {
    it('every tap lands in its own hit circle and finds exactly that difference', () => {
        const demo = createTitleDemo(rngOf(SEED), 0);
        const taps: DemoTap[] = [];
        for (let t = 0; t < 7000; t += 100) {
            const e = demo.tick(t);
            if (e && e.kind === 'action') {
                const { stage } = demo.state;
                taps.push(e.detail);
                const diff = stage.diffs[e.detail.diff];
                expect(e.detail.panel).toBe(0);
                expect(Math.hypot(diff.x - e.detail.x, diff.y - e.detail.y)).toBeLessThanOrEqual(diff.r);
            }
        }
        expect(taps).toHaveLength(7);
        expect(taps.map((t) => t.diff)).toEqual([0, 1, 2, 0, 1, 2, 3]);
    });

    it('the bot tap would be judged as a hit of that difference (circles never overlap)', () => {
        const stage = demoStage(firstDate(SEED), 2);
        stage.diffs.forEach((d, i) => {
            expect(judgeClick(stage.diffs, new Set(), d.x, d.y)).toBe(i);
        });
    });

    it('a stage swap clears the found differences, and a rebuild starts again from stage 1 (3 differences)', () => {
        const demo = createTitleDemo(rngOf(SEED), 0);
        [900, 1600, 2300].forEach((t) => demo.tick(t));
        expect(demo.state.found.size).toBe(3);
        demo.tick(3200);
        expect(demo.state.found.size).toBe(0);
        [4100, 4800, 5500, 6200, 7100, 7400].forEach((t) => demo.tick(t));
        expect(demo.state.stageNo).toBe(1);
        expect(demo.state.stage.diffs).toHaveLength(3);
        expect(demo.state.found.size).toBe(0);
    });
});

describe('Title demo edge cases', () => {
    const empty: Stage = { ...demoStage(1, 1), diffs: [] };
    const none: StageMaker = () => empty;

    it('rebuilds after the wait when a picture has no difference to find (no plan)', () => {
        const demo = createTitleDemo(rngOf(1), 0, none);
        expect(demo.tick(899)).toBeNull();
        expect(demo.tick(900)).toEqual({ kind: 'fade-out' });
    });

    it('does nothing when a tap cannot find its difference, and tries again after another wait', () => {
        const broken: Diff = { kind: 'color', index: 0, x: 100, y: 100, r: -1 };
        const bad: StageMaker = () => ({ ...demoStage(1, 1), diffs: [broken] });
        const demo = createTitleDemo(rngOf(1), 0, bad);
        expect(demo.tick(900)).toBeNull();
        expect(demo.phase).toBe('waiting');
        expect(demo.state.found.size).toBe(0);
        expect(demo.tick(1800)).toBeNull();
    });

    it('draws the demo date once per game from the injected random source (a constant source gives the same date)', () => {
        const demo = createTitleDemo(() => 0.5, 0);
        expect(demo.state.date).toBe(2 ** 30);
        [900, 1600, 2300, 3200, 4100, 4800, 5500, 6200, 7100, 7400].forEach((t) => demo.tick(t));
        // rebuilt: a new game is drawn, which with a constant source is the same date (it is not redrawn until then)
        expect(demo.state.date).toBe(2 ** 30);
        expect(demo.state.stageNo).toBe(1);
    });

    it('gives each game its own pictures: two Titles with different randomness differ', () => {
        const a = createTitleDemo(rngOf(1), 0);
        const b = createTitleDemo(rngOf(2), 0);
        expect(a.state.date).not.toBe(b.state.date);
        expect(JSON.stringify(a.state.stage.left)).not.toBe(JSON.stringify(b.state.stage.left));
    });
});
