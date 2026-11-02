import { describe, expect, it, vi } from 'vitest';
import { TitleDemoRunner, type DemoEvent } from 'title-demo';
import { DEMO_FADE_MS, DEMO_RUN_MS, MAX_FRAME_DT, PADDLE_WIDTH } from '../params';
import { stepRun, type Run } from './run';
import type { Ball } from './physics';
import {
    createDemoState,
    demoBot,
    demoEnded,
    demoLayout,
    demoStepMs,
    foldedX,
    seededRng,
    stepDemo,
    stepDemoPaddle,
    TITLE_DEMO_GAME,
    TITLE_DEMO_OPTIONS,
} from './titleDemo';

// Hand-worked values come from docs/spec/title-demo.md (layout table, bot examples, time line).

const ball = (id: number, x: number, y: number, vx: number, vy: number, owner: Ball['owner'] = 'enemy', tier = 1): Ball => ({
    id,
    x,
    y,
    vx,
    vy,
    owner,
    tier,
});

/** A fresh demo Run (wave 1: 6 columns x 3 rows, columns at x 95..445, rows at y 145 / 189 / 233) with these balls. */
function runWith(balls: Ball[]): Run {
    const run = createDemoState(1).run;
    run.balls = balls;
    return run;
}

describe('demoLayout', () => {
    it('fills the band between the name and the best score on a SE portrait (H 792)', () => {
        const l = demoLayout(792);
        expect(l.visible).toBe(true);
        expect(l.scale).toBeCloseTo(408.6 / 574, 4);
        expect(l.width).toBeCloseTo(384.4, 1);
        expect(l.height).toBeCloseTo(408.6, 1);
        expect(l.y).toBeCloseTo(112, 5);
        expect(l.x).toBeCloseTo((540 - l.width) / 2, 5);
        expect(l.nameY).toBe(70);
        expect(l.bestY).toBeCloseTo(0.8 * 792 - 82, 5);
        expect(l.startY).toBeCloseTo(0.8 * 792, 5);
    });

    it('is capped by the width on a tall phone (H 1169) and centred in the band', () => {
        const l = demoLayout(1169);
        expect(l.scale).toBeCloseTo(500 / 540, 5);
        expect(l.width).toBeCloseTo(500, 5);
        expect(l.height).toBeCloseTo(531.5, 1);
        expect(l.x).toBeCloseTo(20, 5);
        expect(l.y).toBeCloseTo(201.4, 1); // 112 + (710.2 - 531.5) / 2
    });

    it('is 357.3 x 379.8 on the shortest screen (H 756, PC and phone landscape)', () => {
        const l = demoLayout(756);
        expect(l.scale).toBeCloseTo(379.8 / 574, 4);
        expect(l.width).toBeCloseTo(357.3, 1);
        expect(l.height).toBeCloseTo(379.8, 1);
        expect(l.y).toBeCloseTo(112, 5);
    });

    it('shows the window at H 497 (scale 0.3007) and hides it at H 496 (0.2993)', () => {
        const shown = demoLayout(497);
        expect(shown.visible).toBe(true);
        expect(shown.scale).toBeCloseTo(0.3007, 4);
        const hidden = demoLayout(496);
        expect(hidden.visible).toBe(false);
        expect(hidden.scale).toBe(0);
        expect(hidden.width).toBe(0);
        expect(hidden.height).toBe(0);
    });

    it('falls back to the old arrangement when hidden: name 0.17H, best 0.56H, START 0.8H', () => {
        const l = demoLayout(496);
        expect(l.nameY).toBeCloseTo(0.17 * 496, 5);
        expect(l.bestY).toBeCloseTo(0.56 * 496, 5);
        expect(l.startY).toBeCloseTo(0.8 * 496, 5);
    });

    it.each([497, 756, 792, 1169])('shows 574 Run px (the Run from y 56 down): height = 574 x scale and width = 540 x scale at H %i', (h) => {
        const l = demoLayout(h);
        expect(l.height).toBeCloseTo(574 * l.scale, 9);
        expect(l.width).toBeCloseTo(540 * l.scale, 9);
    });

    it.each([497, 600, 756, 792, 900, 1169, 1170])('keeps the window clear of the name and the best score at H %i', (h) => {
        const l = demoLayout(h);
        expect(l.visible).toBe(true);
        expect(l.nameY + 24).toBeLessThan(l.y); // name text bottom (48 px font)
        expect(l.y).toBeGreaterThanOrEqual(112 - 1e-9);
        expect(l.y + l.height).toBeLessThanOrEqual(l.bestY - 15 - 16 + 1e-9);
        expect(l.bestY + 15).toBeLessThan(l.startY - 42); // best text bottom above the START button
    });
});

describe('foldedX', () => {
    it('stays put without sideways speed', () => {
        expect(foldedX(270, 0, 1)).toBe(270);
    });

    it('folds once off the right wall: 500 moving right at 240 px/s for 100/240 s ends at 446', () => {
        expect(foldedX(500, 240, 100 / 240)).toBeCloseTo(446, 6);
    });

    it('folds once off the left wall: 30 moving left 24 px ends at 28', () => {
        expect(foldedX(30, -240, 0.1)).toBeCloseTo(28, 6);
    });

    it('folds twice when the ball crosses the field and bounces back', () => {
        // lo 17, hi 523: start 20, +1100 px -> 20 + 1100 = 1120 -> 1120 - 17 = 1103 mod 1012 = 91 -> x 108
        expect(foldedX(20, 1100, 1)).toBeCloseTo(108, 6);
    });
});

describe('demoBot', () => {
    it('sanity: the fixture is the wave-1 formation the examples assume', () => {
        const run = createDemoState(1).run;
        expect(run.paddleY).toBe(530);
        expect(run.dangerY).toBe(450);
        const lowest = run.formation.enemies.filter((e) => e.rect.y === 233).map((e) => e.rect.x);
        expect(lowest).toEqual([95, 165, 235, 305, 375, 445]);
        expect(run.formation.enemies).toHaveLength(18);
    });

    it('aims the 0-based (id mod 6)-th enemy of the lowest row: id 3 -> x 305, target 263.84', () => {
        const cmd = demoBot(runWith([ball(3, 270, 413, 0, 240)]));
        expect(cmd.urgent).toBe(true);
        expect(cmd.targetX).toBeCloseTo(263.84, 2);
    });

    it('aims the leftmost enemy for id 6 (6 mod 6 = 0): target 297.97', () => {
        const cmd = demoBot(runWith([ball(6, 270, 413, 0, 240)]));
        expect(cmd.urgent).toBe(true);
        expect(cmd.targetX).toBeCloseTo(297.97, 1);
    });

    it('uses the position after folding at the wall: ball (500, 413, vx 240) arrives at 446, target 469.28', () => {
        const cmd = demoBot(runWith([ball(3, 500, 413, 240, 240)]));
        expect(cmd.targetX).toBeCloseTo(469.28, 1);
    });

    it('picks the ball that arrives first, own balls included (A 0.4167 s vs B 0.463 s)', () => {
        const a = ball(3, 270, 413, 0, 240);
        const b = ball(4, 100, 300, 0, 460, 'mine', 2);
        expect(demoBot(runWith([b, a])).targetX).toBeCloseTo(263.84, 2);
    });

    it('breaks a tie in arrival time by the smaller id (5 aims x 445 from x 400 -> 392.10)', () => {
        const cmd = demoBot(runWith([ball(9, 200, 413, 0, 240), ball(5, 400, 413, 0, 240)]));
        expect(cmd.targetX).toBeCloseTo(392.1, 1);
    });

    it('still counts a ball whose circle already touches the paddle (y 547) but not one below it (y 548)', () => {
        const touching = demoBot(runWith([ball(3, 270, 547, 0, 240)]));
        expect(touching.urgent).toBe(true);
        expect(touching.targetX).toBeCloseTo(263.84, 2); // arrival time 0, no movement
        const gone = demoBot(runWith([ball(3, 270, 548, 0, 240)]));
        expect(gone.urgent).toBe(false);
        expect(gone.targetX).toBe(270);
    });

    it('ignores balls that are not coming down (vy 0 and rising)', () => {
        const cmd = demoBot(runWith([ball(1, 100, 300, 0, 0, 'mine'), ball(2, 400, 300, 0, -460, 'mine')]));
        expect(cmd.urgent).toBe(false);
        expect(cmd.targetX).toBe(270);
    });

    it('moves to the next row up once the lowest row is gone: id 3 aims (305, 189) -> 264.63', () => {
        const run = runWith([ball(3, 270, 413, 0, 240)]);
        run.formation.enemies = run.formation.enemies.filter((e) => e.rect.y !== 233);
        expect(demoBot(run).targetX).toBeCloseTo(264.63, 1);
    });

    it('takes id mod the number of enemies left in the lowest row: 4 left, id 5 -> second from the left (x 235), target 276.16', () => {
        const run = runWith([ball(5, 270, 413, 0, 240)]);
        run.formation.enemies = run.formation.enemies.filter((e) => !(e.rect.y === 233 && (e.rect.x === 95 || e.rect.x === 445)));
        // dx = 235 - 270 = -35, dy = 530 - 233 = 297 -> -6.72 deg -> offset -0.1120 -> 270 + 0.1120 * 55
        expect(demoBot(run).targetX).toBeCloseTo(276.16, 1);
    });

    it('does not depend on the order of the enemy list (lowest row listed first, shuffled)', () => {
        const run = runWith([ball(5, 270, 413, 0, 240)]);
        run.formation.enemies = run.formation.enemies.filter((e) => !(e.rect.y === 233 && (e.rect.x === 95 || e.rect.x === 445)));
        run.formation.enemies.reverse();
        const shuffled = [...run.formation.enemies.slice(3), ...run.formation.enemies.slice(0, 3)];
        run.formation.enemies = shuffled;
        expect(demoBot(run).targetX).toBeCloseTo(276.16, 1);
    });

    it('limits the angle to the paddle edge: a far target gives offset 1, target = ball x - 55', () => {
        const run = runWith([ball(1, 200, 413, 0, 240)]);
        run.formation.enemies = [{ id: 1, col: 0, baseX: 500, rect: { x: 500, y: 450, w: 56, h: 30 } }];
        expect(demoBot(run).targetX).toBeCloseTo(200 - PADDLE_WIDTH / 2, 6);
    });

    it('sends the ball straight up when no enemy is left (aims x 270, y 300): ball x 370 -> 391.52', () => {
        const run = runWith([ball(1, 370, 413, 0, 240)]);
        run.formation.enemies = [];
        expect(demoBot(run).targetX).toBeCloseTo(391.52, 1);
    });

    it('keeps the target inside the paddle range (63..477)', () => {
        const run = runWith([ball(1, 20, 413, 0, 240)]);
        run.formation.enemies = [{ id: 1, col: 0, baseX: 500, rect: { x: 500, y: 450, w: 56, h: 30 } }];
        expect(demoBot(run).targetX).toBe(63);
    });

    it('drifts under the formation when no ball is coming: mean x 270, then 300 after the formation moved 30 right', () => {
        const run = runWith([]);
        expect(demoBot(run)).toEqual({ targetX: 270, urgent: false });
        for (const e of run.formation.enemies) e.rect.x += 30;
        expect(demoBot(run)).toEqual({ targetX: 300, urgent: false });
    });

    it('waits in the middle when nothing is left to look at', () => {
        const run = runWith([]);
        run.formation.enemies = [];
        expect(demoBot(run)).toEqual({ targetX: 270, urgent: false });
    });

    it('is a pure function: no randomness and the Run is not modified', () => {
        const run = runWith([ball(3, 270, 413, 0, 240), ball(8, 100, 200, 90, 240)]);
        const before = JSON.stringify(run);
        const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
            throw new Error('Math.random must not be used');
        });
        try {
            const first = demoBot(run);
            expect(demoBot(run)).toEqual(first);
        } finally {
            spy.mockRestore();
        }
        expect(JSON.stringify(run)).toBe(before);
    });
});

describe('demoStepMs', () => {
    it('passes a normal 60 fps frame through unchanged', () => {
        expect(demoStepMs(16.7)).toBeCloseTo(16.7, 6);
    });

    it('cuts a long frame (a hidden tab coming back) to MAX_FRAME_DT', () => {
        expect(demoStepMs(1000)).toBeCloseTo(MAX_FRAME_DT * 1000, 6);
        expect(demoStepMs(MAX_FRAME_DT * 1000)).toBeCloseTo(MAX_FRAME_DT * 1000, 6);
    });

    it('advances the demo clock by only MAX_FRAME_DT for a 1000 ms frame', () => {
        const runner = new TitleDemoRunner(TITLE_DEMO_GAME, TITLE_DEMO_OPTIONS);
        runner.update(demoStepMs(1000));
        expect(runner.clock).toBeCloseTo(MAX_FRAME_DT * 1000, 6);
    });
});

describe('stepDemoPaddle', () => {
    it('reaches a near target in one frame without overshooting (fast: up to 23.33 px per 1/60 s)', () => {
        expect(stepDemoPaddle(270, { targetX: 263.84, urgent: true }, 1 / 60)).toBeCloseTo(263.84, 6);
    });

    it('drifts slowly when idle: 2.5 px per 1/60 s', () => {
        expect(stepDemoPaddle(270, { targetX: 263.84, urgent: false }, 1 / 60)).toBeCloseTo(267.5, 6);
    });

    it('moves at the fast limit toward a far target', () => {
        expect(stepDemoPaddle(100, { targetX: 400, urgent: true }, 1 / 60)).toBeCloseTo(100 + 1400 / 60, 6);
        expect(stepDemoPaddle(400, { targetX: 100, urgent: true }, 1 / 60)).toBeCloseTo(400 - 1400 / 60, 6);
    });

    it('stops at the walls (63 and 477)', () => {
        expect(stepDemoPaddle(470, { targetX: 600, urgent: true }, 1)).toBe(477);
        expect(stepDemoPaddle(70, { targetX: -100, urgent: true }, 1)).toBe(63);
    });
});

describe('seededRng', () => {
    it('gives the same sequence for the same seed and a different one for another seed', () => {
        const a = seededRng(7);
        const b = seededRng(7);
        const c = seededRng(8);
        const seqA = [a(), a(), a()];
        expect([b(), b(), b()]).toEqual(seqA);
        expect([c(), c(), c()]).not.toEqual(seqA);
    });

    it('stays in [0, 1)', () => {
        const r = seededRng(123);
        for (let i = 0; i < 1000; i++) {
            const v = r();
            if (v < 0 || v >= 1) expect.fail(`out of range: ${v}`);
        }
    });
});

describe('createDemoState / stepDemo', () => {
    it('starts wave 1 in a 630-high Run with the paddle in the middle and no pending spawn flag', () => {
        const d = createDemoState(5);
        expect(d.run.height).toBe(630);
        expect(d.run.wave).toBe(1);
        expect(d.paddleX).toBe(270);
        expect(d.run.formation.enemies).toHaveLength(18);
        expect(d.run.formationSpawned).toBe(false);
        expect(demoEnded(d)).toBe(false);
    });

    it('moves the paddle and the Run forward by one frame', () => {
        const d = createDemoState(5);
        d.run.balls = [ball(3, 100, 413, 0, 240)];
        stepDemo(d, 1 / 60);
        expect(d.paddleX).toBeLessThan(270);
        expect(d.run.balls[0].y).toBeCloseTo(417, 6);
    });

    it('reports a finished Run when its phase is ending', () => {
        const d = createDemoState(5);
        d.run.phase = 'ending';
        expect(demoEnded(d)).toBe(true);
    });

    it('is reproducible: the same seed gives the same Run', () => {
        const run = (seed: number) => {
            const d = createDemoState(seed);
            for (let i = 0; i < 600; i++) stepDemo(d, 1 / 60);
            return JSON.stringify([d.run.score, d.run.wave, d.run.balls, d.paddleX]);
        };
        expect(run(11)).toBe(run(11));
        expect(run(11)).not.toBe(run(12));
    });
});

describe('quality of the demo bot (seeds 1..40, 24.6 s at 60 fps)', () => {
    const FRAMES = Math.round(((DEMO_RUN_MS + 2 * DEMO_FADE_MS) / 1000) * 60); // longest run: 24.6 s
    const WINDOW = 180; // 3 s

    interface Result {
        ended: boolean;
        kills: number;
        tierUps: number;
        range: number;
        stillWindows: number;
    }

    function play(seed: number): Result {
        const d = createDemoState(seed);
        const xs: number[] = [];
        let kills = 0;
        let tierUps = 0;
        let ended = false;
        for (let f = 0; f < FRAMES && !ended; f++) {
            stepDemo(d, 1 / 60);
            kills += d.run.kills.length;
            for (const c of d.run.caught) if (c.tier >= 2) tierUps += 1;
            xs.push(d.paddleX);
            ended = demoEnded(d);
        }
        let stillWindows = 0;
        for (let i = 0; i + WINDOW <= xs.length; i++) {
            let lo = Infinity;
            let hi = -Infinity;
            for (let j = i; j < i + WINDOW; j++) {
                lo = Math.min(lo, xs[j]);
                hi = Math.max(hi, xs[j]);
            }
            if (hi - lo < 10) stillWindows += 1;
        }
        return { ended, kills, tierUps, range: Math.max(...xs) - Math.min(...xs), stillWindows };
    }

    const results = Array.from({ length: 40 }, (_, i) => play(i + 1));

    it('survives the whole run on all 40 seeds', () => {
        expect(results.filter((r) => !r.ended)).toHaveLength(40);
    });

    it('kills at least 15 enemies in every run (and kills happen at all)', () => {
        expect(Math.min(...results.map((r) => r.kills))).toBeGreaterThanOrEqual(15);
    });

    it('catches own balls again (tier 2 or more) at least 8 times in every run', () => {
        expect(Math.min(...results.map((r) => r.tierUps))).toBeGreaterThanOrEqual(8);
    });

    it('moves the paddle across at least 300 px in every run', () => {
        expect(Math.min(...results.map((r) => r.range))).toBeGreaterThanOrEqual(300);
    });

    it('never leaves the paddle almost still for 3 seconds', () => {
        expect(results.reduce((n, r) => n + r.stillWindows, 0)).toBe(0);
    });

    it('would notice a bot that loses: a paddle that never moves ends some runs early', () => {
        let ended = 0;
        for (let seed = 1; seed <= 10; seed++) {
            const d = createDemoState(seed);
            for (let f = 0; f < FRAMES && !demoEnded(d); f++) stepRun(d.run, 1 / 60, 270, d.rng);
            if (demoEnded(d)) ended += 1;
        }
        expect(ended).toBeGreaterThan(0);
    });
});

describe('the demo clock (TitleDemoRunner with the do-nothing game)', () => {
    function timeline(untilMs: number) {
        const runner = new TitleDemoRunner(TITLE_DEMO_GAME, TITLE_DEMO_OPTIONS);
        const events: { t: number; kind: DemoEvent<undefined>['kind'] }[] = [];
        const opacity = new Map<number, number>();
        for (let t = 1; t <= untilMs; t++) {
            const e = runner.update(1);
            if (e) events.push({ t, kind: e.kind });
            if ([23999, 24000, 24150, 24300, 24450, 24600].includes(t)) opacity.set(t, runner.opacity());
        }
        return { events, opacity, runner };
    }

    it('follows the time line: step 12000, fade-out 24000, fade-in 24300, step 36600, fade-out 48600, fade-in 48900', () => {
        const { events } = timeline(49000);
        expect(events).toEqual([
            { t: 12000, kind: 'action' },
            { t: 24000, kind: 'fade-out' },
            { t: 24300, kind: 'fade-in' },
            { t: 36600, kind: 'action' },
            { t: 48600, kind: 'fade-out' },
            { t: 48900, kind: 'fade-in' },
        ]);
    });

    it('fades the window 1 -> 0.5 -> 0 -> 0.5 -> 1 across 24000..24600 and stays opaque before', () => {
        const { opacity } = timeline(24600);
        expect(opacity.get(23999)).toBe(1);
        expect(opacity.get(24000)).toBe(1);
        expect(opacity.get(24150)).toBeCloseTo(0.5, 6);
        expect(opacity.get(24300)).toBe(0);
        expect(opacity.get(24450)).toBeCloseTo(0.5, 6);
        expect(opacity.get(24600)).toBe(1);
    });

    it('accepts one start request, then stops the clock', () => {
        const runner = new TitleDemoRunner(TITLE_DEMO_GAME, TITLE_DEMO_OPTIONS);
        runner.update(1000);
        expect(runner.requestStart()).toBe(true);
        expect(runner.requestStart()).toBe(false);
        expect(runner.update(1000)).toBeNull();
        expect(runner.clock).toBe(1000);
        expect(runner.leaving).toBe(true);
    });

    it('parameter constraint: the fade is shorter than half a run, and the longest run is 24.6 s', () => {
        expect(DEMO_FADE_MS).toBeLessThan(DEMO_RUN_MS / 2);
        expect(DEMO_RUN_MS + 2 * DEMO_FADE_MS).toBe(24600);
    });
});
