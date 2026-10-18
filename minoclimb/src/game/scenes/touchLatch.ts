import type { PointerState, QuickTap } from '../logic/input';

/** A press seen as an event; `seen` turns true once a read found the pointer down. */
interface Press {
    downX: number;
    downY: number;
    seen: boolean;
}

/**
 * Latches pointer events between two reads: presses that began and ended without any read seeing them
 * down (quick taps), and fingers that ended without a normal release (a touch cancel, or a release outside
 * the canvas). Phaser reports both as events, so nothing is derived by comparing frames. No Phaser import,
 * so the rules are unit-tested.
 */
export class TouchLatch {
    private readonly presses = new Map<number, Press>();
    private readonly latchedTaps: QuickTap[] = [];
    private readonly latchedCancels = new Set<number>();

    /** A primary press began. A press of an id that is already pressed (another mouse button) is ignored. */
    down(id: number, downX: number, downY: number): void {
        if (this.presses.has(id)) return;
        this.presses.set(id, { downX, downY, seen: false });
    }

    /**
     * A pointer was released. `primaryStillDown` is true for the release of another mouse button while the
     * primary one is held, which says nothing about the primary press; `canceled` is Phaser's `wasCanceled`.
     */
    up(id: number, x: number, y: number, how: { primaryStillDown: boolean; canceled: boolean }): void {
        if (how.primaryStillDown) return;
        const press = this.presses.get(id);
        this.presses.delete(id);
        if (how.canceled) {
            this.latchedCancels.add(id);
            return;
        }
        if (!press || press.seen) return;
        this.latchedTaps.push({ id, downX: press.downX, downY: press.downY, x, y });
    }

    /** A pointer was released outside the canvas: not a tap (unless it was another mouse button, see `up`). */
    upOutside(id: number, primaryStillDown: boolean): void {
        if (primaryStillDown) return;
        this.presses.delete(id);
        this.latchedCancels.add(id);
    }

    /** Marks the pointers a read found down, so their release is not a quick tap. */
    markSeen(pointers: readonly PointerState[]): void {
        for (const p of pointers) {
            if (!p.isDown) continue;
            const press = this.presses.get(p.id);
            if (press) press.seen = true;
        }
    }

    /** Hands the latched quick taps and cancelled ids over (into the given buffers) and clears them. */
    drain(quickTaps: QuickTap[], cancelled: Set<number>): void {
        quickTaps.length = 0;
        for (const tap of this.latchedTaps) quickTaps.push(tap);
        this.latchedTaps.length = 0;
        cancelled.clear();
        for (const id of this.latchedCancels) cancelled.add(id);
        this.latchedCancels.clear();
    }
}
