// The ball's trail: positions of the last few rendered frames (docs/spec.md "玉の軌跡"). Pure; no Phaser.
import { MULTI_BALL_MAX, TRAIL_ALPHA_MAX, TRAIL_COUNT, TRAIL_JUMP, TRAIL_MIN_SPEED } from '../params';
import { ballAt, ballCount, ballSpeed, type Ball, type World } from './physics';

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

    /** Forget every recorded position. */
    clear(): void {
        this.count = 0;
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

/**
 * One TrailBuffer per ball on the table (docs/spec/multiball.md 玉の見せ方), made once and reused: a ball keeps its
 * buffer while it stays on the table; a ball that appears starts with an empty one, and the buffer of a ball that is
 * gone is emptied.
 */
export class TrailSet {
    readonly buffers: TrailBuffer[] = [];
    private readonly refs: (Ball | null)[] = [];
    private readonly used: boolean[] = [];

    constructor(slots = MULTI_BALL_MAX) {
        for (let i = 0; i < slots; i++) {
            this.buffers.push(new TrailBuffer());
            this.refs.push(null);
            this.used.push(false);
        }
    }

    /** Record this frame's position and speed of every ball of the world. */
    record(w: World): void {
        const n = ballCount(w);
        this.used.fill(false);
        for (let i = 0; i < n; i++) {
            const ball = ballAt(w, i);
            const slot = this.refs.indexOf(ball);
            if (slot < 0) continue;
            this.used[slot] = true;
            this.buffers[slot].push(ball.x, ball.y, ballSpeed(ball));
        }
        for (let i = 0; i < n; i++) {
            const ball = ballAt(w, i);
            if (this.refs.includes(ball)) continue;
            const slot = this.used.indexOf(false);
            this.refs[slot] = ball;
            this.used[slot] = true;
            this.buffers[slot].clear();
            this.buffers[slot].push(ball.x, ball.y, ballSpeed(ball));
        }
        for (let s = 0; s < this.refs.length; s++) {
            if (this.used[s]) continue;
            this.refs[s] = null;
            this.buffers[s].clear();
        }
    }
}
