import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { HOLE_COUNT } from './board';
import { nextSpawnAt, planSpawn, rampPhase, stepSpawn } from './spawn';

/** A rand() that returns the given values in order and fails if asked for more. */
const seq = (values: number[]): (() => number) => {
    let i = 0;
    return () => {
        if (i >= values.length) throw new Error(`rand() called more than ${values.length} times`);
        return values[i++];
    };
};

/** mulberry32: a small seeded generator for the property test. */
const seeded = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

describe('rampPhase: the phase boundaries (docs/spec.md "段階")', () => {
    it('is the early phase (1200 ms, 4 pops) at the start and one millisecond before 20 s', () => {
        expect(rampPhase(0)).toEqual({ intervalMs: 1200, maxActive: 4 });
        expect(rampPhase(19999)).toEqual({ intervalMs: 1200, maxActive: 4 });
        expect(rampPhase(19999.999)).toEqual({ intervalMs: 1200, maxActive: 4 });
    });

    it('is the mid phase (1000 ms, 5 pops) exactly at 20 s and up to just before 40 s', () => {
        expect(rampPhase(20000)).toEqual({ intervalMs: 1000, maxActive: 5 });
        expect(rampPhase(39999.999)).toEqual({ intervalMs: 1000, maxActive: 5 });
    });

    it('is the late phase (800 ms, 6 pops) exactly at 40 s and to the end of the round', () => {
        expect(rampPhase(40000)).toEqual({ intervalMs: 800, maxActive: 6 });
        expect(rampPhase(60000)).toEqual({ intervalMs: 800, maxActive: 6 });
    });

    it('has the mid phase start before the late phase', () => {
        expect(PARAMS.rampMidAtMs).toBeGreaterThan(0);
        expect(PARAMS.rampMidAtMs).toBeLessThan(PARAMS.rampLateAtMs);
    });

    it('never lowers the cap and never lengthens the interval as time goes on (early -> mid -> late)', () => {
        const phases = [0, PARAMS.rampMidAtMs, PARAMS.rampLateAtMs].map(rampPhase);
        for (let i = 1; i < phases.length; i++) {
            expect(phases[i].maxActive).toBeGreaterThan(phases[i - 1].maxActive);
            expect(phases[i].intervalMs).toBeLessThan(phases[i - 1].intervalMs);
        }
    });

    it('keeps maxActiveLate (the size of the arrow pool) at least as large as the cap of every phase', () => {
        for (const t of [0, PARAMS.rampMidAtMs, PARAMS.rampLateAtMs, 60000]) {
            expect(PARAMS.maxActiveLate).toBeGreaterThanOrEqual(rampPhase(t).maxActive);
        }
    });
});

describe('nextSpawnAt: the interval of the phase of the check that just ran', () => {
    it('counts 1200 ms from a check at 19.9 s, so the next check is at 21.1 s (early phase)', () => {
        expect(nextSpawnAt(19900)).toBeCloseTo(21100, 6);
    });

    it('counts 1000 ms from a check at 20.0 s and at 39.9 s (mid phase)', () => {
        expect(nextSpawnAt(20000)).toBe(21000);
        expect(nextSpawnAt(39900)).toBeCloseTo(40900, 6);
    });

    it('counts 800 ms from a check at 40.0 s and at 50 s (late phase)', () => {
        expect(nextSpawnAt(40000)).toBe(40800);
        expect(nextSpawnAt(50000)).toBe(50800);
    });
});

describe('stepSpawn across the phases', () => {
    it('keeps one check per update in the late phase: a jump to 50 s runs one check and schedules 50.8 s', () => {
        // seq allows exactly one spawn's worth of draws: a catch-up loop would run out and throw
        const result = stepSpawn(50000, 21100, [], seq([0.5, 0, 0.5, 0.99, 0.99]));
        expect(result.plan).toEqual([{ hole: 0, kind: 'mole' }]);
        expect(result.scheduledAt).toBe(50800);
    });

    it('early phase, as before the ramp: a check at 19.999 s with the same draws gives the same plan, next check 1200 ms later', () => {
        const result = stepSpawn(19999.999, 19000, [], seq([0.5, 0, 0.5, 0.99, 0.99]));
        expect(result.plan).toEqual([{ hole: 0, kind: 'mole' }]);
        expect(result.scheduledAt).toBeCloseTo(21199.999, 6);
    });

    it('early phase with 4 pops out spawns nothing and draws nothing; mid with 4 pops spawns one; mid with 5 spawns nothing', () => {
        expect(stepSpawn(10000, 10000, [0, 1, 2, 3], seq([])).plan).toEqual([]);
        // room 1: no combo roll; hole pick 0 -> the first free hole (4); kind roll 0.5 -> mole
        expect(stepSpawn(25000, 25000, [0, 1, 2, 3], seq([0, 0.5, 0.99, 0.99])).plan).toEqual([{ hole: 4, kind: 'mole' }]);
        expect(stepSpawn(25000, 25000, [0, 1, 2, 3, 4], seq([])).plan).toEqual([]);
    });

    it('late phase with 5 pops out spawns one; with 6 pops out spawns nothing and draws nothing', () => {
        expect(stepSpawn(45000, 45000, [0, 1, 2, 3, 4], seq([0, 0.5, 0.99, 0.99])).plan).toEqual([{ hole: 5, kind: 'mole' }]);
        expect(stepSpawn(45000, 45000, [0, 1, 2, 3, 4, 5], seq([])).plan).toEqual([]);
    });

    it('still schedules the next check when the cap of the phase leaves no room', () => {
        expect(stepSpawn(25000, 25000, [0, 1, 2, 3, 4], seq([]))).toEqual({ plan: [], scheduledAt: 26000 });
        expect(stepSpawn(45000, 45000, [0, 1, 2, 3, 4, 5], seq([]))).toEqual({ plan: [], scheduledAt: 45800 });
    });
});

describe('combo opportunities follow the cap of the phase (comboRate itself is unchanged)', () => {
    // combo roll, anchor, two neighbours, then each mole's kind roll (0.5), clock roll (0.99: not a clock) and golden roll (0.99: not golden)
    const comboDraws = [0.1, 0, 0, 0, 0.5, 0.99, 0.99, 0.5, 0.99, 0.99, 0.5, 0.99, 0.99];

    it('early phase with 2 pops out has room 2: no combo roll, a single spawn', () => {
        expect(stepSpawn(10000, 10000, [0, 1], seq([0, 0.5, 0.99, 0.99])).plan).toEqual([{ hole: 2, kind: 'mole' }]);
    });

    it('mid phase with the same 2 pops out has room 3: a combo of the anchor 2 and its neighbours 3 and 9', () => {
        const plan = stepSpawn(25000, 25000, [0, 1], seq(comboDraws)).plan;
        expect(plan.map((p) => p.hole)).toEqual([2, 3, 9]);
    });

    it('late phase with 3 pops out has room 3: a combo of the anchor 3 and its neighbours 4 and 10', () => {
        const plan = stepSpawn(45000, 45000, [0, 1, 2], seq(comboDraws)).plan;
        expect(plan.map((p) => p.hole)).toEqual([3, 4, 10]);
    });

    it('mid phase with 3 pops out has room 2: no combo roll, a single spawn', () => {
        expect(stepSpawn(25000, 25000, [0, 1, 2], seq([0, 0.5, 0.99, 0.99])).plan).toEqual([{ hole: 3, kind: 'mole' }]);
    });
});

describe('planSpawn: the cap argument', () => {
    it('defaults to the early cap (4) when omitted', () => {
        expect(planSpawn([0, 1, 2, 3], seq([]))).toEqual([]);
    });

    it('uses the given cap for the room: cap 6 with 5 pops out spawns one, cap 5 with 5 spawns none', () => {
        expect(planSpawn([0, 1, 2, 3, 4], seq([0, 0.5, 0.99, 0.99]), undefined, 6)).toEqual([{ hole: 5, kind: 'mole' }]);
        expect(planSpawn([0, 1, 2, 3, 4], seq([]), undefined, 5)).toEqual([]);
    });
});

describe('planSpawn in every phase: invariants over many random states (oracle: room and board geometry)', () => {
    it('never exceeds the room of the phase, only uses free holes, and combos need room for comboSize', () => {
        const rand = seeded(777);
        const combosByPhase = [0, 0, 0];
        const times = [10000, 25000, 45000];
        for (let trial = 0; trial < 30000; trial++) {
            const p = trial % 3;
            const cap = rampPhase(times[p]).maxActive;
            const usedCount = Math.floor(rand() * (cap + 1));
            const used = new Set<number>();
            while (used.size < usedCount) used.add(Math.floor(rand() * HOLE_COUNT));
            const plan = stepSpawn(times[p], times[p], [...used], rand).plan;
            const room = cap - usedCount;
            if (plan.length > room) expect.fail(`phase ${p}: ${plan.length} pops > room ${room}`);
            if (room > 0 && plan.length === 0) expect.fail(`phase ${p}: nothing spawned with room ${room}`);
            if (room <= 0 && plan.length > 0) expect.fail(`phase ${p}: spawned with no room`);
            if (plan.some((s) => used.has(s.hole))) expect.fail(`phase ${p}: used hole chosen`);
            if (plan.length > 1) {
                combosByPhase[p]++;
                if (room < PARAMS.comboSize) expect.fail(`phase ${p}: combo with room ${room}`);
            }
        }
        // guard against a vacuous run: every phase produced combos
        for (const n of combosByPhase) expect(n).toBeGreaterThan(0);
    });
});
