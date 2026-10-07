import { describe, expect, it, vi } from 'vitest';

// With the real parameters (maxActive 4, comboSize 3) a combo always finds enough free neighbours,
// so the "fewer holes than comboSize" rule is only reachable with a larger board load.
vi.mock('../params', async (importOriginal) => {
    const mod = await importOriginal<typeof import('../params')>();
    return { PARAMS: { ...mod.PARAMS, maxActive: 8, comboSize: 5 } };
});

const { planSpawn } = await import('./spawn');

const seq = (values: number[]): (() => number) => {
    let i = 0;
    return () => {
        if (i >= values.length) throw new Error(`rand() called more than ${values.length} times`);
        return values[i++];
    };
};

describe('planSpawn when the neighbours are mostly taken', () => {
    it('spawns fewer than comboSize holes: only the anchor and its free neighbours', () => {
        // used [1, 8] -> room 6 >= 5, so a combo is possible. Anchor pick 0 -> hole 0, whose only free
        // neighbour is 9 (1 and 8 are in use). Kind rolls: mole, cat.
        const plan = planSpawn([1, 8], seq([0.1, 0, 0, 0.9, 0.1]));
        expect(plan).toEqual([
            { hole: 0, kind: 'mole' },
            { hole: 9, kind: 'cat' },
        ]);
    });

    it('still spawns the anchor alone when every neighbour is in use', () => {
        const plan = planSpawn([1, 8, 9], seq([0.1, 0, 0.9]));
        expect(plan).toEqual([{ hole: 0, kind: 'mole' }]);
    });
});
