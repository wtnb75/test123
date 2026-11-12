import {
    FIELD_RADIUS, POWERUP_BLINK_HALF_PERIOD, POWERUP_BLINK_TIME, POWERUP_DURATION, POWERUP_EPS, POWERUP_FIELD_RADIUS,
    POWERUP_ITEM_RADIUS, POWERUP_ITEM_SPEED, POWERUP_PICKUP_RING_DURATION
} from './constants';
import { effectProgress } from './effects';
import type { Point } from './geometry';

/** A reward item falling from where a carrier was killed (docs/spec/powerup.md). */
export interface PowerupItem extends Point {
    removed: boolean;
}

/** What one item does in a frame. */
export type ItemFate = 'falling' | 'taken' | 'gone';

/**
 * Moves an item down by one frame and decides its fate: taken when its centre is within `fieldRadius` of the
 * player (only if `canTake`), gone once it is fully below the screen, otherwise still falling. The take is
 * checked after the move and before the off-screen test, so an item leaving the screen is still taken if it
 * is inside the field that frame.
 */
export function stepItem(item: PowerupItem, dt: number, player: Point, fieldRadius: number, canTake: boolean, screenHeight: number): ItemFate {
    item.y += POWERUP_ITEM_SPEED * dt;
    const dx = item.x - player.x;
    const dy = item.y - player.y;
    if (canTake && dx * dx + dy * dy <= fieldRadius * fieldRadius) return 'taken';
    return item.y > screenHeight + POWERUP_ITEM_RADIUS ? 'gone' : 'falling';
}

/** Where a killed carrier's item starts: the carrier's spot, with x kept on the screen. */
export function itemDropPoint(carrier: Point, screenWidth: number): Point {
    return { x: Math.min(Math.max(carrier.x, 0), screenWidth), y: carrier.y };
}

/**
 * The boost clock after a frame's time has been added: `elapsed` seconds since the item was taken (null when no
 * boost). The boost ends at POWERUP_DURATION (within POWERUP_EPS, since the clock is a sum of frame deltas).
 */
export function advanceBoost(elapsed: number | null, dt: number): number | null {
    if (elapsed === null) return null;
    const next = elapsed + dt;
    return next >= POWERUP_DURATION - POWERUP_EPS ? null : next;
}

/** The absorb radius while the boost clock reads `elapsed` (null = no boost). */
export function boostFieldRadius(elapsed: number | null): number {
    return elapsed === null ? FIELD_RADIUS : POWERUP_FIELD_RADIUS;
}

/**
 * Whether the field's edge is gold while the boost clock reads `elapsed`: always at first, then from the last
 * POWERUP_BLINK_TIME seconds on, gold in the even half periods and the normal colour in the odd ones.
 */
export function edgeIsGold(elapsed: number | null): boolean {
    if (elapsed === null) return false;
    const blinkFrom = POWERUP_DURATION - POWERUP_BLINK_TIME;
    if (elapsed < blinkFrom) return true;
    return Math.floor((elapsed - blinkFrom) / POWERUP_BLINK_HALF_PERIOD) % 2 === 0;
}

/** Progress of the pickup ring `age` seconds after it started; -1 when not showing. */
export function pickupRingProgress(age: number): number {
    return effectProgress(age, POWERUP_PICKUP_RING_DURATION);
}

/** Pickup ring radius: it grows from the normal field to the boosted field. */
export function pickupRingRadius(progress: number): number {
    return FIELD_RADIUS + (POWERUP_FIELD_RADIUS - FIELD_RADIUS) * progress;
}

/**
 * The pickup ring in play: one ring that restarts whenever an item is taken. Drawing only; the rules never
 * read this. Like the absorb effects it only lives while playing, so any other phase (including the frame the
 * run ends) clears it and starts nothing.
 */
export class PickupEffects {
    /** Seconds since the ring started; Infinity when none is playing. */
    ringAge = Infinity;

    update(dt: number, taken: number, playing: boolean): void {
        if (!playing) {
            this.clear();
            return;
        }
        this.ringAge += dt;
        if (taken > 0) this.ringAge = 0;
    }

    clear(): void {
        this.ringAge = Infinity;
    }
}
