// Helpers shared by the unit tests (deterministic randomness).
import type { Rng } from './words';

/** An Rng returning the given values in order, then repeating the last one. */
export function seq(...values: number[]): Rng {
    let i = 0;
    return () => values[Math.min(i++, values.length - 1)];
}

/** A seeded pseudo-random Rng in [0, 1) (mulberry32), for property-style loops. */
export function seeded(seed: number): Rng {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
