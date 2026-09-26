import {
    EDGE_MARGIN, EDGE_WEIGHTS_LANDSCAPE, EDGE_WEIGHTS_PORTRAIT, ENEMY_SPECS, ENTER_SPEED,
    GRUNT_DIVE_MAX_INTERVAL, GRUNT_DIVE_MIN_INTERVAL, GRUNT_DIVE_SPEED, GRUNT_MAX_Y_RATIO, GRUNT_MIN_Y_RATIO,
    GRUNT_WARN, GRUNT_WEAVE_AMPLITUDE, GRUNT_WEAVE_PERIOD,
    HEAVY_CHARGE_AT, HEAVY_CHARGE_SPEED, HEAVY_CHARGE_SPEED_LATE, HEAVY_CYCLE, HEAVY_LATE_FROM, HEAVY_RING_RADIUS,
    HEAVY_SURROUND_SPEED, HEAVY_SURROUND_SPEED_LATE, HEAVY_WARN_AT, HEAVY_Y_RATIO,
    RAMMER_HOMING_DURATION, RAMMER_HOMING_FROM, RAMMER_SPEED, RAMMER_TURN_RATE, RAMMER_WARN, RAMMER_Y_RATIO,
    SHOOTER_ALIGN_SPEED, SHOOTER_BOB_AMPLITUDE, SHOOTER_BOB_PERIOD, SHOOTER_RETURN_SPEED, SHOOTER_SWEEP_INTERVAL,
    SHOOTER_SWEEP_SPEED, SHOOTER_SWEEP_WARN, SHOOTER_Y_RATIO,
    SIDE_STATION_MAX_RATIO, SIDE_STATION_MIN_RATIO, SIDE_Y_MAX_RATIO, SIDE_Y_MIN_RATIO,
    SWAY_RANGE, SWAY_SPEED,
    type EnemyKind, type SpawnEdge
} from './constants';
import { angleTo, isFullyOffScreen, isOnScreen, randomRange, turnToward, type Point, type Rng } from './geometry';
import type { ScreenSize } from './screen';

export type EnemyState =
    | 'enter'        // coming in from off screen to the station
    | 'sway'         // grunt / shooter: swaying at the station
    | 'warn'         // grunt / rammer: telegraphing an attack
    | 'dive'         // grunt: weaving dive toward the locked target
    | 'sweep-warn'   // shooter: telegraphing a sweep
    | 'sweep-align'  // shooter: moving vertically to the locked sweep height
    | 'sweep'        // shooter: charging across to the opposite edge
    | 'sweep-return' // shooter: moving vertically back to the station height
    | 'chase'        // heavy: surrounding and charging the player
    | 'dash';        // rammer: charging

export interface Enemy {
    id: number;
    kind: EnemyKind;
    x: number;
    y: number;
    hp: number;
    radius: number;
    state: EnemyState;
    stateTime: number;
    /** Screen edge the enemy (last) entered from. */
    entry: SpawnEdge;
    /** Where the enemy stops after entering. */
    stationX: number;
    stationY: number;
    swayCenter: number;
    swayDir: number;
    fireTimer: number;
    /** Countdown to the next dive (grunt) or sweep (shooter). */
    actionTimer: number;
    /** Movement direction in radians during a dive or dash. */
    heading: number;
    homingLeft: number;
    originX: number;
    originY: number;
    bobTime: number;
    /** Shooter sweep: the locked height and the edge x it charges to. */
    sweepY: number;
    sweepTargetX: number;
    /** Heavy: its post on the ring around the player, as an angle seen from the player. */
    slotAngle: number;
    /** Number of release bullets currently targeting this enemy. */
    incoming: number;
    removed: boolean;
}

export interface EnemyContext {
    player: Point;
    /** Seconds since the playing phase started. */
    elapsed: number;
    rng: Rng;
    screen: ScreenSize;
}

const EDGES: readonly SpawnEdge[] = ['top', 'left', 'right'];

/** Picks the edge to spawn from, weighted by the screen's orientation. */
export function pickSpawnEdge(rng: Rng, screen: ScreenSize): SpawnEdge {
    const weights = screen.height > screen.width ? EDGE_WEIGHTS_PORTRAIT : EDGE_WEIGHTS_LANDSCAPE;
    let roll = rng() * (weights.top + weights.left + weights.right);
    for (const edge of EDGES) {
        roll -= weights[edge];
        if (roll < 0) return edge;
    }
    return 'top';
}

function topStationY(kind: EnemyKind, rng: Rng, height: number): number {
    switch (kind) {
        case 'grunt': return height * randomRange(rng, GRUNT_MIN_Y_RATIO, GRUNT_MAX_Y_RATIO);
        case 'shooter': return height * SHOOTER_Y_RATIO;
        case 'heavy': return height * HEAVY_Y_RATIO;
        default: return height * RAMMER_Y_RATIO;
    }
}

/** Puts the enemy just off a randomly chosen edge, heading for its station. */
function placeAtEdge(e: Enemy, rng: Rng, screen: ScreenSize): void {
    const edge = pickSpawnEdge(rng, screen);
    e.entry = edge;
    if (edge === 'top') {
        e.x = randomRange(rng, EDGE_MARGIN, screen.width - EDGE_MARGIN);
        e.y = -e.radius;
        e.stationX = e.x;
        e.stationY = topStationY(e.kind, rng, screen.height);
    } else {
        e.y = screen.height * randomRange(rng, SIDE_Y_MIN_RATIO, SIDE_Y_MAX_RATIO);
        e.stationY = e.y;
        const inset = screen.width * randomRange(rng, SIDE_STATION_MIN_RATIO, SIDE_STATION_MAX_RATIO);
        e.x = edge === 'left' ? -e.radius : screen.width + e.radius;
        e.stationX = edge === 'left' ? inset : screen.width - inset;
    }
    setState(e, 'enter');
}

export function createEnemy(kind: EnemyKind, id: number, rng: Rng, screen: ScreenSize): Enemy {
    const spec = ENEMY_SPECS[kind];
    const e: Enemy = {
        id, kind, x: 0, y: 0, hp: spec.hp, radius: spec.radius,
        state: 'enter', stateTime: 0, entry: 'top', stationX: 0, stationY: 0,
        swayCenter: 0, swayDir: 1, fireTimer: 0, actionTimer: 0,
        heading: 0, homingLeft: 0, originX: 0, originY: 0,
        bobTime: 0, sweepY: 0, sweepTargetX: 0, slotAngle: 0, incoming: 0, removed: false
    };
    placeAtEdge(e, rng, screen);
    return e;
}

function setState(e: Enemy, state: EnemyState): void {
    e.state = state;
    e.stateTime = 0;
}

/** Moves `from` toward `to` by at most `step`; returns the new value. */
function approach(from: number, to: number, step: number): number {
    if (Math.abs(to - from) <= step) return to;
    return from + Math.sign(to - from) * step;
}

function enter(e: Enemy, dt: number, rng: Rng): void {
    const step = ENTER_SPEED * dt;
    if (e.entry === 'top') e.y = approach(e.y, e.stationY, step);
    else e.x = approach(e.x, e.stationX, step);
    if (e.x === e.stationX && e.y === e.stationY) arrive(e, rng);
}

function arrive(e: Enemy, rng: Rng): void {
    e.swayCenter = e.x;
    e.fireTimer = ENEMY_SPECS[e.kind].fireInterval / 2;
    switch (e.kind) {
        case 'grunt':
            e.actionTimer = randomRange(rng, GRUNT_DIVE_MIN_INTERVAL, GRUNT_DIVE_MAX_INTERVAL);
            setState(e, 'sway');
            break;
        case 'shooter':
            e.actionTimer = SHOOTER_SWEEP_INTERVAL;
            e.bobTime = 0;
            setState(e, 'sway');
            break;
        case 'heavy':
            setState(e, 'chase');
            break;
        default:
            setState(e, 'warn');
    }
}

/** Moves back and forth within ±SWAY_RANGE of swayCenter, bouncing at the edge margins. */
export function sway(e: Enemy, dt: number, screenWidth: number): void {
    const lo = Math.max(e.swayCenter - SWAY_RANGE, EDGE_MARGIN);
    const hi = Math.min(e.swayCenter + SWAY_RANGE, screenWidth - EDGE_MARGIN);
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
            sway(e, dt, ctx.screen.width);
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
            if (isFullyOffScreen(e, e.radius, ctx.screen)) placeAtEdge(e, ctx.rng, ctx.screen);
            break;
        }
    }
}

function updateShooter(e: Enemy, dt: number, ctx: EnemyContext): void {
    const { screen } = ctx;
    switch (e.state) {
        case 'sway':
            sway(e, dt, screen.width);
            e.bobTime += dt;
            e.y = e.stationY + SHOOTER_BOB_AMPLITUDE * Math.sin((Math.PI * 2 * e.bobTime) / SHOOTER_BOB_PERIOD);
            e.actionTimer -= dt;
            if (e.actionTimer <= 0) setState(e, 'sweep-warn');
            break;
        case 'sweep-warn':
            if (e.stateTime >= SHOOTER_SWEEP_WARN) {
                e.sweepY = ctx.player.y;
                e.sweepTargetX = e.x < screen.width / 2 ? screen.width - EDGE_MARGIN : EDGE_MARGIN;
                setState(e, 'sweep-align');
            }
            break;
        case 'sweep-align':
            e.y = approach(e.y, e.sweepY, SHOOTER_ALIGN_SPEED * dt);
            if (e.y === e.sweepY) setState(e, 'sweep');
            break;
        case 'sweep':
            e.x = approach(e.x, e.sweepTargetX, SHOOTER_SWEEP_SPEED * dt);
            if (e.x === e.sweepTargetX) setState(e, 'sweep-return');
            break;
        case 'sweep-return':
            e.y = approach(e.y, e.stationY, SHOOTER_RETURN_SPEED * dt);
            if (e.y === e.stationY) {
                e.swayCenter = e.x;
                e.bobTime = 0;
                e.actionTimer = SHOOTER_SWEEP_INTERVAL;
                setState(e, 'sway');
            }
            break;
    }
}

export type HeavyPhase = 'surround' | 'warn' | 'charge';

/** Where the shared heavy clock is: surrounding, flashing before a charge, or charging. */
export function heavyPhase(elapsed: number): HeavyPhase {
    const t = elapsed % HEAVY_CYCLE;
    if (t >= HEAVY_CHARGE_AT) return 'charge';
    if (t >= HEAVY_WARN_AT) return 'warn';
    return 'surround';
}

/**
 * Spreads the chasing heavies evenly around the player: the i-th oldest gets the angle
 * φ + 2πi/n, where φ points from the player to the oldest one. Enemies are kept in spawn
 * order, so array order is age order.
 */
export function assignHeavySlots(enemies: readonly Enemy[], player: Point): void {
    let n = 0;
    let oldest: Enemy | null = null;
    for (const e of enemies) {
        if (e.kind !== 'heavy' || e.state !== 'chase' || e.removed) continue;
        if (!oldest) oldest = e;
        n++;
    }
    if (!oldest) return;
    const phi = angleTo(player, oldest);
    let i = 0;
    for (const e of enemies) {
        if (e.kind !== 'heavy' || e.state !== 'chase' || e.removed) continue;
        e.slotAngle = phi + (Math.PI * 2 * i) / n;
        i++;
    }
}

/** Moves toward (tx, ty) by at most `step`, stopping on it. */
function moveToward(e: Enemy, tx: number, ty: number, step: number): void {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= step) {
        e.x = tx;
        e.y = ty;
    } else {
        e.x += (dx / dist) * step;
        e.y += (dy / dist) * step;
    }
}

function updateHeavy(e: Enemy, dt: number, ctx: EnemyContext): void {
    const late = ctx.elapsed >= HEAVY_LATE_FROM;
    const p = ctx.player;
    if (heavyPhase(ctx.elapsed) === 'charge') {
        moveToward(e, p.x, p.y, (late ? HEAVY_CHARGE_SPEED_LATE : HEAVY_CHARGE_SPEED) * dt);
        return;
    }
    const tx = p.x + Math.cos(e.slotAngle) * HEAVY_RING_RADIUS;
    const ty = p.y + Math.sin(e.slotAngle) * HEAVY_RING_RADIUS;
    moveToward(e, tx, ty, (late ? HEAVY_SURROUND_SPEED_LATE : HEAVY_SURROUND_SPEED) * dt);
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
    if (isFullyOffScreen(e, e.radius, ctx.screen)) e.removed = true;
}

function canFire(e: Enemy, screen: ScreenSize): boolean {
    if (ENEMY_SPECS[e.kind].fireInterval <= 0 || !isOnScreen(e, screen)) return false;
    switch (e.kind) {
        case 'grunt': return e.state === 'sway';
        case 'heavy': return e.state === 'chase';
        default: return e.state !== 'enter';
    }
}

/** Advances one enemy by dt seconds. Returns true when it fires a volley this frame. */
export function updateEnemy(e: Enemy, dt: number, ctx: EnemyContext): boolean {
    e.stateTime += dt;
    if (e.state === 'enter') {
        enter(e, dt, ctx.rng);
        return false;
    }
    switch (e.kind) {
        case 'grunt': updateGrunt(e, dt, ctx); break;
        case 'shooter': updateShooter(e, dt, ctx); break;
        case 'heavy': updateHeavy(e, dt, ctx); break;
        default: updateRammer(e, dt, ctx);
    }
    if (e.removed || !canFire(e, ctx.screen)) return false;
    e.fireTimer -= dt;
    if (e.fireTimer > 0) return false;
    e.fireTimer += ENEMY_SPECS[e.kind].fireInterval;
    return true;
}
