import { describe, expect, it } from 'vitest';
import { HOLE_COUNT, holeCenter } from './board';
import { firstSpawnAt, isSpawnDue, neighborHoles, nextSpawnAt, planSpawn, stepSpawn } from './spawn';

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

const sorted = (list: number[]): number[] => [...list].sort((a, b) => a - b);

describe('spawn timing', () => {
    it('first check is 500 ms after the start', () => {
        expect(firstSpawnAt()).toBe(500);
    });

    it('next check is 1200 ms after the check that just ran', () => {
        expect(nextSpawnAt(500)).toBe(1700);
        expect(nextSpawnAt(10000)).toBe(11200);
    });

    it('is not due one millisecond before the first check and is due exactly at it', () => {
        expect(isSpawnDue(499.999, firstSpawnAt())).toBe(false);
        expect(isSpawnDue(500, firstSpawnAt())).toBe(true);
    });

    it('after a 10 s jump one check is due and the schedule restarts from that moment', () => {
        const scheduled = firstSpawnAt();
        expect(isSpawnDue(10000, scheduled)).toBe(true);
        const next = nextSpawnAt(10000);
        expect(next).toBe(11200);
        expect(isSpawnDue(10001, next)).toBe(false);
        expect(isSpawnDue(11199.999, next)).toBe(false);
        expect(isSpawnDue(11200, next)).toBe(true);
    });
});

describe('stepSpawn', () => {
    it('does nothing and draws no random value before the scheduled time', () => {
        expect(stepSpawn(499.999, 500, [], seq([]))).toEqual({ plan: [], scheduledAt: 500 });
    });

    it('plans one spawn exactly at the scheduled time and schedules the next check 1200 ms later', () => {
        // combo roll 0.5 (no combo), hole pick 0 -> hole 0, kind roll 0.5 -> mole
        expect(stepSpawn(500, 500, [], seq([0.5, 0, 0.5]))).toEqual({
            plan: [{ hole: 0, kind: 'mole' }],
            scheduledAt: 1700,
        });
    });

    it('runs one check only after a 10 s jump and counts the next check from that moment', () => {
        // seq allows exactly one spawn's worth of draws: a catch-up loop would run out and throw
        const result = stepSpawn(10000, 500, [], seq([0.5, 0, 0.5]));
        expect(result.plan).toHaveLength(1);
        expect(result.scheduledAt).toBe(11200);
    });

    it('still schedules the next check when there is no room to spawn', () => {
        expect(stepSpawn(2000, 1700, [0, 1, 2, 3], seq([]))).toEqual({ plan: [], scheduledAt: 3200 });
    });
});

describe('neighborHoles', () => {
    it('gives 3 neighbours for the top-left corner', () => {
        expect(sorted(neighborHoles(0))).toEqual([1, 8, 9]);
    });

    it('gives 3 neighbours for the other corners (never wraps to the next row)', () => {
        expect(sorted(neighborHoles(7))).toEqual([6, 14, 15]);
        expect(sorted(neighborHoles(47))).toEqual([38, 39, 46]);
    });

    it('gives 8 neighbours for an inner hole', () => {
        expect(sorted(neighborHoles(9))).toEqual([0, 1, 2, 8, 10, 16, 17, 18]);
    });

    it('gives 5 neighbours for an edge hole', () => {
        expect(sorted(neighborHoles(3))).toEqual([2, 4, 10, 11, 12]);
    });

    it('does not include the hole itself', () => {
        expect(neighborHoles(20)).not.toContain(20);
    });
});

describe('planSpawn: single spawn', () => {
    it('picks the free hole chosen by the random value, and a mole when the roll is exactly friendRate', () => {
        // combo roll 0.5 (no combo), hole pick 0 -> hole 0, kind roll 0.25 -> mole (a cat needs < 0.25)
        expect(planSpawn([], seq([0.5, 0, 0.25]))).toEqual([{ hole: 0, kind: 'mole' }]);
    });

    it('makes a cat when the roll is just under friendRate', () => {
        expect(planSpawn([], seq([0.5, 0, 0.2499]))).toEqual([{ hole: 0, kind: 'cat' }]);
    });

    it('does not make a combo when the roll is exactly comboRate (a combo needs < 0.2)', () => {
        expect(planSpawn([], seq([0.2, 0, 0.9]))).toHaveLength(1);
    });

    it('never picks a hole in use, and draws no combo roll when there is no room for a combo', () => {
        // 3 pops out: room 1 < comboSize, so only the hole pick and the kind roll are drawn
        expect(planSpawn([0, 1, 2], seq([0, 0.5]))).toEqual([{ hole: 3, kind: 'mole' }]);
    });

    it('picks the last free hole for a random value just under 1, and tolerates exactly 1', () => {
        expect(planSpawn([], seq([0.5, 0.999, 0.5]))[0].hole).toBe(47);
        expect(planSpawn([], seq([0.5, 1, 0.5]))[0].hole).toBe(47);
    });

    it('spawns nothing when all 4 slots are taken, without drawing any random value', () => {
        expect(planSpawn([0, 1, 2, 3], seq([]))).toEqual([]);
    });
});

describe('planSpawn: combo spawn', () => {
    it('spawns an anchor and two of its neighbours with independent kinds', () => {
        // combo roll 0.1; anchor pick 0 -> hole 0; near [1, 8, 9]: pick 0 -> 1, then near [8, 9]: pick 0.99 -> 9;
        // kind rolls 0.9 / 0.1 / 0.5 -> mole, cat, mole
        expect(planSpawn([], seq([0.1, 0, 0, 0.99, 0.9, 0.1, 0.5]))).toEqual([
            { hole: 0, kind: 'mole' },
            { hole: 1, kind: 'cat' },
            { hole: 9, kind: 'mole' },
        ]);
    });

    it('makes a combo just under comboRate', () => {
        expect(planSpawn([], seq([0.1999, 0, 0, 0, 0.5, 0.5, 0.5]))).toHaveLength(3);
    });

    it('can be made of cats only', () => {
        const plan = planSpawn([], seq([0.1, 0, 0, 0, 0.1, 0.1, 0.1]));
        expect(plan.map((p) => p.kind)).toEqual(['cat', 'cat', 'cat']);
    });

    it('works from a corner anchor (last hole) without leaving the board', () => {
        const plan = planSpawn([], seq([0.1, 0.999, 0, 0, 0.5, 0.5, 0.5]));
        expect(plan.map((p) => p.hole)).toEqual([47, 38, 39]);
    });

    it('skips neighbours that are in use', () => {
        // used [1]: room 3, so a combo is possible; the free list starts at 0, which is the anchor,
        // and its free neighbours are 8 and 9
        const plan = planSpawn([1], seq([0.1, 0, 0, 0, 0.5, 0.5, 0.5]));
        expect(plan.map((p) => p.hole)).toEqual([0, 8, 9]);
    });

    it('does not make a combo when there are fewer free slots than comboSize', () => {
        // 2 pops out -> room 2: no combo roll is drawn and one pop appears
        expect(planSpawn([0, 1], seq([0, 0.5]))).toHaveLength(1);
    });
});

describe('planSpawn: invariants over many random states (oracle: board geometry)', () => {
    it('only uses free holes, never duplicates, respects room, and keeps combos adjacent', () => {
        const rand = seeded(12345);
        let combos = 0;
        let singles = 0;
        let cats = 0;
        let moles = 0;
        for (let trial = 0; trial < 20000; trial++) {
            const usedCount = Math.floor(rand() * 5); // 0..4 pops already out
            const used = new Set<number>();
            while (used.size < usedCount) used.add(Math.floor(rand() * HOLE_COUNT));
            const plan = planSpawn([...used], rand);
            const room = 4 - usedCount;
            if (plan.length > room) expect.fail(`too many pops: ${plan.length} > room ${room}`);
            if (room === 0 && plan.length !== 0) expect.fail('spawned with no room');
            if (room > 0 && plan.length === 0) expect.fail('spawned nothing though there was room');
            const holes = plan.map((p) => p.hole);
            if (new Set(holes).size !== holes.length) expect.fail(`duplicate holes ${holes}`);
            for (const p of plan) {
                if (used.has(p.hole)) expect.fail(`used hole ${p.hole} chosen`);
                if (p.kind === 'cat') cats++;
                else moles++;
            }
            if (plan.length > 1) {
                combos++;
                if (room < 3) expect.fail('combo without room');
                const a = holeCenter(holes[0]);
                for (const h of holes.slice(1)) {
                    const c = holeCenter(h);
                    const adjacent = Math.abs(c.x - a.x) <= 320 && Math.abs(c.y - a.y) <= 320;
                    if (!adjacent) expect.fail(`hole ${h} is not next to anchor ${holes[0]}`);
                }
            } else if (plan.length === 1) {
                singles++;
            }
        }
        // guard against a vacuous run
        expect(combos).toBeGreaterThan(0);
        expect(singles).toBeGreaterThan(0);
        expect(cats).toBeGreaterThan(0);
        expect(moles).toBeGreaterThan(0);
    });
});
