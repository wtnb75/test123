// Ball movement and collisions (pure; no Phaser).
import {
    BALL_RADIUS,
    FIELD_LEFT,
    FIELD_RIGHT,
    FIELD_TOP,
    MY_BALL_SPEED,
    PADDLE_HEIGHT,
    PADDLE_MAX_ANGLE,
    PADDLE_WIDTH,
} from '../params';

export type Owner = 'enemy' | 'mine';

export interface Ball {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    owner: Owner;
}

/** Axis-aligned rectangle given by its center and size. */
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

const DEG = Math.PI / 180;

/**
 * Moves a ball and bounces it off the inner faces of the side walls (both owners) and of the top wall at
 * FIELD_TOP (own balls only).
 */
export function stepBall(b: Ball, dt: number): void {
    const r = BALL_RADIUS;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < FIELD_LEFT + r) {
        b.x = FIELD_LEFT + r;
        b.vx = Math.abs(b.vx);
    } else if (b.x > FIELD_RIGHT - r) {
        b.x = FIELD_RIGHT - r;
        b.vx = -Math.abs(b.vx);
    }
    if (b.owner === 'mine' && b.y < FIELD_TOP + r) {
        b.y = FIELD_TOP + r;
        b.vy = Math.abs(b.vy);
    }
}

/**
 * Puts a ball pushed into a side wall (by an enemy's push-out) back against the wall's inner face. Velocity is
 * left alone: if it still points into the wall, the next stepBall bounces it.
 */
export function keepInsideWalls(b: Ball): void {
    b.x = Math.max(FIELD_LEFT + BALL_RADIUS, Math.min(FIELD_RIGHT - BALL_RADIUS, b.x));
}

/** A ball is gone once its center is strictly below the screen's bottom edge plus its radius. */
export function isOut(b: Ball, screenHeight: number): boolean {
    return b.y > screenHeight + BALL_RADIUS;
}

/**
 * Circle vs rectangle. On a hit (penetration > 0 on both axes) pushes the ball out along the shallower axis
 * (y on a tie) and turns that velocity component away from the rectangle; speed is unchanged.
 */
export function bounceOffRect(b: Ball, rc: Rect): boolean {
    const r = BALL_RADIUS;
    const dx = b.x - rc.x;
    const dy = b.y - rc.y;
    const px = rc.w / 2 + r - Math.abs(dx);
    const py = rc.h / 2 + r - Math.abs(dy);
    if (px <= 0 || py <= 0) return false;
    if (px < py) {
        const s = dx < 0 ? -1 : 1;
        b.x += s * px;
        b.vx = s * Math.abs(b.vx);
    } else {
        const s = dy < 0 ? -1 : 1;
        b.y += s * py;
        b.vy = s * Math.abs(b.vy);
    }
    return true;
}

/** The paddle catches a downward-moving ball whose circle touches or overlaps it. */
export function hitsPaddle(b: Ball, paddleX: number, paddleY: number): boolean {
    if (b.vy <= 0) return false;
    const r = BALL_RADIUS;
    return Math.abs(b.x - paddleX) <= PADDLE_WIDTH / 2 + r && Math.abs(b.y - paddleY) <= PADDLE_HEIGHT / 2 + r;
}

/** Velocity after the paddle; offset is (ball x − paddle x) / half width, clamped to [−1, 1]. */
export function paddleBounce(offset: number): { vx: number; vy: number } {
    const o = Math.max(-1, Math.min(1, offset));
    const a = o * PADDLE_MAX_ANGLE * DEG;
    return { vx: Math.sin(a) * MY_BALL_SPEED, vy: -Math.cos(a) * MY_BALL_SPEED };
}

/** Applies a paddle catch: new velocity, sits on the paddle, becomes the player's ball. */
export function catchBall(b: Ball, paddleX: number, paddleY: number): void {
    const v = paddleBounce((b.x - paddleX) / (PADDLE_WIDTH / 2));
    b.vx = v.vx;
    b.vy = v.vy;
    b.y = paddleY - PADDLE_HEIGHT / 2 - BALL_RADIUS;
    b.owner = 'mine';
}
