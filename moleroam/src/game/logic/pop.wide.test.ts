import { describe, expect, it, vi } from 'vitest';

// With the real hitRadius (70) two holes are never both in range (spacing 320), so the
// nearest / tie rules of judgeStrike can only be exercised with a wider radius.
vi.mock('../params', async (importOriginal) => {
    const mod = await importOriginal<typeof import('../params')>();
    return { PARAMS: { ...mod.PARAMS, hitRadius: 200 } };
});

const { judgeStrike } = await import('./pop');

describe('judgeStrike with several pops in range', () => {
    const hole0 = { hole: 0, kind: 'mole' as const, spawnedAt: 0 }; // center (160, 160)
    const hole1 = { hole: 1, kind: 'cat' as const, spawnedAt: 0 }; // center (480, 160)
    const now = 800;

    it('hits the nearer pop', () => {
        expect(judgeStrike({ x: 300, y: 160 }, [hole0, hole1], now)).toBe(hole0);
        expect(judgeStrike({ x: 340, y: 160 }, [hole0, hole1], now)).toBe(hole1);
    });

    it('does not depend on list order', () => {
        expect(judgeStrike({ x: 340, y: 160 }, [hole1, hole0], now)).toBe(hole1);
        expect(judgeStrike({ x: 300, y: 160 }, [hole1, hole0], now)).toBe(hole0);
    });

    it('breaks an exact distance tie in favour of the lower hole index', () => {
        expect(judgeStrike({ x: 320, y: 160 }, [hole0, hole1], now)).toBe(hole0);
        expect(judgeStrike({ x: 320, y: 160 }, [hole1, hole0], now)).toBe(hole0);
    });

    it('skips a nearer pop that is still telegraphing', () => {
        const late = { hole: 0, kind: 'mole' as const, spawnedAt: 500 }; // telegraph until 1300
        expect(judgeStrike({ x: 300, y: 160 }, [late, hole1], now)).toBe(hole1);
    });
});
