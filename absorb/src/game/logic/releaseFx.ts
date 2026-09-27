import {
    PLAYER_RADIUS, RELEASE_RING_DURATION, RELEASE_RING_MAX_RADIUS, RELEASE_RING_MAX_WIDTH, RELEASE_RING_MIN_RADIUS,
    RELEASE_RING_MIN_WIDTH, STOCK_MAX
} from './constants';
import { effectProgress } from './effects';
import { removeWhere } from './geometry';
import type { Release } from './world';

/** One release's shockwave ring, left where the player was when it fired. */
export interface ReleaseRing extends Release {
    age: number;
}

const isRingOver = (r: ReleaseRing): boolean => r.age >= RELEASE_RING_DURATION;

/**
 * The shockwave rings in play, one per release. Drawing only: the rules never read this. It plays on
 * whatever the phase, including while ending.
 */
export class ReleaseEffects {
    readonly rings: ReleaseRing[] = [];

    /** Ages every ring by dt, drops finished ones, then starts one per release fired this frame. */
    update(dt: number, releases: readonly Release[]): void {
        for (const r of this.rings) r.age += dt;
        removeWhere(this.rings, isRingOver);
        for (const r of releases) this.rings.push({ ...r, age: 0 });
    }

    clear(): void {
        this.rings.length = 0;
    }
}

/** Whether this frame's releases should shake the camera: only a full-stock release does. */
export function startsShake(releases: readonly Release[]): boolean {
    return releases.some((r) => r.count >= STOCK_MAX);
}

/** Progress of a ring t seconds after its release; -1 when not showing. */
export function releaseRingProgress(t: number): number {
    return effectProgress(t, RELEASE_RING_DURATION);
}

/** Final radius of the ring for a release of `count` bullets. */
export function releaseRingMaxRadius(count: number): number {
    return RELEASE_RING_MIN_RADIUS + ((RELEASE_RING_MAX_RADIUS - RELEASE_RING_MIN_RADIUS) * count) / STOCK_MAX;
}

export function releaseRingWidth(count: number): number {
    return RELEASE_RING_MIN_WIDTH + ((RELEASE_RING_MAX_WIDTH - RELEASE_RING_MIN_WIDTH) * count) / STOCK_MAX;
}

/** Ring radius at the given progress: from the player's size out to its final radius. */
export function releaseRingRadius(count: number, progress: number): number {
    return PLAYER_RADIUS + (releaseRingMaxRadius(count) - PLAYER_RADIUS) * progress;
}
