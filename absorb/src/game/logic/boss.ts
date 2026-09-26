import {
    BOSS_CHARGE_INTERVAL, BOSS_CHARGE_PAUSE, BOSS_CHARGE_SPEED, BOSS_CHARGE_WARN, BOSS_ENTER_SPEED, BOSS_FAN_COUNT,
    BOSS_FAN_STEP, BOSS_FIRE_INTERVAL, BOSS_HP_BASE, BOSS_HP_STEP, BOSS_RADIAL_COUNT, BOSS_RADIUS, BOSS_RETURN_SPEED,
    BOSS_SCORE_PER_HP, BOSS_SWAY_SPEED, BOSS_Y_RATIO, EDGE_MARGIN
} from './constants';
import { approach, blankEnemy, moveToward, setState, type Enemy, type EnemyContext } from './enemy';
import { angleTo, type Point } from './geometry';
import type { ScreenSize } from './screen';

/** Max HP of the n-th boss (1-based). */
export function bossMaxHp(n: number): number {
    return BOSS_HP_BASE + BOSS_HP_STEP * (n - 1);
}

export function bossScore(boss: Enemy): number {
    return boss.maxHp * BOSS_SCORE_PER_HP;
}

/** The n-th boss, hidden just above the top edge at the horizontal center. */
export function createBoss(n: number, id: number, screen: ScreenSize): Enemy {
    const e = blankEnemy('boss', id, bossMaxHp(n), BOSS_RADIUS);
    e.x = screen.width / 2;
    e.y = -BOSS_RADIUS;
    e.stationY = screen.height * BOSS_Y_RATIO;
    e.swayDir = 1;
    return e;
}

function startSway(e: Enemy): void {
    e.fireTimer = BOSS_FIRE_INTERVAL;
    e.actionTimer = BOSS_CHARGE_INTERVAL;
    setState(e, 'sway');
}

/**
 * Sways within the edge margins, reversing at each end. From outside the range (after a charge
 * near a wall) it heads inward first and only starts bouncing once inside.
 */
function swayBoss(e: Enemy, dt: number, screenWidth: number): void {
    const lo = EDGE_MARGIN + e.radius;
    const hi = screenWidth - EDGE_MARGIN - e.radius;
    const inside = e.x >= lo && e.x <= hi;
    if (e.x < lo) e.swayDir = 1;
    else if (e.x > hi) e.swayDir = -1;
    e.x += e.swayDir * BOSS_SWAY_SPEED * dt;
    if (!inside) return;
    if (e.x >= hi) {
        e.x = hi;
        e.swayDir = -1;
    } else if (e.x <= lo) {
        e.x = lo;
        e.swayDir = 1;
    }
}

/** Advances the boss by dt seconds. Returns true when it fires a volley this frame. */
export function updateBoss(e: Enemy, dt: number, ctx: EnemyContext): boolean {
    e.stateTime += dt;
    switch (e.state) {
        case 'enter':
            e.y = approach(e.y, e.stationY, BOSS_ENTER_SPEED * dt);
            if (e.y === e.stationY) startSway(e);
            return false;
        case 'sway':
            swayBoss(e, dt, ctx.screen.width);
            e.actionTimer -= dt;
            if (e.actionTimer <= 0) {
                setState(e, 'warn');
                return false;
            }
            e.fireTimer -= dt;
            if (e.fireTimer > 0) return false;
            e.fireTimer += BOSS_FIRE_INTERVAL;
            return true;
        case 'warn':
            if (e.stateTime >= BOSS_CHARGE_WARN) {
                e.chargeX = ctx.player.x;
                e.chargeY = ctx.player.y;
                setState(e, 'charge');
            }
            return false;
        case 'charge':
            moveToward(e, e.chargeX, e.chargeY, BOSS_CHARGE_SPEED * dt);
            if (e.x === e.chargeX && e.y === e.chargeY) setState(e, 'pause');
            return false;
        case 'pause':
            if (e.stateTime >= BOSS_CHARGE_PAUSE) setState(e, 'return');
            return false;
        default:
            e.y = approach(e.y, e.stationY, BOSS_RETURN_SPEED * dt);
            if (e.y === e.stationY) startSway(e);
            return false;
    }
}

/**
 * Directions of the boss's next volley, alternating a radial ring (first) and a fan aimed at
 * the target. Each ring is turned clockwise by half a gap from the previous one.
 */
export function bossVolley(e: Enemy, target: Point): number[] {
    const n = e.volleys++;
    const angles: number[] = [];
    if (n % 2 === 0) {
        const gap = (Math.PI * 2) / BOSS_RADIAL_COUNT;
        const base = Math.PI / 2 + (n / 2) * (gap / 2);
        for (let i = 0; i < BOSS_RADIAL_COUNT; i++) angles.push(base + gap * i);
        return angles;
    }
    const aim = angleTo(e, target);
    const mid = (BOSS_FAN_COUNT - 1) / 2;
    for (let i = 0; i < BOSS_FAN_COUNT; i++) angles.push(aim + (i - mid) * BOSS_FAN_STEP);
    return angles;
}
