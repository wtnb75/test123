// The aim line: where the ball that reaches the paddle first would go if the paddle caught it where it is now
// (pure; no Phaser). See docs/spec/aim-line.md "予測線の対象と形".
import {
    AIM_MAX_BOUNCES,
    BALL_RADIUS,
    FIELD_LEFT,
    FIELD_RIGHT,
    FIELD_TOP,
    PADDLE_HEIGHT,
    PADDLE_MAX_ANGLE,
    PADDLE_WIDTH,
} from '../params';
import type { Enemy } from './formation';
import type { Ball, Rect } from './physics';
import type { Run } from './run';

const DEG = Math.PI / 180;
/** How far the circle moves between two overlap checks along the line (px). */
const STEP = 3;
/** Bisection rounds that pin the touch point down (error well under 0.1 px). */
const REFINE = 10;
const MAX_SEGMENTS = 64;

/** The line as a polyline `pts` = [x0, y0, x1, y1, ...] (reused between calls). */
export interface AimPath {
    pts: number[];
}

export const createAimPath = (): AimPath => ({ pts: [] });

/** Smallest advance (px) along the line in one round of `dashSegments`, so float rounding at a dash edge cannot stall it. */
const MIN_ADVANCE = 0.01;

/**
 * Splits the polyline `pts` ([x0, y0, x1, y1, ...]) into dashes: `dash` px drawn, `gap` px skipped, counted along
 * the path from its start (which begins with a dash) and carried across bends. `out` is filled with
 * [x0, y0, x1, y1] per dash (a dash that crosses a bend is two entries).
 */
export function dashSegments(pts: readonly number[], dash: number, gap: number, out: number[]): void {
    out.length = 0;
    const cycle = dash + gap;
    let phase = 0;
    for (let i = 0; i + 3 < pts.length; i += 2) {
        const x0 = pts[i];
        const y0 = pts[i + 1];
        const len = Math.hypot(pts[i + 2] - x0, pts[i + 3] - y0);
        if (len === 0) continue;
        const ux = (pts[i + 2] - x0) / len;
        const uy = (pts[i + 3] - y0) / len;
        for (let d = 0; d < len; ) {
            const into = phase % cycle;
            const drawing = into < dash;
            const end = Math.min(len, d + Math.max(MIN_ADVANCE, (drawing ? dash : cycle) - into));
            if (drawing) out.push(x0 + ux * d, y0 + uy * d, x0 + ux * end, y0 + uy * end);
            phase += end - d;
            d = end;
        }
    }
}

/** y of a ball's centre when it first touches the paddle's top face. */
export const contactY = (paddleY: number): number => paddleY - PADDLE_HEIGHT / 2 - BALL_RADIUS;

/**
 * The downward ball (still above the paddle) that gets to the paddle's top first; the lower id on a tie.
 * Enemy and own balls both count.
 */
export function pickAimBall(balls: readonly Ball[], paddleY: number): Ball | undefined {
    const cy = contactY(paddleY);
    let best: Ball | undefined;
    let bestT = Infinity;
    for (const b of balls) {
        if (b.vy <= 0 || b.y >= cy) continue;
        const t = (cy - b.y) / b.vy;
        if (t < bestT || (t === bestT && best !== undefined && b.id < best.id)) {
            best = b;
            bestT = t;
        }
    }
    return best;
}

/** x of a ball after `t` seconds at speed `vx` from `x`, folded back between the side walls (a ball's centre range). */
export function arrivalX(x: number, vx: number, t: number): number {
    const lo = FIELD_LEFT + BALL_RADIUS;
    const w = FIELD_RIGHT - BALL_RADIUS - lo;
    let u = (x + vx * t - lo) % (2 * w);
    if (u < 0) u += 2 * w;
    return lo + (u > w ? 2 * w - u : u);
}

/** Whether a ball centred at (x, y) overlaps the rectangle (the same test as the game's: depth above 0 on both axes). */
function overlaps(x: number, y: number, rc: Rect): boolean {
    return rc.w / 2 + BALL_RADIUS - Math.abs(x - rc.x) > 0 && rc.h / 2 + BALL_RADIUS - Math.abs(y - rc.y) > 0;
}

/** Box around the formation, grown by the ball radius (set once per aimPath call; most points of a line are outside it). */
const box = { l: 0, r: 0, t: 0, b: 0 };

function setBox(enemies: readonly Enemy[]): void {
    box.l = box.t = Infinity;
    box.r = box.b = -Infinity;
    for (const { rect: rc } of enemies) {
        box.l = Math.min(box.l, rc.x - rc.w / 2 - BALL_RADIUS);
        box.r = Math.max(box.r, rc.x + rc.w / 2 + BALL_RADIUS);
        box.t = Math.min(box.t, rc.y - rc.h / 2 - BALL_RADIUS);
        box.b = Math.max(box.b, rc.y + rc.h / 2 + BALL_RADIUS);
    }
}

/** Whether the ball at (x, y) overlaps any enemy. */
function touchesEnemy(run: Run, x: number, y: number): boolean {
    if (x <= box.l || x >= box.r || y <= box.t || y >= box.b) return false;
    for (const e of run.formation.enemies) if (overlaps(x, y, e.rect)) return true;
    return false;
}

/**
 * Fills `out` with the line for the ball that reaches the paddle first, or empties it (`pts.length === 0`) when
 * there is none or the paddle at `paddleX` would miss it. The formation is taken as it stands (not predicted).
 * It reads `run` and changes nothing in it.
 */
export function aimPath(run: Run, paddleX: number, out: AimPath): void {
    out.pts.length = 0;
    const ball = pickAimBall(run.balls, run.paddleY);
    if (!ball) return;
    const cy = contactY(run.paddleY);
    const ax = arrivalX(ball.x, ball.vx, (cy - ball.y) / ball.vy);
    if (Math.abs(ax - paddleX) > PADDLE_WIDTH / 2 + BALL_RADIUS) return;

    const offset = Math.max(-1, Math.min(1, (ax - paddleX) / (PADDLE_WIDTH / 2)));
    const angle = offset * PADDLE_MAX_ANGLE * DEG;
    let dx = Math.sin(angle);
    let dy = -Math.cos(angle);
    let x = ax;
    let y = cy;
    const left = FIELD_LEFT + BALL_RADIUS;
    const right = FIELD_RIGHT - BALL_RADIUS;
    const top = FIELD_TOP + BALL_RADIUS;
    setBox(run.formation.enemies);
    out.pts.push(x, y);
    let bounces = 0;
    for (let seg = 0; seg < MAX_SEGMENTS; seg++) {
        // Distance to the next wall (or back down to the paddle's level), whichever comes first.
        const toSide = dx > 0 ? (right - x) / dx : dx < 0 ? (left - x) / dx : Infinity;
        const toVert = dy < 0 ? (top - y) / dy : (cy - y) / dy;
        const len = Math.max(0, Math.min(toSide, toVert));

        // March along the segment looking for the first enemy the ball's circle would touch.
        let prev = 0;
        for (let d = STEP; ; d += STEP) {
            const at = Math.min(d, len);
            if (touchesEnemy(run, x + dx * at, y + dy * at)) {
                let lo = prev;
                let hi = at;
                for (let i = 0; i < REFINE; i++) {
                    const mid = (lo + hi) / 2;
                    if (touchesEnemy(run, x + dx * mid, y + dy * mid)) hi = mid;
                    else lo = mid;
                }
                out.pts.push(x + dx * lo, y + dy * lo);
                return;
            }
            if (at >= len) break;
            prev = at;
        }

        x += dx * len;
        y += dy * len;
        out.pts.push(x, y);
        if (toVert <= toSide && dy >= 0) return; // back down at the paddle's level
        if (toSide < toVert) dx = -dx;
        else dy = -dy;
        bounces += 1;
        if (bounces > AIM_MAX_BOUNCES) return;
    }
}
