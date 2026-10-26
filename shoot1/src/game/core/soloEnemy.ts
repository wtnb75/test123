import {
    ENEMY_RADIUS, ENEMY_SPEED, GAME_HEIGHT, GAME_WIDTH, PLAYER_RADIUS,
    RUSH_SPEED, SOLO_ENEMY_INTERVAL_SEC, SOLO_ENEMY_START_SEC, SOLO_STOP_SEC, SOLO_STOP_Y
} from './constants';
import { circlesOverlap } from './physics';

// Solo enemies appear alone, outside the formations: a rusher aims at the player and touching it ends
// the game; a stopper halts near the top, fires, then leaves.

export type SoloKind = 'rush' | 'stop';
export type StopPhase = 'descend' | 'hold' | 'ascend';

export type StopState = { y: number; phase: StopPhase; holdLeft: number };

const SOLO_OFFSCREEN_MARGIN = 40;

/** Kind of the n-th solo enemy (0-based): the rusher first, then alternating. */
export function soloKindOf(index: number): SoloKind {
    return index % 2 === 0 ? 'rush' : 'stop';
}

/** True once the next solo enemy is due (elapsed reached its start time). */
export function soloSpawnDue(elapsedSec: number, spawnedCount: number): boolean {
    return elapsedSec >= SOLO_ENEMY_START_SEC + spawnedCount * SOLO_ENEMY_INTERVAL_SEC;
}

/** Spawn x for a solo enemy, from a random value in [0, 1). Keeps the whole body on screen. */
export function soloSpawnX(rand: number): number {
    return ENEMY_RADIUS + rand * (GAME_WIDTH - 2 * ENEMY_RADIUS);
}

/** Velocity of a rusher that heads straight for the player's position at spawn. */
export function rushVelocity(x: number, y: number, playerX: number, playerY: number): { vx: number; vy: number } {
    const dx = playerX - x;
    const dy = playerY - y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return { vx: 0, vy: RUSH_SPEED };
    return { vx: (dx / dist) * RUSH_SPEED, vy: (dy / dist) * RUSH_SPEED };
}

/**
 * Advances a stopper in place: descend to the stop line, hold, then ascend.
 * Returns true only on the step that enters the hold (the first shot is timed from there).
 */
export function advanceStopper(state: StopState, dt: number): boolean {
    if (state.phase === 'descend') {
        state.y += ENEMY_SPEED * dt;
        if (state.y >= SOLO_STOP_Y) {
            state.y = SOLO_STOP_Y;
            state.phase = 'hold';
            state.holdLeft = SOLO_STOP_SEC;
            return true;
        }
    } else if (state.phase === 'hold') {
        state.holdLeft -= dt;
        if (state.holdLeft <= 0) {
            state.holdLeft = 0;
            state.phase = 'ascend';
        }
    } else {
        state.y -= ENEMY_SPEED * dt;
    }
    return false;
}

/** A rusher is gone once it has left the screen on the left, right or bottom. */
export function isRushGone(x: number, y: number): boolean {
    return x < -SOLO_OFFSCREEN_MARGIN
        || x > GAME_WIDTH + SOLO_OFFSCREEN_MARGIN
        || y > GAME_HEIGHT + SOLO_OFFSCREEN_MARGIN;
}

/** A stopper is gone once it has ascended past the top edge. */
export function isStopperGone(state: StopState): boolean {
    return state.phase === 'ascend' && state.y < -SOLO_OFFSCREEN_MARGIN;
}

/** The rusher touches the player: the same circle test as every other hit, no grace. */
export function rushTouchesPlayer(rushX: number, rushY: number, playerX: number, playerY: number): boolean {
    return circlesOverlap(rushX, rushY, ENEMY_RADIUS, playerX, playerY, PLAYER_RADIUS);
}
