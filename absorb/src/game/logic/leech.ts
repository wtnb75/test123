import {
    DRAIN_EPS, LEECH_DRAIN_MAX, LEECH_DRAIN_RADIUS, LEECH_FIELD_TINT_MAX, LEECH_HUD_FLASH, LEECH_PARTICLE_DURATION,
    LEECH_PARTICLE_MAX, LEECH_PARTICLE_MAX_PER_FRAME, LEECH_PARTICLE_PER_STOCK, LEECH_TETHER_MAX_WIDTH,
    LEECH_TETHER_MIN_WIDTH, type ActorKind
} from './constants';

/** Stock per second a leech `distance` px from the player drains: LEECH_DRAIN_MAX touching, 0 at LEECH_DRAIN_RADIUS and beyond. */
export function leechDrainRate(distance: number): number {
    if (distance >= LEECH_DRAIN_RADIUS) return 0;
    return LEECH_DRAIN_MAX * (1 - Math.max(distance, 0) / LEECH_DRAIN_RADIUS);
}

/** How far the absorb field's colour moves toward the leech colour for a total drain rate `rate` (stock per second). */
export function fieldTint(rate: number): number {
    return Math.min(Math.max(rate / LEECH_DRAIN_MAX, 0), 1) * LEECH_FIELD_TINT_MAX;
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

/** What a particle needs from a leech: where it is and whether it has been destroyed. */
export interface DrainSource {
    kind: ActorKind;
    x: number;
    y: number;
    removed: boolean;
}

/** One stock particle flowing from the player to the leech it was drained by. */
export interface DrainParticle {
    /** Seconds since it appeared. */
    age: number;
    source: DrainSource;
    /** Where the leech was when it was last seen alive: the end point once it is destroyed. */
    endX: number;
    endY: number;
}

/**
 * Stock particles along the tethers: each leech inside LEECH_DRAIN_RADIUS emits them at its drain rate times
 * LEECH_PARTICLE_PER_STOCK, and each flows from the player to the leech over LEECH_PARTICLE_DURATION.
 * Drawing only; they keep flowing through the ending.
 */
export class DrainParticles {
    readonly particles: DrainParticle[] = [];
    private readonly carries = new Map<DrainSource, number>();

    /**
     * Ages the particles by dt, then (when `active`, i.e. the phase is playing, and `stock` is at least 1)
     * emits new ones for the leeches in `enemies` around the player at (playerX, playerY).
     */
    update(
        dt: number, playerX: number, playerY: number, enemies: readonly DrainSource[], active: boolean, stock: number
    ): void {
        this.ageParticles(dt);
        // A destroyed leech leaves `enemies`, so nothing below would ever visit its entry again.
        for (const e of this.carries.keys()) if (e.removed) this.carries.delete(e);
        if (!active || stock < 1) {
            this.carries.clear();
            return;
        }
        for (const e of enemies) {
            if (e.kind !== 'leech' || e.removed) continue;
            const rate = leechDrainRate(Math.hypot(e.x - playerX, e.y - playerY));
            if (rate === 0) {
                this.carries.delete(e);
                continue;
            }
            const total = (this.carries.get(e) ?? 0) + rate * LEECH_PARTICLE_PER_STOCK * dt;
            const whole = Math.floor(total);
            this.carries.set(e, total - whole);
            const count = Math.min(whole, LEECH_PARTICLE_MAX_PER_FRAME);
            for (let i = 0; i < count; i++) this.particles.push({ age: 0, source: e, endX: e.x, endY: e.y });
        }
        const excess = this.particles.length - LEECH_PARTICLE_MAX;
        if (excess > 0) this.particles.splice(0, excess);
    }

    private ageParticles(dt: number): void {
        let kept = 0;
        for (const p of this.particles) {
            p.age += dt;
            if (p.age >= LEECH_PARTICLE_DURATION) continue;
            if (!p.source.removed) {
                p.endX = p.source.x;
                p.endY = p.source.y;
            }
            this.particles[kept++] = p;
        }
        this.particles.length = kept;
    }

    clear(): void {
        this.particles.length = 0;
        this.carries.clear();
    }
}

/** How far along its way a particle is: 0 at the player, 1 at the leech. */
export function particleProgress(age: number): number {
    return Math.min(Math.max(age / LEECH_PARTICLE_DURATION, 0), 1);
}

/** One coordinate of a particle `age` seconds old, between the player's (`from`) and the leech's (`end`). */
export function particleCoord(from: number, end: number, age: number): number {
    return from + (end - from) * particleProgress(age);
}

/** Whether a leech `distance` px from the player gets a tether: anything inside the drain range, the edge included. */
export function hasTether(distance: number): boolean {
    return distance <= LEECH_DRAIN_RADIUS;
}
