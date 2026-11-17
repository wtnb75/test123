import { describe, expect, it } from 'vitest';
import { IDENTITY, spun } from './math';
import { popScreen } from './hit';
import { applyHit, createRun, displaySeconds, evaluate, isLowTime, spin, step, tap, type KeyDir } from './run';
import { popIn, SHAPE, seeded, sequence } from './testing';

const O = { x: 270, y: 480 };
const NO_KEYS: KeyDir = { x: 0, y: 0 };
const never = () => {
    throw new Error('no random number expected');
};

describe('createRun', () => {
    it('starts playing with 45 s, no progress, no Pops and the first spawn in 0.3 s', () => {
        const run = createRun();
        expect(run).toMatchObject({ progress: 0, timeLeft: 45, spawnTimer: 0.3, phase: 'playing', outcome: null });
        expect(run.pops).toEqual([]);
    });
});

describe('applyHit', () => {
    it.each([
        [0, 'mole', 1],
        [1, 'cat', 0],
        [5, 'cat', 3],
        [2, 'cat', 0],
        [0, 'cat', 0],
    ] as const)('progress %i after hitting a %s → %i', (progress, kind, expected) => {
        expect(applyHit(progress, kind)).toBe(expected);
    });
});

describe('evaluate', () => {
    it.each([
        [15, 10, 'clear'],
        [15, 0, 'clear'],
        [14, 0, 'fail'],
        [14, 0.001, null],
        [14, -0.5, 'fail'],
    ] as const)('progress %i with %f s left → %s', (progress, left, expected) => {
        expect(evaluate(progress, left)).toBe(expected);
    });
});

describe('displaySeconds', () => {
    it.each([
        [45, 45],
        [44.001, 45],
        [1, 1],
        [0.001, 1],
        [0, 0],
        [-0.3, 0],
    ])('%f s left shows %i', (left, shown) => {
        expect(displaySeconds(left)).toBe(shown);
    });
});

describe('isLowTime', () => {
    it.each([
        [11, false],
        [10, true],
        [1, true],
        [0, true],
    ])('%i displayed seconds → emphasised = %s', (shown, expected) => {
        expect(isLowTime(shown)).toBe(expected);
    });

    it('follows the displayed (rounded up) seconds: 10.001 s left shows 11, 10.0 s left shows 10', () => {
        expect(isLowTime(displaySeconds(10.001))).toBe(false);
        expect(isLowTime(displaySeconds(10.0))).toBe(true);
    });
});

describe('spin', () => {
    it('rotates the pose while playing and does nothing while ending', () => {
        const run = createRun();
        const before = run.rot;
        spin(run, 0.5, 0.3);
        expect(run.rot).toEqual(spun(before, 0.5, 0.3));
        run.phase = 'ending';
        const frozen = run.rot;
        spin(run, 0.5, 0.3);
        expect(run.rot).toBe(frozen);
    });
});

describe('tap', () => {
    const withPop = (kind: 'mole' | 'cat', progress = 0) => {
        const run = createRun();
        run.rot = IDENTITY;
        run.pops = [popIn(40, kind)];
        run.progress = progress;
        return run;
    };

    it('removes a hit mole, adds 1 and reports where it was', () => {
        const run = withPop('mole');
        const hit = tap(run, 270, 480, O);
        expect(hit?.kind).toBe('mole');
        expect(hit?.at).toEqual({ x: 270, y: 480 });
        expect(run.progress).toBe(1);
        expect(run.pops).toEqual([]);
    });

    it('takes 2 off for a cat, never going below 0', () => {
        const a = withPop('cat', 5);
        expect(tap(a, 270, 480, O)?.kind).toBe('cat');
        expect(a.progress).toBe(3);
        const b = withPop('cat', 1);
        tap(b, 270, 480, O);
        expect(b.progress).toBe(0);
    });

    it('treats a decoy cat like a plain cat: takes 2 off, reports a cat, removes it', () => {
        const run = createRun();
        run.rot = IDENTITY;
        run.pops = [popIn(40, 'cat', 1, true)];
        run.progress = 5;
        const hit = tap(run, 270, 480, O);
        expect(hit?.kind).toBe('cat');
        expect(run.progress).toBe(3);
        expect(run.pops).toEqual([]);
    });

    it('does nothing on a miss', () => {
        const run = withPop('mole');
        expect(tap(run, 100, 100, O)).toBeNull();
        expect(run.progress).toBe(0);
        expect(run.pops).toHaveLength(1);
    });

    it('ignores taps once the run is ending', () => {
        const run = withPop('mole');
        run.phase = 'ending';
        expect(tap(run, 270, 480, O)).toBeNull();
        expect(run.progress).toBe(0);
    });
});

describe('step', () => {
    it('spawns the first Pop when the 0.3 s timer runs out, and not before', () => {
        const early = createRun();
        expect(step(early, 0.2, NO_KEYS, SHAPE, never)).toBe('none');
        expect(early.pops).toHaveLength(0);

        const run = createRun();
        const { rng, calls } = sequence([0.5, 0, 0.5]);
        step(run, 0.3, NO_KEYS, SHAPE, rng);
        expect(run.pops).toHaveLength(1);
        expect(run.pops[0].age).toBe(0);
        expect(run.spawnTimer).toBe(0.9);
        expect(calls()).toBe(3);
    });

    it('carries the decoy flag from the spawn pick onto the new Pop (cat: four draws; mole: not a decoy)', () => {
        const cat = createRun();
        const catRng = sequence([0.5, 0, 0.1, 0.1]);
        step(cat, 0.3, NO_KEYS, SHAPE, catRng.rng);
        expect(cat.pops[0]).toMatchObject({ kind: 'cat', decoy: true });
        expect(catRng.calls()).toBe(4);

        const mole = createRun();
        step(mole, 0.3, NO_KEYS, SHAPE, sequence([0.5, 0, 0.5]).rng);
        expect(mole.pops[0]).toMatchObject({ kind: 'mole', decoy: false });
    });

    it('spawns at most one Pop per update, even after a long frame', () => {
        const run = createRun();
        step(run, 10, NO_KEYS, SHAPE, seeded(1));
        expect(run.pops).toHaveLength(1);
    });

    it('does not spawn with 4 Pops out', () => {
        const run = createRun();
        run.spawnTimer = 0;
        run.pops = [popIn(0), popIn(1), popIn(2), popIn(3)];
        step(run, 0.016, NO_KEYS, SHAPE, never);
        expect(run.pops).toHaveLength(4);
    });

    it('ages Pops and keeps one just short of its 2.2 s life', () => {
        const run = createRun();
        run.spawnTimer = 5;
        run.pops = [popIn(0, 'mole', 2.0), popIn(2, 'mole', 0)];
        step(run, 0.19, NO_KEYS, SHAPE, never);
        expect(run.pops.map((p) => p.hole.id)).toEqual([0, 2]);
        expect(run.pops[0].age).toBeCloseTo(2.19, 9);
    });

    it('removes a Pop that reaches its 2.2 s life exactly, keeping the younger ones', () => {
        const run = createRun();
        run.spawnTimer = 5;
        run.pops = [popIn(0, 'mole', 2.0), popIn(1, 'cat', 2.0), popIn(2, 'mole', 0)];
        step(run, 0.2, NO_KEYS, SHAPE, never);
        expect(run.pops.map((p) => p.hole.id)).toEqual([2]);
    });

    it('rotates by key rotation speed × dt (2 rad/s × 0.5 s = 1 rad about the screen Y axis)', () => {
        const run = createRun();
        run.spawnTimer = 5;
        const before = run.rot;
        step(run, 0.5, { x: 1, y: 0 }, SHAPE, never);
        expect(run.rot).toEqual(spun(before, 1, 0));
        step(run, 0.5, { x: 0, y: -1 }, SHAPE, never);
        expect(run.rot).toEqual(spun(spun(before, 1, 0), 0, -1));
    });

    it('rotates the other way for left and down', () => {
        const run = createRun();
        run.spawnTimer = 5;
        const before = run.rot;
        step(run, 0.5, { x: -1, y: 1 }, SHAPE, never);
        expect(run.rot).toEqual(spun(before, -1, 1));
    });

    it('counts the played time while playing and stops counting in ending', () => {
        const run = createRun();
        expect(run.elapsed).toBe(0);
        run.spawnTimer = 5;
        step(run, 0.5, NO_KEYS, SHAPE, never);
        step(run, 0.25, NO_KEYS, SHAPE, never);
        expect(run.elapsed).toBeCloseTo(0.75, 9);
        run.progress = 15;
        step(run, 0.25, NO_KEYS, SHAPE, never); // enters ending (the update still counts)
        expect(run.elapsed).toBeCloseTo(1.0, 9);
        step(run, 0.5, NO_KEYS, SHAPE, never);
        expect(run.elapsed).toBeCloseTo(1.0, 9);
    });

    it('leaves the pose alone without key input', () => {
        const run = createRun();
        run.spawnTimer = 5;
        const before = run.rot;
        step(run, 0.5, NO_KEYS, SHAPE, never);
        expect(run.rot).toBe(before);
    });

    it('ends as a fail when time reaches 0 below the norma: clears Pops and skips the spawn', () => {
        const run = createRun();
        run.timeLeft = 0.05;
        run.progress = 3;
        run.spawnTimer = 0;
        run.pops = [popIn(0)];
        expect(step(run, 0.05, NO_KEYS, SHAPE, never)).toBe('ended');
        expect(run).toMatchObject({ phase: 'ending', outcome: 'fail', pops: [] });
    });

    it('clears as soon as the norma is reached, with plenty of time left', () => {
        const run = createRun();
        run.progress = 15;
        expect(step(run, 0.016, NO_KEYS, SHAPE, never)).toBe('ended');
        expect(run.outcome).toBe('clear');
    });

    it('prefers clear when the norma is reached in the update where time runs out', () => {
        const run = createRun();
        run.timeLeft = 0.01;
        run.progress = 15;
        step(run, 0.02, NO_KEYS, SHAPE, never);
        expect(run.outcome).toBe('clear');
    });

    it('keeps playing with 14 and 0.001 s left after a tiny step', () => {
        const run = createRun();
        run.timeLeft = 0.001;
        run.progress = 14;
        run.spawnTimer = 5;
        expect(step(run, 0.0005, NO_KEYS, SHAPE, never)).toBe('none');
        expect(run.phase).toBe('playing');
    });

    it('counts the ending down and finishes after exactly 1.2 s, spawning nothing', () => {
        const run = createRun();
        run.progress = 15;
        step(run, 0.016, NO_KEYS, SHAPE, never);
        expect(step(run, 1.1, NO_KEYS, SHAPE, never)).toBe('none');
        expect(run.pops).toEqual([]);
        const fresh = createRun();
        fresh.phase = 'ending';
        expect(step(fresh, 1.2, NO_KEYS, SHAPE, never)).toBe('finished');
    });
});

describe('a simulated run (invariants)', () => {
    // A bot that spins at random and taps every Pop it can see, with seeded randomness.
    function simulate(seed: number) {
        const rng = seeded(seed);
        const run = createRun();
        let hits = 0;
        let cats = 0;
        for (let frame = 0; frame < 60 * 60 && run.phase === 'playing'; frame++) {
            spin(run, (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.1);
            for (const pop of [...run.pops]) {
                // Taps every mole it sees, and a cat now and then (a clumsy player).
                if (pop.kind === 'cat' && rng() > 0.02) continue;
                const s = popScreen(pop, run.rot, O);
                const hit = tap(run, s.x, s.y, O);
                if (!hit) continue;
                if (hit.kind === 'mole') hits++;
                else cats++;
            }
            step(run, 1 / 60, NO_KEYS, SHAPE, rng);
            const ids = run.pops.map((p) => p.hole.id);
            if (run.pops.length > 4) expect.fail(`seed ${seed}: ${run.pops.length} Pops out`);
            if (new Set(ids).size !== ids.length) expect.fail(`seed ${seed}: two Pops in one hole`);
            if (run.progress < 0) expect.fail(`seed ${seed}: negative progress`);
        }
        return { run, hits, cats };
    }

    it('keeps Pops ≤ 4, one per hole and progress ≥ 0, and always ends within 60 s', () => {
        let clears = 0;
        let fails = 0;
        let catsHit = 0;
        let molesHit = 0;
        for (let seed = 1; seed <= 30; seed++) {
            const { run, hits, cats } = simulate(seed);
            if (run.phase !== 'ending') expect.fail(`seed ${seed}: still playing after 60 s`);
            if (run.outcome === 'clear') clears++;
            else fails++;
            molesHit += hits;
            catsHit += cats;
        }
        // The runs must have exercised both outcomes and both kinds of hit, or the loop proves nothing.
        expect(clears).toBeGreaterThan(0);
        expect(fails).toBeGreaterThan(0);
        expect(molesHit).toBeGreaterThan(0);
        expect(catsHit).toBeGreaterThan(0);
    });
});
