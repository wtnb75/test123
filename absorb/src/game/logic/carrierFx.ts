import { CARRIER_DROP_FLASH } from './constants';
import { removeWhere } from './geometry';
import type { Enemy } from './enemy';

/** One carrier's drop flash: its centre mark shows white while age < CARRIER_DROP_FLASH. */
export interface DropFlash {
    carrier: Enemy;
    age: number;
}

const isFlashOver = (f: DropFlash): boolean => f.age >= CARRIER_DROP_FLASH || f.carrier.removed;

/**
 * Drop flashes in play, at most one per carrier. Drawing only: the rules never read this. A flash ends
 * after CARRIER_DROP_FLASH or when its carrier is gone, and plays on whatever the phase.
 */
export class DropFlashes {
    readonly flashes: DropFlash[] = [];

    /** Ages every flash by dt, drops finished ones, then (re)starts one per carrier that dropped this frame. */
    update(dt: number, droppers: readonly Enemy[]): void {
        for (const f of this.flashes) f.age += dt;
        removeWhere(this.flashes, isFlashOver);
        for (const carrier of droppers) {
            // A carrier destroyed in the frame it dropped is no longer drawn, so it gets no flash.
            if (carrier.removed) continue;
            const current = this.flashOf(carrier);
            if (current) current.age = 0;
            else this.flashes.push({ carrier, age: 0 });
        }
    }

    /** Whether this carrier's centre mark is drawn white this frame. */
    isFlashing(carrier: Enemy): boolean {
        return this.flashOf(carrier) !== null;
    }

    /** A plain loop rather than find/some: this runs every frame while drawing, so no closures. */
    private flashOf(carrier: Enemy): DropFlash | null {
        for (const f of this.flashes) if (f.carrier === carrier) return f;
        return null;
    }

    clear(): void {
        this.flashes.length = 0;
    }
}
