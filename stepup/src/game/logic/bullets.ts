import {
    BULLET_OFFSCREEN,
    BULLET_R,
    BULLET_X_MARGIN,
    FIRST_SPAWN_DELAY,
    PLAYER_H,
    PLAYER_W,
    SCREEN_WIDTH,
    WARN_BACK,
    WARN_HALF_W,
    WARN_TIP,
    WARN_TIME,
    WARN_Y,
} from '../params';
import { bulletSpeed, bulletsPerSpawn, pickBulletVx, spawnInterval } from './difficulty';
import type { Player } from './physics';

export interface Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

/** A warning mark: becomes a bullet with the same vx / vy when `t` runs out. */
export interface Warn {
    x: number;
    vx: number;
    vy: number;
    t: number;
}

export interface BulletField {
    bullets: Bullet[];
    warns: Warn[];
    /** Seconds until the next batch of warnings. */
    spawnTimer: number;
}

export function createBulletField(): BulletField {
    return { bullets: [], warns: [], spawnTimer: FIRST_SPAWN_DELAY };
}

/** One warning: x, kind, direction drawn from `rng` in that order; speed fixed by the height `m` now. */
export function createWarn(m: number, rng: () => number): Warn {
    const x = BULLET_X_MARGIN + rng() * (SCREEN_WIDTH - 2 * BULLET_X_MARGIN);
    const kind = rng();
    const sign = rng();
    return { x, vx: pickBulletVx(m, kind, sign), vy: bulletSpeed(m), t: WARN_TIME };
}

/**
 * One frame of bullets, in the spec's order: (a) move the bullets that exist, (b) tick the warnings that exist
 * and turn the expired ones into bullets (not moved this frame), (c) tick the spawn timer and add warnings
 * (not ticked this frame). Then drop bullets that left the view. `m` is the current height.
 */
export function stepBullets(
    field: BulletField,
    dt: number,
    viewTop: number,
    viewHeight: number,
    m: number,
    rng: () => number,
): void {
    for (const b of field.bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
    }
    for (let i = field.warns.length - 1; i >= 0; i--) {
        const w = field.warns[i];
        w.t -= dt;
        if (w.t <= 0) {
            field.bullets.push({ x: w.x, y: viewTop - BULLET_R, vx: w.vx, vy: w.vy });
            field.warns.splice(i, 1);
        }
    }
    field.spawnTimer -= dt;
    if (field.spawnTimer <= 0) {
        for (let i = bulletsPerSpawn(m); i > 0; i--) field.warns.push(createWarn(m, rng));
        field.spawnTimer = spawnInterval(m);
    }
    const bottom = viewTop + viewHeight + BULLET_OFFSCREEN;
    for (let i = field.bullets.length - 1; i >= 0; i--) {
        const b = field.bullets[i];
        if (b.y > bottom || b.x < -BULLET_OFFSCREEN || b.x > SCREEN_WIDTH + BULLET_OFFSCREEN) {
            field.bullets.splice(i, 1);
        }
    }
}

/** Circle (bullet) against the player's box: touching counts. */
export function bulletHitsPlayer(b: Bullet, player: Player): boolean {
    const left = player.x - PLAYER_W / 2;
    const right = player.x + PLAYER_W / 2;
    const top = player.y - PLAYER_H;
    const bottom = player.y;
    const dx = b.x - Math.max(left, Math.min(b.x, right));
    const dy = b.y - Math.max(top, Math.min(b.y, bottom));
    return dx * dx + dy * dy <= BULLET_R * BULLET_R;
}

/** Tilt of a warning from straight down, in radians (the world-space direction the bullet will fly). */
export function warnTilt(w: Pick<Warn, 'vx' | 'vy'>): number {
    return Math.atan2(w.vx, w.vy);
}

/** The three corners (screen coordinates) of a warning triangle pointing the way the bullet flies. */
export function warnTriangle(x: number, tilt: number): [number, number][] {
    const sin = Math.sin(tilt);
    const cos = Math.cos(tilt);
    // (side, forward) in the bullet's frame -> screen; forward is (sin, cos), side is (cos, -sin).
    const pt = (side: number, forward: number): [number, number] => [
        x + side * cos + forward * sin,
        WARN_Y - side * sin + forward * cos,
    ];
    return [pt(-WARN_HALF_W, -WARN_BACK), pt(WARN_HALF_W, -WARN_BACK), pt(0, WARN_TIP)];
}
