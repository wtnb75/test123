import { FIELD_LEFT, FIELD_RIGHT, PADDLE_KEY_SPEED, PADDLE_WIDTH } from '../params';

/** Keeps the paddle between the walls' inner faces. */
export function clampPaddle(x: number): number {
    const half = PADDLE_WIDTH / 2;
    return Math.max(FIELD_LEFT + half, Math.min(FIELD_RIGHT - half, x));
}

/**
 * Paddle center for this frame. A pointer that touched or moved this frame wins; otherwise ← / → move it
 * (both held, or neither: no movement).
 */
export function nextPaddleX(x: number, pointerX: number | null, left: boolean, right: boolean, dt: number): number {
    if (pointerX !== null) return clampPaddle(pointerX);
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    return clampPaddle(x + dir * PADDLE_KEY_SPEED * dt);
}
