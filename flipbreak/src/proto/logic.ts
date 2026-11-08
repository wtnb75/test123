// Pure game rules for the prototype (no Phaser imports).
import { P } from './params';
import { STAGES } from './stages';

export interface Ball {
    x: number;
    y: number;
    vx: number;
    vy: number;
}
export interface Flipper {
    px: number;
    py: number;
    s: 1 | -1; // +1 left (points right), -1 right (points left)
    a: number; // angle in rad, rest = +REST, up = UP (negative)
    omega: number;
}
export interface Bumper {
    x: number;
    y: number;
}
export interface Block {
    col: number;
    row: number;
    alive: boolean;
}
export interface World {
    ball: Ball;
    flippers: [Flipper, Flipper];
    bumpers: Bumper[];
    blocks: Block[];
}
export interface StepEvents {
    blocks: number[];
    bumpers: number[];
    flipper: boolean;
    drained: boolean;
}

type Seg = [number, number, number, number];

// Slant guides run flush with the top surface of a resting flipper (offset by its radius),
// so a rolling ball does not hit a step at the flipper root.
const REST_RAD = (P.FLIPPER_REST_DEG * Math.PI) / 180;
const SLANT_DX = Math.sin(REST_RAD) * P.FLIPPER_R;
const SLANT_DY = -Math.cos(REST_RAD) * P.FLIPPER_R;
const SLANT_TAN = Math.tan(REST_RAD);
const slantLeftEnd = [P.FLIPPER_LEFT_PIVOT.x + SLANT_DX, P.FLIPPER_LEFT_PIVOT.y + SLANT_DY];
const slantRightEnd = [P.FLIPPER_RIGHT_PIVOT.x - SLANT_DX, P.FLIPPER_RIGHT_PIVOT.y + SLANT_DY];

export const WALLS: Seg[] = [
    [0, 0, 0, P.H],
    [0, 0, P.W, 0],
    [P.W, 0, P.W, P.H],
    [P.LANE_X, 120, P.LANE_X, P.H],
    [P.LANE_X, P.LANE_FLOOR_Y, P.W, P.LANE_FLOOR_Y],
    [P.W, 80, 300, 0],
    [0, slantLeftEnd[1] - SLANT_TAN * slantLeftEnd[0], slantLeftEnd[0], slantLeftEnd[1]],
    [P.FIELD_W, slantRightEnd[1] - SLANT_TAN * (P.FIELD_W - slantRightEnd[0]), slantRightEnd[0], slantRightEnd[1]],
];

const DEG = Math.PI / 180;

export function flipperDir(f: Flipper): [number, number] {
    return [f.s * Math.cos(f.a), Math.sin(f.a)];
}

export function flipperTip(f: Flipper): [number, number] {
    const [dx, dy] = flipperDir(f);
    return [f.px + dx * P.FLIPPER_LEN, f.py + dy * P.FLIPPER_LEN];
}

export function makeBall(): Ball {
    return { x: P.LANE_BALL_X, y: P.LANE_FLOOR_Y - P.BALL_R, vx: 0, vy: 0 };
}

export function makeWorld(stageIndex: number): World {
    const def = STAGES[stageIndex];
    const blocks: Block[] = [];
    def.rows.forEach((row, r) => {
        for (let c = 0; c < P.BLOCK_COLS; c++) {
            if (row[c] === '#') blocks.push({ col: c, row: r, alive: true });
        }
    });
    const rest = P.FLIPPER_REST_DEG * DEG;
    return {
        ball: makeBall(),
        flippers: [
            { px: P.FLIPPER_LEFT_PIVOT.x, py: P.FLIPPER_LEFT_PIVOT.y, s: 1, a: rest, omega: 0 },
            { px: P.FLIPPER_RIGHT_PIVOT.x, py: P.FLIPPER_RIGHT_PIVOT.y, s: -1, a: rest, omega: 0 },
        ],
        bumpers: def.bumpers.map(([x, y]) => ({ x, y })),
        blocks,
    };
}

export function blockRect(b: Block): { x: number; y: number; w: number; h: number } {
    return {
        x: P.BLOCK_X0 + b.col * P.BLOCK_W + 1,
        y: P.BLOCK_Y0 + b.row * P.BLOCK_H + 1,
        w: P.BLOCK_W - 2,
        h: P.BLOCK_H - 2,
    };
}

export function launchSpeed(charge: number): number {
    const c = Math.min(1, Math.max(0, charge));
    return P.LAUNCH_MIN + (P.LAUNCH_MAX - P.LAUNCH_MIN) * c;
}

export function isReady(ball: Ball): boolean {
    return ball.x > P.LANE_X && ball.y > P.H - 40 && Math.abs(ball.vy) < 40;
}

export function stepFlipper(f: Flipper, pressed: boolean, dt: number): void {
    const target = (pressed ? P.FLIPPER_UP_DEG : P.FLIPPER_REST_DEG) * DEG;
    const maxMove = P.FLIPPER_SPEED * dt;
    const diff = target - f.a;
    const move = Math.abs(diff) <= maxMove ? diff : Math.sign(diff) * maxMove;
    f.a += move;
    f.omega = move / dt;
}

/** Reflect the ball off a capsule (segment + radius). Returns the contact t (0..1) or -1. */
function collideSegment(
    ball: Ball,
    seg: Seg,
    radius: number,
    e: number,
    surf?: (t: number) => [number, number],
): number {
    const [ax, ay, bx, by] = seg;
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby;
    const t = Math.max(0, Math.min(1, ((ball.x - ax) * abx + (ball.y - ay) * aby) / len2));
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    let dx = ball.x - cx;
    let dy = ball.y - cy;
    const dist = Math.hypot(dx, dy);
    const minD = P.BALL_R + radius;
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
    const [sx, sy] = surf ? surf(t) : [0, 0];
    const vn = (ball.vx - sx) * dx + (ball.vy - sy) * dy;
    if (vn < 0) {
        ball.vx -= (1 + e) * vn * dx;
        ball.vy -= (1 + e) * vn * dy;
    }
    return t;
}

function collideBumper(ball: Ball, bu: Bumper): boolean {
    let dx = ball.x - bu.x;
    let dy = ball.y - bu.y;
    const dist = Math.hypot(dx, dy);
    const minD = P.BALL_R + P.BUMPER_R;
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
    const vn = ball.vx * dx + ball.vy * dy;
    if (vn < 0) {
        ball.vx -= (1 + P.BUMPER_E) * vn * dx;
        ball.vy -= (1 + P.BUMPER_E) * vn * dy;
    }
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp < P.BUMPER_MIN_OUT) {
        const k = sp < 1e-6 ? 0 : P.BUMPER_MIN_OUT / sp;
        ball.vx = sp < 1e-6 ? dx * P.BUMPER_MIN_OUT : ball.vx * k;
        ball.vy = sp < 1e-6 ? dy * P.BUMPER_MIN_OUT : ball.vy * k;
    }
    return true;
}

function collideBlock(ball: Ball, b: Block): boolean {
    const r = blockRect(b);
    const cx = Math.max(r.x, Math.min(ball.x, r.x + r.w));
    const cy = Math.max(r.y, Math.min(ball.y, r.y + r.h));
    let dx = ball.x - cx;
    let dy = ball.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist >= P.BALL_R) return false;
    if (dist < 1e-6) {
        // Ball centre inside the block: push out along the nearest face.
        const left = ball.x - r.x;
        const right = r.x + r.w - ball.x;
        const top = ball.y - r.y;
        const bottom = r.y + r.h - ball.y;
        const m = Math.min(left, right, top, bottom);
        dx = m === left ? -1 : m === right ? 1 : 0;
        dy = m === top ? -1 : m === bottom ? 1 : 0;
    } else {
        dx /= dist;
        dy /= dist;
    }
    ball.x = cx + dx * P.BALL_R;
    ball.y = cy + dy * P.BALL_R;
    const vn = ball.vx * dx + ball.vy * dy;
    if (vn < 0) {
        ball.vx -= (1 + P.BLOCK_E) * vn * dx;
        ball.vy -= (1 + P.BLOCK_E) * vn * dy;
    }
    return true;
}

export function stepWorld(w: World, pressed: [boolean, boolean], dt: number): StepEvents {
    const ev: StepEvents = { blocks: [], bumpers: [], flipper: false, drained: false };
    stepFlipper(w.flippers[0], pressed[0], dt);
    stepFlipper(w.flippers[1], pressed[1], dt);

    const ball = w.ball;
    ball.vy += P.GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > P.MAX_SPEED) {
        ball.vx *= P.MAX_SPEED / sp;
        ball.vy *= P.MAX_SPEED / sp;
    }

    for (const seg of WALLS) collideSegment(ball, seg, 0, P.WALL_E);

    for (const f of w.flippers) {
        const [tx, ty] = flipperTip(f);
        const surf = (t: number): [number, number] => {
            const d = t * P.FLIPPER_LEN;
            return [d * f.omega * -f.s * Math.sin(f.a), d * f.omega * Math.cos(f.a)];
        };
        if (collideSegment(ball, [f.px, f.py, tx, ty], P.FLIPPER_R, P.FLIPPER_E, surf) >= 0) {
            ev.flipper = true;
        }
    }

    w.bumpers.forEach((bu, i) => {
        if (collideBumper(ball, bu)) ev.bumpers.push(i);
    });

    w.blocks.forEach((b, i) => {
        if (b.alive && collideBlock(ball, b)) {
            b.alive = false;
            ev.blocks.push(i);
        }
    });

    if (ball.y > P.H + P.BALL_R * 3) ev.drained = true;
    return ev;
}

export function stageCleared(w: World): boolean {
    return w.blocks.every((b) => !b.alive);
}
