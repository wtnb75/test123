// Ball physics of the table: pure functions, no Phaser (docs/spec.md "ルール" / "台の幾何").
import {
    BALL_R,
    BLOCK_E,
    BLOCK_H,
    BLOCK_W,
    BLOCK_X0,
    BLOCK_Y0,
    BUMPER_E,
    BUMPER_MIN_OUT,
    BUMPER_R,
    DEFLECTOR_X,
    DEFLECTOR_Y,
    FIELD_W,
    FLIPPER_E,
    FLIPPER_LEFT_PIVOT,
    FLIPPER_LEN,
    FLIPPER_R,
    FLIPPER_REST_DEG,
    FLIPPER_RIGHT_PIVOT,
    FLIPPER_SPEED,
    FLIPPER_UP_DEG,
    GRAVITY,
    H,
    LANE_BALL_X,
    LANE_FLOOR_Y,
    LANE_WALL_TOP,
    LANE_X,
    LAUNCH_MAX,
    LAUNCH_MIN,
    MAX_SPEED,
    MULTI_BALL_MAX,
    MULTI_SIDE_VX,
    READY_MAX_VY,
    READY_Y_MARGIN,
    W,
    WALL_E,
} from '../params';
import { stageCleared, type Block, type Bumper } from './stages';

export interface Ball {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

export interface Flipper {
    px: number;
    py: number;
    /** +1 for the left flipper (points right), -1 for the right one (points left). */
    s: 1 | -1;
    /** Angle in radians: FLIPPER_REST_DEG when down, FLIPPER_UP_DEG when up. */
    a: number;
    /** Angular velocity in rad/s (negative while rising). */
    omega: number;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** A line segment: ax, ay, bx, by. */
export type Seg = readonly [number, number, number, number];

export interface World {
    /** The first ball (the one launched from the lane); the rest of the balls on the table are in `extras`. */
    ball: Ball;
    /** Balls added by special blocks (docs/spec/multiball.md), in the order they appeared. */
    extras: Ball[];
    flippers: [Flipper, Flipper];
    bumpers: Bumper[];
    blocks: Block[];
}

export interface StepEvents {
    /** Blocks destroyed in this step. */
    blocks: number;
    /** Bumper hits in this step. */
    bumpers: number;
    /** No ball is left on the table (the last one fell out). A ball falling while others remain is just removed. */
    drained: boolean;
}

/** Told which block / bumper (by index in the world) was hit in a step; lets the caller collect them without allocating. */
export interface StepSink {
    block(index: number): void;
    bumper(index: number): void;
}

const DEG = Math.PI / 180;
const REST_RAD = FLIPPER_REST_DEG * DEG;
const UP_RAD = FLIPPER_UP_DEG * DEG;

// The slant guides run flush with the top surface of a resting flipper (offset by its radius along the normal),
// so a ball rolling down a slant meets no step at the flipper root.
const SLANT_DX = Math.sin(REST_RAD) * FLIPPER_R;
const SLANT_DY = -Math.cos(REST_RAD) * FLIPPER_R;
const SLANT_TAN = Math.tan(REST_RAD);
const LEFT_SLANT_END = [FLIPPER_LEFT_PIVOT.x + SLANT_DX, FLIPPER_LEFT_PIVOT.y + SLANT_DY] as const;
const RIGHT_SLANT_END = [FLIPPER_RIGHT_PIVOT.x - SLANT_DX, FLIPPER_RIGHT_PIVOT.y + SLANT_DY] as const;

export const WALLS: readonly Seg[] = [
    [0, 0, 0, H],
    [0, 0, W, 0],
    [W, 0, W, H],
    [LANE_X, LANE_WALL_TOP, LANE_X, H],
    [LANE_X, LANE_FLOOR_Y, W, LANE_FLOOR_Y],
    [W, DEFLECTOR_Y, DEFLECTOR_X, 0],
    [0, LEFT_SLANT_END[1] - SLANT_TAN * LEFT_SLANT_END[0], LEFT_SLANT_END[0], LEFT_SLANT_END[1]],
    [FIELD_W, RIGHT_SLANT_END[1] - SLANT_TAN * (FIELD_W - RIGHT_SLANT_END[0]), RIGHT_SLANT_END[0], RIGHT_SLANT_END[1]],
];

/** The ball resting in the plunger lane. */
export function makeBall(): Ball {
    return { x: LANE_BALL_X, y: LANE_FLOOR_Y - BALL_R, vx: 0, vy: 0 };
}

/** Both flippers down and still. */
export function makeFlippers(): [Flipper, Flipper] {
    return [
        { px: FLIPPER_LEFT_PIVOT.x, py: FLIPPER_LEFT_PIVOT.y, s: 1, a: REST_RAD, omega: 0 },
        { px: FLIPPER_RIGHT_PIVOT.x, py: FLIPPER_RIGHT_PIVOT.y, s: -1, a: REST_RAD, omega: 0 },
    ];
}

/** Direction the flipper points, from its root. */
export function flipperDir(f: Flipper): [number, number] {
    return [f.s * Math.cos(f.a), Math.sin(f.a)];
}

/** Centre of the flipper's tip. */
export function flipperTip(f: Flipper): [number, number] {
    const [dx, dy] = flipperDir(f);
    return [f.px + dx * FLIPPER_LEN, f.py + dy * FLIPPER_LEN];
}

/** Swing the flipper toward up (pressed) or down, at FLIPPER_SPEED, and record the angular velocity. */
export function stepFlipper(f: Flipper, pressed: boolean, dt: number): void {
    const target = pressed ? UP_RAD : REST_RAD;
    const maxMove = FLIPPER_SPEED * dt;
    const diff = target - f.a;
    const move = Math.abs(diff) <= maxMove ? diff : Math.sign(diff) * maxMove;
    f.a += move;
    f.omega = move / dt;
}

/** Launch speed for a charge of 0..1 (clamped). */
export function launchSpeed(charge: number): number {
    const c = Math.min(1, Math.max(0, charge));
    return LAUNCH_MIN + (LAUNCH_MAX - LAUNCH_MIN) * c;
}

/** Whether the ball sits in the lane, ready to be launched. */
export function isReady(ball: Ball): boolean {
    return ball.x > LANE_X && ball.y > H - READY_Y_MARGIN && Math.abs(ball.vy) < READY_MAX_VY;
}

/** The ball fell out of the table (below the flippers). */
export function isDrained(ball: Ball): boolean {
    return ball.y > H + BALL_R * 3;
}

export function ballSpeed(ball: Ball): number {
    return Math.hypot(ball.vx, ball.vy);
}

/** Reflect `ball` off a reflecting normal (nx, ny) given the surface velocity; no change when moving apart. */
function reflect(ball: Ball, nx: number, ny: number, e: number, sx = 0, sy = 0): void {
    const vn = (ball.vx - sx) * nx + (ball.vy - sy) * ny;
    if (vn >= 0) return;
    ball.vx -= (1 + e) * vn * nx;
    ball.vy -= (1 + e) * vn * ny;
}

/**
 * Push the ball out of a capsule (segment + radius) and reflect it. `surf(t)` is the surface velocity at the
 * contact point (t: 0..1 along the segment). Returns the contact t, or -1 when there is no contact.
 */
export function collideSegment(
    ball: Ball,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    radius: number,
    e: number,
    flipper: Flipper | null = null,
): number {
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby;
    const t = Math.max(0, Math.min(1, ((ball.x - ax) * abx + (ball.y - ay) * aby) / len2));
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    let dx = ball.x - cx;
    let dy = ball.y - cy;
    const dist = Math.hypot(dx, dy);
    const minD = BALL_R + radius;
    if (dist >= minD) return -1;
    if (dist < 1e-6) {
        dx = 0;
        dy = -1;
    } else {
        dx /= dist;
        dy /= dist;
    }
    ball.x = cx + dx * minD;
    ball.y = cy + dy * minD;
    if (flipper) {
        // Surface velocity of the moving flipper at distance d from its root.
        const d = t * FLIPPER_LEN;
        reflect(ball, dx, dy, e, d * flipper.omega * -flipper.s * Math.sin(flipper.a), d * flipper.omega * Math.cos(flipper.a));
    } else {
        reflect(ball, dx, dy, e);
    }
    return t;
}

/** Bounce off a bumper; the ball leaves at BUMPER_MIN_OUT at least. Returns whether it hit. */
export function collideBumper(ball: Ball, bu: Bumper): boolean {
    let dx = ball.x - bu.x;
    let dy = ball.y - bu.y;
    const dist = Math.hypot(dx, dy);
    const minD = BALL_R + BUMPER_R;
    if (dist >= minD) return false;
    if (dist < 1e-6) {
        dx = 0;
        dy = -1;
    } else {
        dx /= dist;
        dy /= dist;
    }
    ball.x = bu.x + dx * minD;
    ball.y = bu.y + dy * minD;
    reflect(ball, dx, dy, BUMPER_E);
    const sp = ballSpeed(ball);
    if (sp < 1e-6) {
        ball.vx = dx * BUMPER_MIN_OUT;
        ball.vy = dy * BUMPER_MIN_OUT;
    } else if (sp < BUMPER_MIN_OUT) {
        ball.vx *= BUMPER_MIN_OUT / sp;
        ball.vy *= BUMPER_MIN_OUT / sp;
    }
    return true;
}

/** The drawn (and hit) rectangle of a block: its grid cell, one px smaller on every side. */
export function blockRect(b: Block): Rect {
    return {
        x: BLOCK_X0 + b.col * BLOCK_W + 1,
        y: BLOCK_Y0 + b.row * BLOCK_H + 1,
        w: BLOCK_W - 2,
        h: BLOCK_H - 2,
    };
}

/** Push the ball out of a block and reflect it. Returns whether they overlapped. */
export function collideBlock(ball: Ball, b: Block): boolean {
    // The rectangle of blockRect(b), inlined: this runs for every live block on every physics step.
    const rx = BLOCK_X0 + b.col * BLOCK_W + 1;
    const ry = BLOCK_Y0 + b.row * BLOCK_H + 1;
    const rw = BLOCK_W - 2;
    const rh = BLOCK_H - 2;
    const cx = Math.max(rx, Math.min(ball.x, rx + rw));
    const cy = Math.max(ry, Math.min(ball.y, ry + rh));
    let dx = ball.x - cx;
    let dy = ball.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist >= BALL_R) return false;
    if (dist < 1e-6) {
        // The ball centre is inside the block: leave through the nearest face.
        const left = ball.x - rx;
        const right = rx + rw - ball.x;
        const top = ball.y - ry;
        const bottom = ry + rh - ball.y;
        const m = Math.min(left, right, top, bottom);
        // Horizontal faces win ties with vertical ones, so exactly one axis is used.
        const horizontal = m === left || m === right;
        dx = horizontal ? (m === left ? -1 : 1) : 0;
        dy = horizontal ? 0 : m === top ? -1 : 1;
        ball.x += dx * (m + BALL_R);
        ball.y += dy * (m + BALL_R);
    } else {
        dx /= dist;
        dy /= dist;
        ball.x = cx + dx * BALL_R;
        ball.y = cy + dy * BALL_R;
    }
    reflect(ball, dx, dy, BLOCK_E);
    return true;
}

/** Cap the ball's speed at MAX_SPEED, keeping its direction. */
function capSpeed(ball: Ball): void {
    const sp = ballSpeed(ball);
    if (sp > MAX_SPEED) {
        ball.vx *= MAX_SPEED / sp;
        ball.vy *= MAX_SPEED / sp;
    }
}

/** Number of balls on the table. */
export function ballCount(w: World): number {
    return 1 + w.extras.length;
}

/** The i-th ball: the first ball, then the added ones in the order they appeared. */
export function ballAt(w: World, i: number): Ball {
    return i === 0 ? w.ball : w.extras[i - 1];
}

/** Take the i-th ball off the table (the caller keeps at least one ball there). */
export function removeBall(w: World, i: number): void {
    if (i === 0) w.ball = w.extras.shift() as Ball;
    else w.extras.splice(i - 1, 1);
}

// Special blocks broken in the current step (the ball that broke each, and the block), emptied at its start.
const specialBalls: Ball[] = [];
const specialBlocks: Block[] = [];

/** Add the ball a broken special block gives: at the block's cell centre, with the breaking ball's x speed reversed. */
function spawnBall(w: World, hitter: Ball, b: Block): void {
    let vx = -hitter.vx;
    const cx = BLOCK_X0 + b.col * BLOCK_W + BLOCK_W / 2;
    if (Math.abs(hitter.vx) < 1e-6) vx = cx < FIELD_W / 2 ? MULTI_SIDE_VX : -MULTI_SIDE_VX;
    w.extras.push({ x: cx, y: BLOCK_Y0 + b.row * BLOCK_H + BLOCK_H / 2, vx, vy: hitter.vy });
}

/** After a step: add the balls special blocks give, take away balls that fell out or parked in the lane. */
function settleBalls(w: World, ev: StepEvents): void {
    if (specialBlocks.length > 0 && !stageCleared(w.blocks)) {
        for (let i = 0; i < specialBlocks.length && ballCount(w) < MULTI_BALL_MAX; i++) {
            spawnBall(w, specialBalls[i], specialBlocks[i]);
        }
    }
    let alive = 0;
    for (let i = 0; i < ballCount(w); i++) if (!isDrained(ballAt(w, i))) alive += 1;
    if (alive === 0) {
        ev.drained = true;
        return;
    }
    // From the back, so the indices still to visit stay valid.
    for (let i = ballCount(w) - 1; i >= 0; i--) if (isDrained(ballAt(w, i))) removeBall(w, i);
    // A ball resting in the lane while others are in play is taken away (the first ball stays if all rest there).
    for (let i = ballCount(w) - 1; i >= 0 && ballCount(w) > 1; i--) if (isReady(ballAt(w, i))) removeBall(w, i);
}

/**
 * One fixed physics step: flippers swing once, then each ball moves under gravity and walls, flippers, bumpers
 * and blocks push and reflect it (in that order). Balls do not touch each other. Afterwards balls are added,
 * removed and the lane is checked (docs/spec/multiball.md).
 */
export function stepWorld(w: World, left: boolean, right: boolean, dt: number, sink?: StepSink): StepEvents {
    const ev: StepEvents = { blocks: 0, bumpers: 0, drained: false };
    stepFlipper(w.flippers[0], left, dt);
    stepFlipper(w.flippers[1], right, dt);
    specialBalls.length = 0;
    specialBlocks.length = 0;
    const n = ballCount(w);
    for (let i = 0; i < n; i++) stepBall(w, ballAt(w, i), dt, ev, sink);
    settleBalls(w, ev);
    return ev;
}

/** One ball's share of a physics step (gravity, then walls, flippers, bumpers and blocks). */
function stepBall(w: World, ball: Ball, dt: number, ev: StepEvents, sink?: StepSink): void {
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    capSpeed(ball);

    for (let i = 0; i < WALLS.length; i++) {
        const seg = WALLS[i];
        collideSegment(ball, seg[0], seg[1], seg[2], seg[3], 0, WALL_E);
    }
    for (const f of w.flippers) {
        collideSegment(
            ball,
            f.px,
            f.py,
            f.px + f.s * Math.cos(f.a) * FLIPPER_LEN,
            f.py + Math.sin(f.a) * FLIPPER_LEN,
            FLIPPER_R,
            FLIPPER_E,
            f,
        );
    }
    for (let i = 0; i < w.bumpers.length; i++) {
        if (collideBumper(ball, w.bumpers[i])) {
            ev.bumpers += 1;
            sink?.bumper(i);
        }
    }
    for (let i = 0; i < w.blocks.length; i++) {
        const b = w.blocks[i];
        if (b.alive && collideBlock(ball, b)) {
            b.alive = false;
            ev.blocks += 1;
            sink?.block(i);
            if (b.special) {
                specialBalls.push(ball);
                specialBlocks.push(b);
            }
        }
    }
    // A flipper's surface speed can push the ball past the cap on impact.
    capSpeed(ball);
}
