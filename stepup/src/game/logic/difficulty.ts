import {
    BULLET_SPEED_BASE,
    BULLET_SPEED_MAX,
    BULLET_SPEED_PER_METER,
    BULLET_VX,
    DIAGONAL_CHANCE_BASE,
    DIAGONAL_CHANCE_MAX,
    DIAGONAL_CHANCE_PER_METER,
    DIAGONAL_START_METERS,
    DOUBLE_SPAWN_METERS,
    GOAL_METERS,
    PX_PER_METER,
    SCROLL_BASE,
    SCROLL_MAX,
    SCROLL_PER_METER,
    SPAWN_INTERVAL_BASE,
    SPAWN_INTERVAL_MIN,
    SPAWN_INTERVAL_PER_METER,
} from '../params';

/** Climbed height in metres: from the start to the highest point the feet reached (never decreases). */
export function meters(startY: number, highestFeetY: number): number {
    return Math.max(0, (startY - highestFeetY) / PX_PER_METER);
}

/** The height shown in the HUD and on Result: truncated, capped at the goal height. */
export function displayMeters(m: number): number {
    return Math.min(GOAL_METERS, Math.floor(m));
}

export function scrollSpeed(m: number): number {
    return Math.min(SCROLL_MAX, SCROLL_BASE + SCROLL_PER_METER * m);
}

export function bulletSpeed(m: number): number {
    return Math.min(BULLET_SPEED_MAX, BULLET_SPEED_BASE + BULLET_SPEED_PER_METER * m);
}

export function spawnInterval(m: number): number {
    return Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_BASE - SPAWN_INTERVAL_PER_METER * m);
}

export function bulletsPerSpawn(m: number): number {
    return m >= DOUBLE_SPAWN_METERS ? 2 : 1;
}

/** Share of diagonal bullets: none below DIAGONAL_START_METERS, then growing up to a cap. */
export function diagonalChance(m: number): number {
    if (m < DIAGONAL_START_METERS) return 0;
    return Math.min(
        DIAGONAL_CHANCE_MAX,
        DIAGONAL_CHANCE_BASE + DIAGONAL_CHANCE_PER_METER * (m - DIAGONAL_START_METERS),
    );
}

/** Sideways speed of a new bullet: 0 (vertical) or +-BULLET_VX. Both randoms are in [0, 1). */
export function pickBulletVx(m: number, randKind: number, randSign: number): number {
    if (randKind >= diagonalChance(m)) return 0;
    return randSign < 0.5 ? -BULLET_VX : BULLET_VX;
}
