// Helpers for the unit tests (random numbers that can be scripted or seeded).
import type { Rng } from './words';

/** Returns the given numbers in order, then `fallback` forever. */
export function seqRng(values: readonly number[], fallback = 0): Rng {
    let i = 0;
    return () => (i < values.length ? values[i++] : fallback);
}

/** A small seeded generator (numbers in [0, 1)), so random runs are reproducible. */
export function seededRng(seed: number): Rng {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}
