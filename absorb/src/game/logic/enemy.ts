import {
    EDGE_MARGIN, ENEMY_SPECS, ENTER_SPEED, GAME_HEIGHT, GAME_WIDTH,
    GRUNT_DIVE_MAX_INTERVAL, GRUNT_DIVE_MIN_INTERVAL, GRUNT_DIVE_SPEED, GRUNT_MAX_Y, GRUNT_MIN_Y,
    GRUNT_WARN, GRUNT_WEAVE_AMPLITUDE, GRUNT_WEAVE_PERIOD,
    HEAVY_DRIFT_SPEED, HEAVY_Y,
    RAMMER_HOMING_DURATION, RAMMER_HOMING_FROM, RAMMER_SPEED, RAMMER_TURN_RATE, RAMMER_WARN, RAMMER_Y,
    SHOOTER_BOB_AMPLITUDE, SHOOTER_BOB_PERIOD, SHOOTER_CROSS_INTERVAL, SHOOTER_CROSS_SPEED, SHOOTER_CROSS_Y,
    SHOOTER_VERTICAL_SPEED, SHOOTER_Y, SWAY_RANGE, SWAY_SPEED,
    type EnemyKind
} from './constants';
import { angleTo, isFullyOffScreen, isOnScreen, randomRange, turnToward, type Point, type Rng } from './geometry';

export type EnemyState =
    | 'enter'      // descending from above the screen to its station height
    | 'sway'       // grunt / shooter: swaying at the station
    | 'warn'       // grunt / rammer: telegraphing an attack
    | 'dive'       // grunt: weaving dive toward the locked target
    | 'cross-down' // shooter: dropping to the crossing height
    | 'cross-side' // shooter: crossing to the opposite edge
    | 'cross-up'   // shooter: climbing back to the station height
    | 'drift'      // heavy: swaying while sinking without stopping
    | 'dash';      // rammer: charging

export interface Enemy {
    id: number;
    kind: EnemyKind;
    x: number;
    y: number;
    hp: number;
    radius: number;
    state: EnemyState;
    stateTime: number;
    /** Station height the enemy descends to on entry. */
    stationY: number;
    swayCenter: number;
    swayDir: number;
    fireTimer: number;
    /** Countdown to the next dive (grunt) or crossing (shooter). */
    actionTimer: number;
    /** Movement direction in radians during a dive or dash. */
    heading: number;
    homingLeft: number;
    originX: number;
    originY: number;
    bobTime: number;
    crossTargetX: number;
    /** Number of release bullets currently targeting this enemy. */
    incoming: number;
    removed: boolean;
}

export interface EnemyContext {
    player: Point;
    /** Seconds since the playing phase started. */
    elapsed: number;
    rng: Rng;
}

function stationYFor(kind: EnemyKind, rng: Rng): number {
    switch (kind) {
        case 'grunt': return randomRange(rng, GRUNT_MIN_Y, GRUNT_MAX_Y);
        case 'shooter': return SHOOTER_Y;
        case 'heavy': return HEAVY_Y;
        default: return RAMMER_Y;
    }
}

function placeAboveScreen(e: Enemy, rng: Rng): void {
    e.x = randomRange(rng, EDGE_MARGIN, GAME_WIDTH - EDGE_MARGIN);
    e.y = -e.radius;
    e.stationY = stationYFor(e.kind, rng);
    setState(e, 'enter');
}

export function createEnemy(kind: EnemyKind, id: number, rng: Rng): Enemy {
    const spec = ENEMY_SPECS[kind];
    const e: Enemy = {
        id, kind, x: 0, y: 0, hp: spec.hp, radius: spec.radius,
        state: 'enter', stateTime: 0, stationY: 0,
        swayCenter: 0, swayDir: 1, fireTimer: 0, actionTimer: 0,
        heading: 0, homingLeft: 0, originX: 0, originY: 0,
        bobTime: 0, crossTargetX: 0, incoming: 0, removed: false
    };
    placeAboveScreen(e, rng);
    return e;
}

function setState(e: Enemy, state: EnemyState): void {
    e.state = state;
    e.stateTime = 0;
}

function arrive(e: Enemy, rng: Rng): void {
    e.y = e.stationY;
    e.swayCenter = e.x;
    e.fireTimer = ENEMY_SPECS[e.kind].fireInterval / 2;
    switch (e.kind) {
        case 'grunt':
            e.actionTimer = randomRange(rng, GRUNT_DIVE_MIN_INTERVAL, GRUNT_DIVE_MAX_INTERVAL);
            setState(e, 'sway');
            break;
        case 'shooter':
            e.actionTimer = SHOOTER_CROSS_INTERVAL;
            e.bobTime = 0;
            setState(e, 'sway');
            break;
        case 'heavy':
            setState(e, 'drift');
            break;
        default:
            setState(e, 'warn');
    }
}

/** Moves back and forth within ±SWAY_RANGE of swayCenter, bouncing at the edge margins. */
export function sway(e: Enemy, dt: number): void {
    const lo = Math.max(e.swayCenter - SWAY_RANGE, EDGE_MARGIN);
    const hi = Math.min(e.swayCenter + SWAY_RANGE, GAME_WIDTH - EDGE_MARGIN);
    e.x += e.swayDir * SWAY_SPEED * dt;
    if (e.x >= hi) {
        e.x = hi;
        e.swayDir = -1;
    } else if (e.x <= lo) {
        e.x = lo;
        e.swayDir = 1;
    }
}

function updateGrunt(e: Enemy, dt: number, ctx: EnemyContext): void {
    switch (e.state) {
        case 'sway':
            sway(e, dt);
            e.actionTimer -= dt;
            if (e.actionTimer <= 0) setState(e, 'warn');
            break;
        case 'warn':
            if (e.stateTime >= GRUNT_WARN) {
                e.heading = angleTo(e, ctx.player);
                e.originX = e.x;
                e.originY = e.y;
                setState(e, 'dive');
            }
            break;
        case 'dive': {
            const travel = GRUNT_DIVE_SPEED * e.stateTime;
            const weave = GRUNT_WEAVE_AMPLITUDE * Math.sin((Math.PI * 2 * e.stateTime) / GRUNT_WEAVE_PERIOD);
            const cos = Math.cos(e.heading);
            const sin = Math.sin(e.heading);
            e.x = e.originX + cos * travel - sin * weave;
            e.y = e.originY + sin * travel + cos * weave;
            if (isFullyOffScreen(e, e.radius)) placeAboveScreen(e, ctx.rng);
            break;
        }
    }
}

function updateShooter(e: Enemy, dt: number): void {
    switch (e.state) {
        case 'sway':
            sway(e, dt);
            e.bobTime += dt;
            e.y = e.stationY + SHOOTER_BOB_AMPLITUDE * Math.sin((Math.PI * 2 * e.bobTime) / SHOOTER_BOB_PERIOD);
            e.actionTimer -= dt;
            if (e.actionTimer <= 0) setState(e, 'cross-down');
            break;
        case 'cross-down':
            e.y += SHOOTER_VERTICAL_SPEED * dt;
            if (e.y >= SHOOTER_CROSS_Y) {
                e.y = SHOOTER_CROSS_Y;
                e.crossTargetX = e.x < GAME_WIDTH / 2 ? GAME_WIDTH - EDGE_MARGIN : EDGE_MARGIN;
                setState(e, 'cross-side');
            }
            break;
        case 'cross-side': {
            const step = SHOOTER_CROSS_SPEED * dt;
            const dx = e.crossTargetX - e.x;
            if (Math.abs(dx) <= step) {
                e.x = e.crossTargetX;
                setState(e, 'cross-up');
            } else {
                e.x += Math.sign(dx) * step;
            }
            break;
        }
        case 'cross-up':
            e.y -= SHOOTER_VERTICAL_SPEED * dt;
            if (e.y <= e.stationY) {
                e.y = e.stationY;
                e.swayCenter = e.x;
                e.bobTime = 0;
                e.actionTimer = SHOOTER_CROSS_INTERVAL;
                setState(e, 'sway');
            }
            break;
    }
}

function updateHeavy(e: Enemy, dt: number): void {
    sway(e, dt);
    e.y += HEAVY_DRIFT_SPEED * dt;
    if (e.y - e.radius > GAME_HEIGHT) e.removed = true;
}

function updateRammer(e: Enemy, dt: number, ctx: EnemyContext): void {
    if (e.state === 'warn') {
        if (e.stateTime >= RAMMER_WARN) {
            e.heading = angleTo(e, ctx.player);
            e.homingLeft = ctx.elapsed >= RAMMER_HOMING_FROM ? RAMMER_HOMING_DURATION : 0;
            setState(e, 'dash');
        }
        return;
    }
    if (e.homingLeft > 0) {
        e.heading = turnToward(e.heading, angleTo(e, ctx.player), RAMMER_TURN_RATE * dt);
        e.homingLeft -= dt;
    }
    e.x += Math.cos(e.heading) * RAMMER_SPEED * dt;
    e.y += Math.sin(e.heading) * RAMMER_SPEED * dt;
    if (isFullyOffScreen(e, e.radius)) e.removed = true;
}

function canFire(e: Enemy): boolean {
    if (ENEMY_SPECS[e.kind].fireInterval <= 0 || !isOnScreen(e)) return false;
    switch (e.kind) {
        case 'grunt': return e.state === 'sway';
        case 'heavy': return e.state === 'drift';
        default: return e.state !== 'enter';
    }
}

/** Advances one enemy by dt seconds. Returns true when it fires a volley this frame. */
export function updateEnemy(e: Enemy, dt: number, ctx: EnemyContext): boolean {
    e.stateTime += dt;
    if (e.state === 'enter') {
        e.y += ENTER_SPEED * dt;
        if (e.y >= e.stationY) arrive(e, ctx.rng);
        return false;
    }
    switch (e.kind) {
        case 'grunt': updateGrunt(e, dt, ctx); break;
        case 'shooter': updateShooter(e, dt); break;
        case 'heavy': updateHeavy(e, dt); break;
        default: updateRammer(e, dt, ctx);
    }
    if (e.removed || !canFire(e)) return false;
    e.fireTimer -= dt;
    if (e.fireTimer > 0) return false;
    e.fireTimer += ENEMY_SPECS[e.kind].fireInterval;
    return true;
}
