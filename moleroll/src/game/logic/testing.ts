// Test helpers shared by the unit tests (no game logic here).
import type { Pop, Kind } from './pop';
import { buildCube } from './shape';

export const SHAPE = buildCube();

/** A Pop in the hole with this id. */
export const popIn = (holeId: number, kind: Kind = 'mole', age = 1): Pop => ({ hole: SHAPE.holes[holeId], kind, age });

/** Deterministic random numbers in [0, 1) (mulberry32). */
export function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A random number source that returns the given values in order, counting the calls. */
export function sequence(values: number[]): { rng: () => number; calls: () => number } {
    let i = 0;
    return {
        rng: () => {
            if (i >= values.length) throw new Error('random sequence exhausted');
            return values[i++];
        },
        calls: () => i,
    };
}
