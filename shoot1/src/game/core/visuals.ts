import {
    MINE_RADIUS, MINE_EXPLODE_RADIUS, MINE_TIMEOUT_SEC, MINE_BLINK_SEC,
    MINE_RIPPLE_START_RADIUS, MINE_RIPPLE_END_RADIUS, MINE_RIPPLE_SEC, MINE_RIPPLE_ALPHA,
    PLAYER_RADIUS
} from './constants';
import type { BulletType } from './difficulty';
import { circlesOverlap } from './physics';

export type BulletShape = 'circle' | 'diamond' | 'triangle' | 'tailed';

export type BulletVisual = { shape: BulletShape; color: number };

const BULLET_VISUALS: Record<BulletType, BulletVisual> = {
    straight: { shape: 'circle', color: 0xff8800 },
    aimed: { shape: 'diamond', color: 0xff44ff },
    nway3: { shape: 'triangle', color: 0xaaff00 },
    nway5: { shape: 'triangle', color: 0xaaff00 },
    spread8: { shape: 'circle', color: 0xc9b8ff },
    fast: { shape: 'tailed', color: 0xffffff }
};

export const BULLET_TYPES = Object.keys(BULLET_VISUALS) as BulletType[];

/** Shape and color used to draw a bullet of the given type */
export function bulletVisual(type: BulletType): BulletVisual {
    return BULLET_VISUALS[type];
}

/** Rotation (radians) that points a +x-facing sprite along the velocity */
export function bulletRotation(vx: number, vy: number): number {
    return Math.atan2(vy, vx);
}

/** Radius of the shrinking countdown ring, or null before it appears */
export function countdownRingRadius(ageSec: number): number | null {
    const remaining = MINE_TIMEOUT_SEC - ageSec;
    if (remaining > MINE_BLINK_SEC) return null;
    const r = Math.max(remaining, 0);
    return MINE_RADIUS + (MINE_EXPLODE_RADIUS - MINE_RADIUS) * r / MINE_BLINK_SEC;
}

/** Whether the player is inside a mine's blast range (same test as the blast hit) */
export function isInBlastWarning(mineX: number, mineY: number, playerX: number, playerY: number): boolean {
    return circlesOverlap(mineX, mineY, MINE_EXPLODE_RADIUS, playerX, playerY, PLAYER_RADIUS);
}

/** Placement ripple radius and alpha, or null once it has finished */
export function rippleState(ageSec: number): { radius: number; alpha: number } | null {
    if (ageSec >= MINE_RIPPLE_SEC) return null;
    const t = Math.max(ageSec, 0) / MINE_RIPPLE_SEC;
    return {
        radius: MINE_RIPPLE_START_RADIUS + (MINE_RIPPLE_END_RADIUS - MINE_RIPPLE_START_RADIUS) * t,
        alpha: MINE_RIPPLE_ALPHA * (1 - t)
    };
}
