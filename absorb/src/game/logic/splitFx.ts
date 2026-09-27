import {
    SPLIT_RING_DURATION, SPLIT_RING_MAX_RADIUS, SPLITTER_DASH_WARN, SPLITTER_DASH_WARN_BLINK, SPLITTER_RADIUS
} from './constants';
import { effectProgress } from './effects';
import { TIMER_EPSILON, scatterLeft, type Enemy } from './enemy';
import { removeWhere, type Point } from './geometry';

/**
 * Whether a splitter child is drawn white this frame: over the last SPLITTER_DASH_WARN seconds of its
 * scatter it alternates white / body colour every blink step, starting white. Uses the same slack as the
 * scatter-to-dash switch, so the blink lines up with it at 60 fps.
 */
export function childFlashesWhite(child: Pick<Enemy, 'state' | 'stateTime'>): boolean {
    const left = scatterLeft(child);
    if (child.state !== 'scatter' || left > SPLITTER_DASH_WARN + TIMER_EPSILON) return false;
    const w = SPLITTER_DASH_WARN - left;
    return Math.floor((w + TIMER_EPSILON) / SPLITTER_DASH_WARN_BLINK) % 2 === 0;
}

/** One split ring, left where the splitter split. */
export interface SplitRing extends Point {
    age: number;
}

const isRingOver = (r: SplitRing): boolean => r.age >= SPLIT_RING_DURATION;

/**
 * The split rings in play, one per splitter that split. Drawing only: the rules never read this. It plays
 * on whatever the phase, including while ending.
 */
export class SplitEffects {
    readonly rings: SplitRing[] = [];

    /** Ages every ring by dt, drops finished ones, then starts one per split this frame. */
    update(dt: number, splits: readonly Point[]): void {
        for (const r of this.rings) r.age += dt;
        removeWhere(this.rings, isRingOver);
        for (const s of splits) this.rings.push({ x: s.x, y: s.y, age: 0 });
    }

    clear(): void {
        this.rings.length = 0;
    }
}

/** Progress of a split ring t seconds after the split; -1 when not showing. */
export function splitRingProgress(t: number): number {
    return effectProgress(t, SPLIT_RING_DURATION);
}

/** Ring radius at the given progress: from the splitter's size out to SPLIT_RING_MAX_RADIUS. */
export function splitRingRadius(progress: number): number {
    return SPLITTER_RADIUS + (SPLIT_RING_MAX_RADIUS - SPLITTER_RADIUS) * progress;
}
