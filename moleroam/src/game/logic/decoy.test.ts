import { describe, expect, it } from 'vitest';
import { showsArrow, type Pop } from './pop';
import { rollDecoy, rollDecoys, stepSpawn, type Kind } from './spawn';

/** A rand() that returns the given values in order, fails if asked for more, and counts its calls. */
const seq = (values: number[]): { rand: () => number; calls: () => number } => {
    let i = 0;
    return {
        rand: () => {
            if (i >= values.length) throw new Error(`rand() called more than ${values.length} times`);
            return values[i++];
        },
        calls: () => i,
    };
};

/** mulberry32: a small seeded generator for the share check. */
const seeded = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

describe('rollDecoy', () => {
    it('makes a cat a decoy when the random value is just under decoyRate (0.2999)', () => {
        expect(rollDecoy('cat', seq([0.2999]).rand)).toBe(true);
    });

    it('does not make a cat a decoy at exactly decoyRate (0.3) or above', () => {
        expect(rollDecoy('cat', seq([0.3]).rand)).toBe(false);
        expect(rollDecoy('cat', seq([0.9]).rand)).toBe(false);
    });

    it('makes a cat a decoy at the lowest random value 0', () => {
        expect(rollDecoy('cat', seq([0]).rand)).toBe(true);
    });

    it('never makes a mole a decoy and draws no random value for it', () => {
        const r = seq([]); // any call would throw
        expect(rollDecoy('mole', r.rand)).toBe(false);
        expect(r.calls()).toBe(0);
    });

    it('draws exactly once per cat', () => {
        const r = seq([0.5]);
        rollDecoy('cat', r.rand);
        expect(r.calls()).toBe(1);
    });

    it('over a plan draws once per cat in plan order and skips moles: [cat, mole, cat] uses two values', () => {
        const kinds: Kind[] = ['cat', 'mole', 'cat'];
        const r = seq([0.1, 0.5]);
        expect(kinds.map((k) => rollDecoy(k, r.rand))).toEqual([true, false, false]);
        expect(r.calls()).toBe(2);
    });

    it('over a plan of only moles draws nothing', () => {
        const r = seq([]);
        expect((['mole', 'mole', 'mole'] as Kind[]).map((k) => rollDecoy(k, r.rand))).toEqual([false, false, false]);
        expect(r.calls()).toBe(0);
    });

    it('turns about 30% of many cats into decoys (seeded, 20000 cats; both outcomes occur)', () => {
        const rand = seeded(2024);
        let decoys = 0;
        let ordinary = 0;
        for (let i = 0; i < 20000; i++) {
            if (rollDecoy('cat', rand)) decoys++;
            else ordinary++;
        }
        expect(decoys).toBeGreaterThan(0);
        expect(ordinary).toBeGreaterThan(0);
        expect(decoys / 20000).toBeGreaterThan(0.28);
        expect(decoys / 20000).toBeLessThan(0.32);
    });
});

describe('rollDecoys after a real spawn plan (stepSpawn then rollDecoys, one random source)', () => {
    it('rolls only for the cat, after the plan: a combo [mole, cat, mole] uses 7 plan draws then 1 decoy draw', () => {
        // plan draws (see the combo case in spawn.test.ts): combo roll 0.1, anchor 0, near 0 and 0.99, kinds 0.9 / 0.1 / 0.5
        // = mole at hole 0, cat at hole 1, mole at hole 9. Then one decoy draw for the cat: 0.2 -> decoy.
        const r = seq([0.1, 0, 0, 0.99, 0.9, 0.1, 0.5, 0.2]);
        const { plan } = stepSpawn(500, 500, [], r.rand);
        expect(r.calls()).toBe(7);
        const rolled = rollDecoys(plan, r.rand);
        expect(r.calls()).toBe(8);
        expect(rolled).toEqual([
            { hole: 0, kind: 'mole', decoy: false },
            { hole: 1, kind: 'cat', decoy: true },
            { hole: 9, kind: 'mole', decoy: false },
        ]);
    });

    it('gives the first cat in plan order the first decoy draw: [cat, cat, mole] with draws 0.5 then 0.1 -> [no, yes]', () => {
        // plan draws: combo roll 0.1, anchor 0, near 0 and 0.99, kinds 0.1 / 0.1 / 0.9 = cat at 0, cat at 1, mole at 9
        const r = seq([0.1, 0, 0, 0.99, 0.1, 0.1, 0.9, 0.5, 0.1]);
        const { plan } = stepSpawn(500, 500, [], r.rand);
        const rolled = rollDecoys(plan, r.rand);
        expect(rolled.map((p) => [p.hole, p.kind, p.decoy])).toEqual([
            [0, 'cat', false],
            [1, 'cat', true],
            [9, 'mole', false],
        ]);
        expect(r.calls()).toBe(9);
    });

    it('draws nothing for an empty plan (a check that is not due, or has no room)', () => {
        const r = seq([]);
        expect(rollDecoys(stepSpawn(499.999, 500, [], r.rand).plan, r.rand)).toEqual([]);
        expect(r.calls()).toBe(0);
    });

    it('draws nothing when the board is full of pops (no room): the check is due but the plan is empty', () => {
        const r = seq([]); // a due check with 4 pops out must not draw anything, for the plan or for decoys
        const { plan, scheduledAt } = stepSpawn(2000, 1700, [0, 1, 2, 3], r.rand);
        expect(plan).toEqual([]);
        expect(scheduledAt).toBe(3200);
        expect(rollDecoys(plan, r.rand)).toEqual([]);
        expect(r.calls()).toBe(0);
    });

    it('draws nothing for a plan of moles only and marks none as decoys', () => {
        const r = seq([]);
        const rolled = rollDecoys([{ hole: 4, kind: 'mole' }], r.rand);
        expect(rolled).toEqual([{ hole: 4, kind: 'mole', decoy: false }]);
        expect(r.calls()).toBe(0);
    });
});

describe('showsArrow', () => {
    // spawned at 1000: telegraph until 1800, up until 4800, then gone
    const mole: Pop = { hole: 0, kind: 'mole', spawnedAt: 1000 };
    const cat: Pop = { hole: 1, kind: 'cat', spawnedAt: 1000 };
    const decoy: Pop = { hole: 2, kind: 'cat', spawnedAt: 1000, decoy: true };
    const notDecoy: Pop = { hole: 3, kind: 'cat', spawnedAt: 1000, decoy: false };

    it('gives a mole an arrow from its telegraph through the last moment it is up', () => {
        expect(showsArrow(mole, 1000)).toBe(true);
        expect(showsArrow(mole, 1799.999)).toBe(true);
        expect(showsArrow(mole, 1800)).toBe(true);
        expect(showsArrow(mole, 4799.999)).toBe(true);
    });

    it('gives a decoy cat an arrow in the same states as a mole', () => {
        expect(showsArrow(decoy, 1000)).toBe(true);
        expect(showsArrow(decoy, 1800)).toBe(true);
        expect(showsArrow(decoy, 4799.999)).toBe(true);
    });

    it('never gives an ordinary cat an arrow, with the decoy flag absent or false', () => {
        for (const t of [1000, 1799.999, 1800, 4799.999]) {
            expect(showsArrow(cat, t)).toBe(false);
            expect(showsArrow(notDecoy, t)).toBe(false);
        }
    });

    it('takes the arrow away exactly when the pop is gone (4800 ms), for moles and decoys', () => {
        expect(showsArrow(mole, 4800)).toBe(false);
        expect(showsArrow(decoy, 4800)).toBe(false);
        expect(showsArrow(mole, 99999)).toBe(false);
    });

    it('does not depend on the decoy flag for a mole (it has an arrow either way)', () => {
        expect(showsArrow({ ...mole, decoy: false }, 2000)).toBe(true);
        expect(showsArrow({ ...mole, decoy: true }, 2000)).toBe(true);
    });
});
