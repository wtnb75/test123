import {
    GRAVITY,
    JUMP_LOCK,
    JUMP_SPEED,
    MAX_FALL,
    MAX_PLATFORMS,
    MOVE_SPEED,
    PLATFORM_H,
    PLATFORM_LIFE,
    PLATFORM_MIN_ALPHA,
    PLATFORM_W,
    PLAYER_H,
    PLAYER_W,
    SCREEN_WIDTH,
} from '../params';

export interface Player {
    /** Center x. */
    x: number;
    /** Feet y (world coordinates, y grows downward). */
    y: number;
    vy: number;
    onGround: boolean;
    /** Seconds left before a platform can be built again (set by a jump off the ground). */
    lock: number;
}

export type PlatformKind = 'ground' | 'goal' | 'built';

export interface Platform {
    kind: PlatformKind;
    /** Center x. */
    x: number;
    /** Top surface y. */
    y: number;
    w: number;
    h: number;
    age: number;
}

export type ActionResult = 'jump' | 'platform' | 'none';

export function createPlayer(startY: number): Player {
    return { x: SCREEN_WIDTH / 2, y: startY, vy: 0, onGround: true, lock: 0 };
}

/** A platform without a lifetime that is wider than the screen (the start ground and the goal). */
export function createWidePlatform(kind: 'ground' | 'goal', y: number, h: number): Platform {
    return { kind, x: SCREEN_WIDTH / 2, y, w: SCREEN_WIDTH * 2, h, age: 0 };
}

export function createBuiltPlatform(x: number, y: number): Platform {
    return { kind: 'built', x, y, w: PLATFORM_W, h: PLATFORM_H, age: 0 };
}

/**
 * The action button: a jump on the ground; in the air a platform under the feet, unless the jump lock is
 * running. At most MAX_PLATFORMS built platforms exist: a new one removes the oldest.
 */
export function pressAction(player: Player, platforms: Platform[]): ActionResult {
    if (player.onGround) {
        player.vy = -JUMP_SPEED;
        player.onGround = false;
        player.lock = JUMP_LOCK;
        return 'jump';
    }
    if (player.lock > 0) return 'none';
    platforms.push(createBuiltPlatform(player.x, player.y));
    const built = platforms.filter((p) => p.kind === 'built');
    for (let i = 0; i < built.length - MAX_PLATFORMS; i++) {
        platforms.splice(platforms.indexOf(built[i]), 1);
    }
    return 'platform';
}

/** Ages the built platforms (removing the expired) and counts the jump lock down. */
export function tickTimers(player: Player, platforms: Platform[], dt: number): void {
    player.lock = Math.max(0, player.lock - dt);
    for (let i = platforms.length - 1; i >= 0; i--) {
        const p = platforms[i];
        if (p.kind !== 'built') continue;
        p.age += dt;
        if (p.age >= PLATFORM_LIFE) platforms.splice(i, 1);
    }
}

/** Opacity of a platform: built ones fade from 1 to PLATFORM_MIN_ALPHA over their life. */
export function platformAlpha(p: Platform): number {
    if (p.kind !== 'built') return 1;
    return 1 - (1 - PLATFORM_MIN_ALPHA) * Math.min(1, p.age / PLATFORM_LIFE);
}

/**
 * One step of the player: sideways move (clamped to the screen), gravity (semi-implicit Euler), landing on
 * one-way platforms, and the push back from above the top edge of the view. `dir` is -1, 0 or +1.
 */
export function stepPlayer(player: Player, dir: number, dt: number, platforms: Platform[], viewTop: number): void {
    player.x += dir * MOVE_SPEED * dt;
    player.x = Math.max(PLAYER_W / 2, Math.min(SCREEN_WIDTH - PLAYER_W / 2, player.x));

    const prevFeet = player.y;
    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
    player.y += player.vy * dt;
    player.onGround = false;

    if (player.vy >= 0) {
        let landed: Platform | null = null;
        for (const p of platforms) {
            const overlapX = Math.abs(player.x - p.x) < p.w / 2 + PLAYER_W / 2;
            if (!overlapX || prevFeet > p.y || player.y < p.y) continue;
            if (landed === null || p.y < landed.y) landed = p;
        }
        if (landed) {
            player.y = landed.y;
            player.vy = 0;
            player.onGround = true;
        }
    }

    clampToView(player, viewTop);
}

/** The head never goes above the top edge of the view (bullets appear there). */
export function clampToView(player: Player, viewTop: number): void {
    const minY = viewTop + PLAYER_H;
    if (player.y < minY) {
        player.y = minY;
        if (player.vy < 0) player.vy = 0;
    }
}
