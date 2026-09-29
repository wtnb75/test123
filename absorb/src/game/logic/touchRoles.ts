import { BUTTON_HIT_RADIUS } from './constants';
import { distanceSq } from './geometry';

/** Touch pointers the game listens to: the finger that drags and one that releases. */
export const TOUCH_POINTERS = 2;

/**
 * How many pointers to add so `total` (Phaser's count, which persists across scene restarts) reaches
 * TOUCH_POINTERS. Adding one on every start would grow the pool by one per retry.
 */
export function pointersToAdd(total: number): number {
    return Math.max(0, TOUCH_POINTERS - total);
}

/** What a finger does from the moment it touches until it leaves. */
export type FingerRole = 'release' | 'drag' | 'ignore';

/** What decides a new finger's role. */
export interface TouchContext {
    /** The pause takes this touch (a resume tap, or any touch made while paused). */
    paused: boolean;
    /** The device has touch, so the release button is shown and the button rules apply. */
    touchUi: boolean;
    buttonX: number;
    buttonY: number;
}

/**
 * Roles of the fingers on the screen. A finger gets its role when it touches and keeps it until it
 * leaves; a finger with no record (one that was already down when the scene began) is ignored.
 * At most one finger drags. Without touch (mouse only) every first press drags.
 */
export class TouchRoles {
    private readonly roles = new Map<number, FingerRole>();
    private dragId = -1;

    /** True while a finger is dragging. */
    get dragging(): boolean {
        return this.dragId !== -1;
    }

    roleOf(id: number): FingerRole {
        return this.roles.get(id) ?? 'ignore';
    }

    /** A finger touched at (x, y); returns the role it now has. */
    down(id: number, x: number, y: number, ctx: TouchContext): FingerRole {
        this.up(id);
        const role = this.decide(x, y, ctx);
        this.roles.set(id, role);
        if (role === 'drag') this.dragId = id;
        return role;
    }

    /** A finger left, was cancelled or lifted outside the screen. */
    up(id: number): void {
        this.roles.delete(id);
        if (id === this.dragId) this.dragId = -1;
    }

    /** The pause began: the dragging finger is ignored until it leaves. */
    suspendDrag(): void {
        if (this.dragId === -1) return;
        this.roles.set(this.dragId, 'ignore');
        this.dragId = -1;
    }

    clear(): void {
        this.roles.clear();
        this.dragId = -1;
    }

    private decide(x: number, y: number, ctx: TouchContext): FingerRole {
        if (ctx.paused) return 'ignore';
        if (!ctx.touchUi) return this.dragging ? 'ignore' : 'drag';
        if (this.dragging) return 'release';
        if (distanceSq(x, y, ctx.buttonX, ctx.buttonY) <= BUTTON_HIT_RADIUS * BUTTON_HIT_RADIUS) return 'release';
        return 'drag';
    }
}
