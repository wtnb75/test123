// Pure game rules (no Phaser imports).
import { PARAMS } from './params';

export type Owner = 'enemy' | 'mine';

export interface Ball {
    x: number;
    y: number;
    vx: number;
    vy: number;
    owner: Owner;
}

export interface Rect {
    x: number; // center
    y: number; // center
    w: number;
    h: number;
}

export function rowsForWave(wave: number): number {
    const extra = Math.floor((wave - 1) / PARAMS.enemyRowsEveryWaves);
    return Math.min(PARAMS.enemyRowsBase + extra, PARAMS.enemyRowsMax);
}

export function fireInterval(wave: number): number {
    const t = PARAMS.fireIntervalBase * Math.pow(PARAMS.fireIntervalDecay, wave - 1);
    return Math.max(t, PARAMS.fireIntervalMin);
}

export function scoreForKill(wave: number): number {
    return PARAMS.scorePerEnemy * wave;
}

export function formationRects(wave: number, offsetX: number): Rect[] {
    const { enemyCols, enemyWidth, enemyHeight, enemyGap, width, formationTop } = PARAMS;
    const rows = rowsForWave(wave);
    const totalW = enemyCols * enemyWidth + (enemyCols - 1) * enemyGap;
    const left = (width - totalW) / 2 + offsetX;
    const rects: Rect[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < enemyCols; c++) {
            rects.push({
                x: left + c * (enemyWidth + enemyGap) + enemyWidth / 2,
                y: formationTop + r * (enemyHeight + enemyGap) + enemyHeight / 2,
                w: enemyWidth,
                h: enemyHeight,
            });
        }
    }
    return rects;
}

/** Velocity after hitting the paddle; offset is -1 (left edge) .. 1 (right edge). */
export function paddleBounce(offset: number, speed: number): { vx: number; vy: number } {
    const o = Math.max(-1, Math.min(1, offset));
    const a = (o * PARAMS.paddleMaxAngleDeg * Math.PI) / 180;
    return { vx: Math.sin(a) * speed, vy: -Math.cos(a) * speed };
}

export function enemyShotVelocity(rand: number): { vx: number; vy: number } {
    const a = ((rand * 2 - 1) * PARAMS.enemyBallSpreadDeg * Math.PI) / 180;
    return { vx: Math.sin(a) * PARAMS.enemyBallSpeed, vy: Math.cos(a) * PARAMS.enemyBallSpeed };
}

/** Advance a ball; bounces off left/right walls always and the top wall for own balls. */
export function stepBall(b: Ball, dt: number): void {
    const r = PARAMS.ballRadius;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < r) {
        b.x = r;
        b.vx = Math.abs(b.vx);
    } else if (b.x > PARAMS.width - r) {
        b.x = PARAMS.width - r;
        b.vx = -Math.abs(b.vx);
    }
    if (b.owner === 'mine' && b.y < r) {
        b.y = r;
        b.vy = Math.abs(b.vy);
    }
}

export function isOut(b: Ball): boolean {
    return b.y > PARAMS.height + PARAMS.ballRadius || b.y < -PARAMS.height;
}

/** Circle vs rect; on hit reflects the ball on the axis of least penetration. */
export function bounceOffRect(b: Ball, rc: Rect): boolean {
    const r = PARAMS.ballRadius;
    const dx = b.x - rc.x;
    const dy = b.y - rc.y;
    const px = rc.w / 2 + r - Math.abs(dx);
    const py = rc.h / 2 + r - Math.abs(dy);
    if (px <= 0 || py <= 0) return false;
    if (px < py) {
        b.x += Math.sign(dx) * px;
        b.vx = Math.sign(dx) * Math.abs(b.vx);
    } else {
        b.y += Math.sign(dy) * py;
        b.vy = Math.sign(dy) * Math.abs(b.vy);
    }
    return true;
}

/** Paddle catch: only a downward-moving ball whose circle overlaps the paddle. */
export function hitsPaddle(b: Ball, paddleX: number): boolean {
    if (b.vy <= 0) return false;
    const r = PARAMS.ballRadius;
    const halfW = PARAMS.paddleWidth / 2;
    const halfH = PARAMS.paddleHeight / 2;
    return Math.abs(b.x - paddleX) <= halfW + r && Math.abs(b.y - PARAMS.paddleY) <= halfH + r;
}
