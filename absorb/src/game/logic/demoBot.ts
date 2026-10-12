import {
    DEMO_BULLET_WEIGHT, DEMO_ENEMY_MARGIN, DEMO_ENEMY_WEIGHT, DEMO_HOME_WEIGHT, DEMO_HOME_Y_RATIO, DEMO_LOOKAHEAD,
    DEMO_RELEASE_MIN_STOCK, DEMO_RELEASE_RANGE, DEMO_RELEASE_STOCK, DEMO_ROAM_X_PERIOD, DEMO_ROAM_X_RATIO,
    DEMO_ROAM_Y_PERIOD, DEMO_ROAM_Y_RATIO, FIELD_RADIUS, PLAYER_MIN_Y, PLAYER_RADIUS,
    PLAYER_SPEED
} from './constants';
import { isOnScreen } from './geometry';
import type { Input, World } from './world';

// The title's demo player: a pure decision from the world's state, with no randomness. It compares nine moves
// (stay and the eight directions) by where each would put the player a moment later, and releases by the stock.

/**
 * The candidates in tie-break order: the first one wins a tie, so the bot stays put, then prefers up, then
 * turns clockwise.
 */
const MOVES: readonly (readonly [number, number])[] = [
    [0, 0], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]
];

function clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
}

/** How good it is to stand at (x, y): enemies nearby cost, bullets in reach of the field pay, straying from the roam target costs. */
function standing(world: World, x: number, y: number, targetX: number, targetY: number): number {
    const { height } = world.screen;
    let score = 0;
    for (const e of world.enemies) {
        if (e.removed || !isOnScreen(e, world.screen)) continue;
        const gap = Math.hypot(e.x - x, e.y - y) - e.radius - PLAYER_RADIUS;
        if (gap < DEMO_ENEMY_MARGIN) score -= DEMO_ENEMY_WEIGHT * (DEMO_ENEMY_MARGIN - gap);
    }
    for (const b of world.enemyBullets) {
        if (!b.removed && Math.hypot(b.x - x, b.y - y) <= FIELD_RADIUS) score += DEMO_BULLET_WEIGHT;
    }
    score -= (Math.hypot(x - targetX, y - targetY) / height) * DEMO_HOME_WEIGHT;
    return score;
}

/** Whether to release now: a lot of stock, or some stock with an enemy on screen within reach. */
function shouldRelease(world: World): boolean {
    const stock = world.stock;
    if (stock >= DEMO_RELEASE_STOCK) return true;
    if (stock < DEMO_RELEASE_MIN_STOCK) return false;
    const p = world.player;
    for (const e of world.enemies) {
        if (e.removed || !isOnScreen(e, world.screen)) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) <= DEMO_RELEASE_RANGE) return true;
    }
    return false;
}

/** Writes the bot's input for this frame into `out` (its drag is always 0). Outside `playing` it stays still. */
export function decideDemoInput(world: World, out: Input): void {
    out.dragX = 0;
    out.dragY = 0;
    out.moveX = 0;
    out.moveY = 0;
    out.release = false;
    if (world.phase !== 'playing') return;

    const { width, height } = world.screen;
    const p = world.player;
    const reach = PLAYER_SPEED * DEMO_LOOKAHEAD;
    // The roam target sweeps left-right and up-down with the play time, so the bot keeps moving about.
    const t = world.elapsed;
    const targetX = width / 2 + width * DEMO_ROAM_X_RATIO * Math.sin((2 * Math.PI * t) / DEMO_ROAM_X_PERIOD);
    const targetY = height * DEMO_HOME_Y_RATIO + height * DEMO_ROAM_Y_RATIO * Math.sin((2 * Math.PI * t) / DEMO_ROAM_Y_PERIOD);
    let best = -Infinity;
    for (const [mx, my] of MOVES) {
        const k = mx !== 0 && my !== 0 ? Math.SQRT1_2 : 1;
        const x = clamp(p.x + mx * k * reach, PLAYER_RADIUS, width - PLAYER_RADIUS);
        const y = clamp(p.y + my * k * reach, PLAYER_MIN_Y, height - PLAYER_RADIUS);
        const s = standing(world, x, y, targetX, targetY);
        if (s > best) {
            best = s;
            out.moveX = mx;
            out.moveY = my;
        }
    }
    out.release = shouldRelease(world);
}
