// The ball's trail: positions of the last few rendered frames (docs/spec.md "玉の軌跡"). Pure; no Phaser.
import { TRAIL_ALPHA_MAX, TRAIL_COUNT, TRAIL_JUMP, TRAIL_MIN_SPEED } from '../params';

/** Opacity of the i-th newest dot (i = 0 is the newest): TRAIL_ALPHA_MAX * (1 - (i + 1) / (TRAIL_COUNT + 1)). */
export function trailAlpha(i: number): number {
    return TRAIL_ALPHA_MAX * (1 - (i + 1) / (TRAIL_COUNT + 1));
}

/**
 * A ring buffer of the last TRAIL_COUNT positions, newest first, with no allocation after construction.
 * It empties when the ball slows below TRAIL_MIN_SPEED or jumps TRAIL_JUMP px or more between two frames.
 */
export class TrailBuffer {
    private readonly xs = new Float64Array(TRAIL_COUNT);
    private readonly ys = new Float64Array(TRAIL_COUNT);
    private head = 0; // index of the newest
    private count = 0;

    /** How many positions are recorded. */
    get size(): number {
        return this.count;
    }

    /** Record this frame's ball position and speed. */
    push(x: number, y: number, speed: number): void {
        if (speed < TRAIL_MIN_SPEED) {
            this.count = 0;
            return;
        }
        if (this.count > 0 && Math.hypot(x - this.xs[this.head], y - this.ys[this.head]) >= TRAIL_JUMP) this.count = 0;
        this.head = (this.head + 1) % TRAIL_COUNT;
        this.xs[this.head] = x;
        this.ys[this.head] = y;
        this.count = Math.min(this.count + 1, TRAIL_COUNT);
    }

    /** x of the i-th newest position (i = 0 is the newest). */
    x(i: number): number {
        return this.xs[(this.head - i + TRAIL_COUNT) % TRAIL_COUNT];
    }

    /** y of the i-th newest position. */
    y(i: number): number {
        return this.ys[(this.head - i + TRAIL_COUNT) % TRAIL_COUNT];
    }
}
