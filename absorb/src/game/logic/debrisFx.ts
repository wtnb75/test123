import {
    DEBRIS_COUNT, DEBRIS_DURATION, DEBRIS_RADIUS, DEBRIS_RAMMER_WHITEN, DEBRIS_SPEED, type EnemyKind
} from './constants';
import { effectProgress } from './effects';
import { removeWhere } from './geometry';
import type { Defeat } from './world';

/** One killed enemy's debris burst, from where it died; piece 0 flies along the killing bullet's heading. */
export interface DebrisBurst extends Defeat {
    age: number;
}

const isBurstOver = (b: DebrisBurst): boolean => b.age >= DEBRIS_DURATION;

/**
 * The debris bursts in play, one per regular enemy a release bullet killed. Drawing only: the rules
 * never read this, so debris can't hit anything. Bursts play out even while the run is ending.
 */
export class DebrisEffects {
    readonly bursts: DebrisBurst[] = [];

    /** Ages every burst by dt, drops finished ones, then starts one per enemy killed this frame. */
    update(dt: number, defeated: readonly Defeat[]): void {
        for (const b of this.bursts) b.age += dt;
        removeWhere(this.bursts, isBurstOver);
        for (const d of defeated) this.bursts.push({ ...d, age: 0 });
    }

    clear(): void {
        this.bursts.length = 0;
    }
}

/** Progress of a burst t seconds after the kill; -1 when not showing. */
export function debrisProgress(t: number): number {
    return effectProgress(t, DEBRIS_DURATION);
}

/** Direction of debris piece i, evenly spaced clockwise (screen coordinates) from the heading. */
export function debrisAngle(heading: number, i: number): number {
    return heading + (i * Math.PI * 2) / DEBRIS_COUNT;
}

/** How far the debris has flown: launched at DEBRIS_SPEED and slowing linearly to a stop. */
export function debrisDistance(progress: number): number {
    return DEBRIS_SPEED * DEBRIS_DURATION * (progress - (progress * progress) / 2);
}

/** Where debris piece i of a burst is at the given progress. */
export function debrisPieceX(b: DebrisBurst, i: number, progress: number): number {
    return b.x + Math.cos(debrisAngle(b.heading, i)) * debrisDistance(progress);
}

export function debrisPieceY(b: DebrisBurst, i: number, progress: number): number {
    return b.y + Math.sin(debrisAngle(b.heading, i)) * debrisDistance(progress);
}

/** Pushes each channel of a 0xRRGGBB color toward 255 by `amount` (0 keeps it, 1 gives white), rounded. */
export function whiten(color: number, amount: number): number {
    let out = 0;
    for (let shift = 16; shift >= 0; shift -= 8) {
        const c = (color >> shift) & 0xff;
        out |= Math.round(c + (255 - c) * amount) << shift;
    }
    return out;
}

/** Debris color for a kind with the given body color: lightened by `amount` for rammers only; other kinds ignore it. */
export function debrisColor(kind: EnemyKind, body: number, amount = DEBRIS_RAMMER_WHITEN): number {
    return kind === 'rammer' ? whiten(body, amount) : body;
}

export function debrisRadius(progress: number): number {
    return DEBRIS_RADIUS * (1 - progress);
}
