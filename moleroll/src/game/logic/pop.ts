// Pop = one mole or cat out of a hole (docs/spec.md "Pop の状態").
import { HIT_MIN_POP_RATIO, LIFE_SEC, POP_HEIGHT, POP_IN_SEC, POP_OUT_SEC } from '../params';
import { isFacing, type Mat3 } from './math';
import type { Hole } from './shape';

export type Kind = 'mole' | 'cat';

export interface Pop {
    hole: Hole;
    kind: Kind;
    /** Seconds since it came out. */
    age: number;
}

/** How far the Pop is out of its hole (solid-local length) at `age`: 0 → POP_HEIGHT → 0. */
export function popHeight(age: number): number {
    const up = age / POP_IN_SEC;
    const down = (LIFE_SEC - age) / POP_OUT_SEC;
    return POP_HEIGHT * Math.max(0, Math.min(1, Math.min(up, down)));
}

/** A Pop can be hit while its face is seen and it is out far enough. */
export function isHittable(pop: Pop, m: Mat3): boolean {
    return isFacing(m, pop.hole) && popHeight(pop.age) >= POP_HEIGHT * HIT_MIN_POP_RATIO;
}

/** Remaining life in seconds. */
export function remainingLife(pop: Pop): number {
    return LIFE_SEC - pop.age;
}
