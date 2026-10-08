import { PARAMS } from '../params';
import type { Pt } from './board';
import { isDrag } from './scroll';

interface Contact {
    readonly touch: boolean;
    readonly startX: number;
    readonly startY: number;
    lastX: number;
    lastY: number;
    /** True once the contact has moved `dragThresholdPx` or more from its press (a drag never strikes). */
    dragged: boolean;
}

/**
 * Follows every pressed pointer (mouse and touch fingers) from press to release.
 * - A tap (released before reaching the drag threshold, inside the canvas) strikes at the release position.
 * - Only one touch finger scrolls at a time: the first one past the threshold; later ones that reach the
 *   threshold are ignored until the scroll finger is gone. The mouse scrolls on its own.
 * - At most `maxTouchPointers` touch fingers are followed; the mouse does not count. (main.ts sets Phaser's
 *   `input.activePointers` from the same parameter, so a finger beyond it normally never reaches the tracker.)
 * - A pointer that is no longer down but never reported its release is dropped (without a strike) the next time
 *   a pointer is pressed or moves. Releases do not check: fingers lifted together are all marked up before the first
 *   release event arrives, and each of them must still strike.
 * `isDown` tells whether a pointer is still pressed right now (the Phaser pointer's `isDown`).
 */
export class PointerTracker {
    private readonly contacts = new Map<number, Contact>();
    private scroller: number | null = null;

    constructor(private readonly isDown: (id: number) => boolean) {}

    /** A pointer was pressed. */
    press(id: number, touch: boolean, x: number, y: number): void {
        this.cancel(id);
        this.dropStale();
        if (touch && this.touchCount() >= PARAMS.maxTouchPointers) return;
        this.contacts.set(id, { touch, startX: x, startY: y, lastX: x, lastY: y, dragged: false });
    }

    /** A pointer moved to (x, y). Returns how far the view should scroll, or null. */
    move(id: number, x: number, y: number): Pt | null {
        this.dropStale();
        const c = this.contacts.get(id);
        if (!c) return null;
        const delta = { x: c.lastX - x, y: c.lastY - y };
        c.lastX = x;
        c.lastY = y;
        if (!c.dragged && isDrag(x - c.startX, y - c.startY)) c.dragged = true;
        if (!c.dragged) return null;
        if (!c.touch) return delta;
        if (this.scroller === null) this.scroller = id;
        return this.scroller === id ? delta : null;
    }

    /** A pointer was released at (x, y); `inside` tells whether that is within the canvas. Returns the strike position, or null. */
    release(id: number, x: number, y: number, inside: boolean): Pt | null {
        const c = this.contacts.get(id);
        if (!c) return null;
        this.cancel(id);
        if (c.dragged || isDrag(x - c.startX, y - c.startY) || !inside) return null;
        return { x, y };
    }

    /** Forget a pointer without a strike (cancelled by the system). */
    cancel(id: number): void {
        this.contacts.delete(id);
        if (this.scroller === id) this.scroller = null;
    }

    /** Forget every pointer. */
    clear(): void {
        this.contacts.clear();
        this.scroller = null;
    }

    private touchCount(): number {
        let n = 0;
        this.contacts.forEach((c) => {
            if (c.touch) n++;
        });
        return n;
    }

    /** Drop pointers that are no longer down (their release was lost). */
    private dropStale(): void {
        // Early exit so that an idle mouse hover does not allocate the closure below on every move.
        if (this.contacts.size === 0) return;
        this.contacts.forEach((_, id) => {
            if (!this.isDown(id)) this.cancel(id);
        });
    }
}
