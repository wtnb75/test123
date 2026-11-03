import {
    DRAIN_EPS, FIELD_RADIUS, LEECH_DRAIN_MAX, LEECH_HUD_FLASH, LEECH_TETHER_MAX_WIDTH, LEECH_TETHER_MIN_WIDTH
} from './constants';

/** Stock per second a leech `distance` px from the player drains: LEECH_DRAIN_MAX touching, 0 at FIELD_RADIUS and beyond. */
export function leechDrainRate(distance: number): number {
    if (distance >= FIELD_RADIUS) return 0;
    return LEECH_DRAIN_MAX * (1 - Math.max(distance, 0) / FIELD_RADIUS);
}

/** Width of a leech's tether at a given drain rate: LEECH_TETHER_MIN_WIDTH at 0, LEECH_TETHER_MAX_WIDTH at LEECH_DRAIN_MAX. */
export function tetherWidth(rate: number): number {
    const share = Math.min(Math.max(rate / LEECH_DRAIN_MAX, 0), 1);
    return LEECH_TETHER_MIN_WIDTH + (LEECH_TETHER_MAX_WIDTH - LEECH_TETHER_MIN_WIDTH) * share;
}

/** What one step of the drain tally did: the whole stock taken, and the fraction carried to the next step. */
export interface DrainStep {
    taken: number;
    carry: number;
}

/**
 * Adds `rate`·dt to the carried fraction and takes the whole units out of `stock` (never below 0). Once the stock
 * is 0 the fraction is dropped, so a drain that found nothing to take never eats stock absorbed later.
 */
export function drainStep(carry: number, rate: number, dt: number, stock: number): DrainStep {
    const total = carry + rate * dt;
    const whole = Math.max(0, Math.floor(total + DRAIN_EPS));
    const taken = Math.min(whole, stock);
    if (stock - taken <= 0) return { taken, carry: 0 };
    return { taken, carry: Math.max(0, total - whole) };
}

/**
 * The stock gauge's red cue: red from the frame a drain took stock until LEECH_HUD_FLASH has passed, restarting
 * whenever stock is taken again. Drawing only; it keeps running through the ending.
 */
export class StockFlash {
    private age = Infinity;

    /** Ages the cue by dt, then restarts it if `taken` stock was drained this step. */
    update(dt: number, taken: number): void {
        this.age += dt;
        if (taken > 0) this.age = 0;
    }

    get isRed(): boolean {
        return this.age < LEECH_HUD_FLASH;
    }

    clear(): void {
        this.age = Infinity;
    }
}
