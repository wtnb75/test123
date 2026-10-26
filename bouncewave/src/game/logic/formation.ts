// Enemy formation: layout per wave, sideways movement, and who shoots.
import {
    ENEMY_BALL_SPEED,
    ENEMY_BALL_SPREAD,
    ENEMY_COLS,
    ENEMY_GAP,
    ENEMY_HEIGHT,
    ENEMY_ROWS_BASE,
    ENEMY_ROWS_EVERY_WAVES,
    ENEMY_ROWS_MAX,
    ENEMY_WIDTH,
    FIRE_INTERVAL_BASE,
    FIRE_INTERVAL_DECAY,
    FIRE_INTERVAL_MIN,
    FORMATION_SPEED,
    FORMATION_SPEEDUP,
    FORMATION_TOP,
    FORMATION_TURNS_TO_INVADE,
    FIELD_LEFT,
    FIELD_RIGHT,
} from '../params';
import type { Rect } from './physics';

export interface Enemy {
    id: number;
    col: number;
    /** Center x when the formation offset is 0. */
    baseX: number;
    rect: Rect;
}

export interface Formation {
    enemies: Enemy[];
    offsetX: number;
    dir: 1 | -1;
    /** How many enemies the formation started with (its speed rises as they fall). */
    total: number;
    /** How far the whole formation drops on every turn at a wall. */
    drop: number;
}

/** Floating-point slack when comparing the formation's bottom with the danger line. */
const DANGER_EPSILON = 0.001;

export function rowsForWave(wave: number): number {
    const extra = Math.floor((wave - 1) / ENEMY_ROWS_EVERY_WAVES);
    return Math.min(ENEMY_ROWS_BASE + extra, ENEMY_ROWS_MAX);
}

export function fireInterval(wave: number): number {
    return Math.max(FIRE_INTERVAL_BASE * Math.pow(FIRE_INTERVAL_DECAY, wave - 1), FIRE_INTERVAL_MIN);
}

/** Horizontal speed: FORMATION_SPEED with everyone alive, rising towards (1 + FORMATION_SPEEDUP) x. */
export function formationSpeed(alive: number, total: number): number {
    if (total <= 0) return FORMATION_SPEED; // an empty formation never moves; guard the division anyway
    return FORMATION_SPEED * (1 + FORMATION_SPEEDUP * (1 - alive / total));
}

/** Drop per turn so an untouched formation reaches the danger line on turn FORMATION_TURNS_TO_INVADE. */
export function formationDrop(rows: number, dangerY: number): number {
    const bottom = FORMATION_TOP + rows * ENEMY_HEIGHT + (rows - 1) * ENEMY_GAP;
    return (dangerY - bottom) / FORMATION_TURNS_TO_INVADE;
}

/** Whether the lowest living enemy's bottom has reached the danger line at dangerY. */
export function reachedDanger(f: Formation, dangerY: number): boolean {
    for (const e of f.enemies) {
        if (e.rect.y + e.rect.h / 2 >= dangerY - DANGER_EPSILON) return true;
    }
    return false;
}

/** A new, horizontally centered formation moving right; ids start at firstId. */
export function createFormation(wave: number, firstId: number, dangerY: number): Formation {
    const rows = rowsForWave(wave);
    const totalW = ENEMY_COLS * ENEMY_WIDTH + (ENEMY_COLS - 1) * ENEMY_GAP;
    const left = (FIELD_LEFT + FIELD_RIGHT - totalW) / 2; // centred between the walls
    const enemies: Enemy[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < ENEMY_COLS; col++) {
            const x = left + col * (ENEMY_WIDTH + ENEMY_GAP) + ENEMY_WIDTH / 2;
            const y = FORMATION_TOP + row * (ENEMY_HEIGHT + ENEMY_GAP) + ENEMY_HEIGHT / 2;
            enemies.push({ id: firstId + enemies.length, col, baseX: x, rect: { x, y, w: ENEMY_WIDTH, h: ENEMY_HEIGHT } });
        }
    }
    return { enemies, offsetX: 0, dir: 1, total: enemies.length, drop: formationDrop(rows, dangerY) };
}

/**
 * Moves the formation sideways (faster as it empties); when a living enemy crosses a wall's inner face it
 * takes back the overshoot, turns around and drops by `drop`.
 */
export function moveFormation(f: Formation, dt: number): void {
    if (f.enemies.length === 0) return;
    f.offsetX += f.dir * formationSpeed(f.enemies.length, f.total) * dt;
    let minBase = Infinity;
    let maxBase = -Infinity;
    for (const e of f.enemies) {
        minBase = Math.min(minBase, e.baseX);
        maxBase = Math.max(maxBase, e.baseX);
    }
    const leftEdge = minBase + f.offsetX - ENEMY_WIDTH / 2;
    const rightEdge = maxBase + f.offsetX + ENEMY_WIDTH / 2;
    let turned = false;
    if (leftEdge < FIELD_LEFT) {
        f.offsetX += FIELD_LEFT - leftEdge;
        f.dir = 1;
        turned = true;
    } else if (rightEdge > FIELD_RIGHT) {
        f.offsetX -= rightEdge - FIELD_RIGHT;
        f.dir = -1;
        turned = true;
    }
    for (const e of f.enemies) {
        e.rect.x = e.baseX + f.offsetX;
        if (turned) e.rect.y += f.drop;
    }
}

/** The lowest living enemy of each column that still has one, ordered left to right. */
export function shooters(enemies: readonly Enemy[]): Enemy[] {
    const lowest: (Enemy | undefined)[] = [];
    for (const e of enemies) {
        const cur = lowest[e.col];
        if (!cur || e.rect.y > cur.rect.y) lowest[e.col] = e;
    }
    return lowest.filter((e): e is Enemy => e !== undefined);
}

/** Picks one shooter with r in [0, 1); undefined when there is none. */
export function pickShooter(enemies: readonly Enemy[], r: number): Enemy | undefined {
    const list = shooters(enemies);
    if (list.length === 0) return undefined;
    return list[Math.min(Math.floor(r * list.length), list.length - 1)];
}

/** Initial velocity of an enemy shot; r in [0, 1) tilts it from straight down (positive = right). */
export function enemyShotVelocity(r: number): { vx: number; vy: number } {
    const a = ((2 * r - 1) * ENEMY_BALL_SPREAD * Math.PI) / 180;
    return { vx: Math.sin(a) * ENEMY_BALL_SPEED, vy: Math.cos(a) * ENEMY_BALL_SPEED };
}
