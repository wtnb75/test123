import { P } from './params';

export interface Player {
    x: number; // center x
    y: number; // feet y (world coords, y grows downward)
    vy: number;
    onGround: boolean;
    lock: number; // s left before a platform can be built again
}

export interface Platform {
    x: number; // center x
    y: number; // top y
    w: number;
    age: number;
    life: number; // Infinity for the start ground
}

export interface Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

export type ActionResult = 'jump' | 'platform' | 'none';

export function createPlatform(x: number, y: number): Platform {
    return { x, y, w: P.platW, age: 0, life: P.platLife };
}

/** Button press: jump on ground, otherwise build a platform under the feet. */
export function pressAction(player: Player, platforms: Platform[]): ActionResult {
    if (player.onGround) {
        player.vy = -P.jumpSpeed;
        player.onGround = false;
        player.lock = P.jumpLock;
        return 'jump';
    }
    if (player.lock > 0) return 'none';
    platforms.push(createPlatform(player.x, player.y));
    // keep the newest maxPlatforms; drop the oldest (never the ground)
    const built = platforms.filter((p) => Number.isFinite(p.life));
    while (built.length > P.maxPlatforms) {
        const oldest = built.shift()!;
        platforms.splice(platforms.indexOf(oldest), 1);
    }
    return 'platform';
}

/** Advance platforms' age and drop expired ones (in place). */
export function agePlatforms(platforms: Platform[], dt: number): void {
    for (let i = platforms.length - 1; i >= 0; i--) {
        platforms[i].age += dt;
        if (platforms[i].age >= platforms[i].life) platforms.splice(i, 1);
    }
}

/** One physics step with one-way platform landing. dir: -1, 0, 1. */
export function stepPlayer(player: Player, dir: number, dt: number, platforms: Platform[]): void {
    player.x += dir * P.moveSpeed * dt;
    player.x = Math.max(P.playerW / 2, Math.min(P.width - P.playerW / 2, player.x));

    player.lock = Math.max(0, player.lock - dt);
    const prevFeet = player.y;
    player.vy = Math.min(P.maxFall, player.vy + P.gravity * dt);
    player.y += player.vy * dt;
    player.onGround = false;

    if (player.vy >= 0) {
        for (const p of platforms) {
            const overlapX = Math.abs(player.x - p.x) < p.w / 2 + P.playerW / 2;
            if (overlapX && prevFeet <= p.y && player.y >= p.y) {
                player.y = p.y;
                player.vy = 0;
                player.onGround = true;
                break;
            }
        }
    }
}

/**
 * Swipe movement: the finger drags an anchor along. dir is the side of the anchor
 * the finger is on (0 inside the dead zone); the anchor trails the finger by at most swipeRadius.
 */
export function swipeStep(anchorX: number, fingerX: number): { dir: number; anchor: number } {
    let anchor = anchorX;
    const d = fingerX - anchor;
    if (d > P.swipeRadius) anchor = fingerX - P.swipeRadius;
    else if (d < -P.swipeRadius) anchor = fingerX + P.swipeRadius;
    const off = fingerX - anchor;
    const dir = off > P.swipeDead ? 1 : off < -P.swipeDead ? -1 : 0;
    return { dir, anchor };
}

/** The player cannot go above the top edge of the view (bullets spawn there). */
export function clampToView(player: Player, viewTop: number): void {
    const minY = viewTop + P.playerH;
    if (player.y < minY) {
        player.y = minY;
        if (player.vy < 0) player.vy = 0;
    }
}

export function scrollSpeed(meters: number): number {
    return Math.min(P.scrollMax, P.scrollBase + P.scrollPerMeter * meters);
}

export function bulletSpeed(meters: number): number {
    return Math.min(P.bulletSpeedMax, P.bulletSpeedBase + P.bulletSpeedPerMeter * meters);
}

export function spawnInterval(meters: number): number {
    return Math.max(P.spawnIntervalMin, P.spawnIntervalBase - P.spawnIntervalPerMeter * meters);
}

export function bulletsPerSpawn(meters: number): number {
    return meters >= P.bulletsAtOnceMeters ? 2 : 1;
}

export function diagonalChance(meters: number): number {
    if (meters < P.diagonalStartMeters) return 0;
    return Math.min(P.diagonalChanceMax, P.diagonalChanceBase + P.diagonalChancePerMeter * (meters - P.diagonalStartMeters));
}

/** Sideways speed of a new bullet: 0 (vertical) or +-bulletVx (diagonal). rand: [0,1) x2. */
export function pickBulletVx(meters: number, randKind: number, randSign: number): number {
    if (randKind >= diagonalChance(meters)) return 0;
    return randSign < 0.5 ? -P.bulletVx : P.bulletVx;
}

/** Stage 1 clear: standing on the goal platform. */
export function isCleared(player: Player, goalY: number): boolean {
    return player.onGround && player.y <= goalY + 0.5;
}

/** Circle (bullet) vs player box hit test. */
export function bulletHitsPlayer(b: Bullet, player: Player): boolean {
    const left = player.x - P.playerW / 2;
    const right = player.x + P.playerW / 2;
    const top = player.y - P.playerH;
    const bottom = player.y;
    const cx = Math.max(left, Math.min(b.x, right));
    const cy = Math.max(top, Math.min(b.y, bottom));
    const dx = b.x - cx;
    const dy = b.y - cy;
    return dx * dx + dy * dy <= P.bulletR * P.bulletR;
}

/** Player has fallen below the bottom edge of the view. */
export function isLeftBehind(player: Player, viewBottom: number): boolean {
    return player.y - P.playerH > viewBottom;
}
