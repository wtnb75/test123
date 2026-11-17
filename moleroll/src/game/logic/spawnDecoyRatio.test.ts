import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDENTITY } from './math';
import { SHAPE, sequence } from './testing';

// DECOY_RATIO is a constant in params.ts: load spawn.ts afresh with the extreme values 0 and 1.
async function pickWithRatio(ratio: number, draws: number[]) {
    vi.resetModules();
    vi.doMock('../params', async (importOriginal) => ({
        ...(await importOriginal<typeof import('../params')>()),
        DECOY_RATIO: ratio,
    }));
    const { pickSpawn } = await import('./spawn');
    const { rng, calls } = sequence(draws);
    const pick = pickSpawn(SHAPE.holes, new Set(), IDENTITY, rng);
    return { pick, calls: calls() };
}

afterEach(() => {
    vi.doUnmock('../params');
    vi.resetModules();
});

describe('pickSpawn with extreme decoy ratios', () => {
    // [back, hole, cat, decoy draw]: hole choice and kind do not depend on the ratio.
    const draws = [0.59, 0, 0.1999, 0.9999];

    it('decoyRatio 0: a cat is always a plain cat, and the decoy draw is still made (four draws)', async () => {
        const { pick, calls } = await pickWithRatio(0, [0.59, 0, 0.1999, 0]);
        expect(pick).toMatchObject({ kind: 'cat', decoy: false });
        expect(calls).toBe(4);
    });

    it('decoyRatio 1: a cat is always a decoy (even for a draw of 0.9999), with four draws', async () => {
        const { pick, calls } = await pickWithRatio(1, draws);
        expect(pick).toMatchObject({ kind: 'cat', decoy: true });
        expect(calls).toBe(4);
    });

    it('the hole and kind picked are the same for ratio 0 and 1 (only the decoy flag differs)', async () => {
        const zero = await pickWithRatio(0, draws);
        const one = await pickWithRatio(1, draws);
        expect(zero.pick?.hole.id).toBe(one.pick?.hole.id);
        expect(zero.pick?.kind).toBe(one.pick?.kind);
    });

    it('a mole is never a decoy, even at ratio 1, and takes three draws', async () => {
        const { pick, calls } = await pickWithRatio(1, [0.6, 0, 0.2]);
        expect(pick).toMatchObject({ kind: 'mole', decoy: false });
        expect(calls).toBe(3);
    });
});
