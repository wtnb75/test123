import { ENEMY_RADIUS, ENEMY_SPEED, GAME_HEIGHT, GAME_WIDTH } from './constants';
import { getDifficultyParams, type BulletType, type DifficultyParams } from './difficulty';
import { advanceFormationTimer, calcRowFormation, calcVFormation, pickFormationType } from './formation';
import { angleTo, angleToVec, calcNWayAngles } from './physics';
import {
    advanceStopper, isRushGone, isStopperGone, rushVelocity,
    soloKindOf, soloSpawnDue, soloSpawnX, type SoloKind, type StopPhase
} from './soloEnemy';

// Enemies and enemy bullets, without any drawing: the Scene creates, moves and destroys its game
// objects by id from what a step reports. Randomness is injected, and the order and count of its
// calls are the same as when this lived in the Scene (docs/spec.md, 技術要件).

export type EnemyKind = 'formation' | SoloKind;

export type EnemyState = {
    id: number;
    kind: EnemyKind;
    x: number;
    y: number;
    vx: number;
    vy: number;
    phase: StopPhase;     // used by stoppers only; every other enemy stays in 'descend'
    holdLeft: number;     // seconds left of the stop (stoppers only)
    fireTimer: number;
    bulletType: BulletType;
};

export type BulletState = {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: BulletType;
};

/**
 * What one step changed: the Scene turns it into game objects. Reused between steps (cleared at the start
 * of the next one). Removals by an explosion are not reported here: removeEnemiesAt / removeBulletsAt return their ids.
 */
export type FieldEvents = {
    spawnedEnemies: EnemyState[];
    spawnedBullets: BulletState[];
    removedEnemyIds: number[];
    removedBulletIds: number[];
};

export type FieldState = {
    enemies: EnemyState[];
    bullets: BulletState[];
    nextId: number;
    /** Starts past any interval, so the first formation spawns on the first step. */
    formationTimer: number;
    soloSpawnedCount: number;
    events: FieldEvents;
};

export type StepInput = {
    dt: number;
    elapsedSec: number;
    /** The player's position after this frame's movement. */
    playerX: number;
    playerY: number;
    rand: () => number;
};

/**
 * Called right after each enemy has moved (and fired). Return true to stop the step there:
 * the enemies after it do not move or fire, and bullets do not move or get removed.
 */
export type EnemyMovedHook = (enemy: Readonly<EnemyState>) => boolean;

export type StepResult = { aborted: boolean; events: FieldEvents };

const FORMATION_SPACING = 52;
const FORMATION_START_Y = -20;
const FORMATION_CENTER_MARGIN = 80;
const FORMATION_GONE_MARGIN = 40;
const BULLET_GONE_MARGIN = 20;
const NWAY_TOTAL_ANGLE = Math.PI / 5;
const SPREAD_COUNT = 8;
const FAST_SPEED_MULTIPLIER = 2;
const FIRST_FIRE_BASE_SEC = 0.5;
const FIRST_FIRE_RANGE_SEC = 0.5;
const FIRE_JITTER_SEC = 0.3;
const STOP_FIRST_FIRE_RANGE_SEC = 0.3;

export function createFieldState(): FieldState {
    return {
        enemies: [],
        bullets: [],
        nextId: 0,
        formationTimer: Infinity,
        soloSpawnedCount: 0,
        events: { spawnedEnemies: [], spawnedBullets: [], removedEnemyIds: [], removedBulletIds: [] }
    };
}

function clearEvents(events: FieldEvents): void {
    events.spawnedEnemies.length = 0;
    events.spawnedBullets.length = 0;
    events.removedEnemyIds.length = 0;
    events.removedBulletIds.length = 0;
}

/** Same as Phaser.Math.Between(min, max) for integers: floor(r * (max - min + 1) + min). */
function betweenInt(r: number, min: number, max: number): number {
    return Math.floor(r * (max - min + 1) + min);
}

function addEnemy(state: FieldState, enemy: Omit<EnemyState, 'id'>): void {
    const added: EnemyState = { id: state.nextId, ...enemy };
    state.nextId += 1;
    state.enemies.push(added);
    state.events.spawnedEnemies.push(added);
}

function addBullet(state: FieldState, x: number, y: number, vx: number, vy: number, type: BulletType): void {
    const added: BulletState = { id: state.nextId, x, y, vx, vy, type };
    state.nextId += 1;
    state.bullets.push(added);
    state.events.spawnedBullets.push(added);
}

/** Spawns a formation: random calls are the shape, then the center x, then one first-fire time per ship. */
function spawnFormation(state: FieldState, params: DifficultyParams, rand: () => number): void {
    const useV = pickFormationType(params.formationShapes, rand()) === 'v';
    const centerX = betweenInt(rand(), FORMATION_CENTER_MARGIN, GAME_WIDTH - FORMATION_CENTER_MARGIN);
    const positions = useV
        ? calcVFormation(params.formationSize, centerX, FORMATION_START_Y, FORMATION_SPACING)
        : calcRowFormation(params.formationSize, centerX, FORMATION_START_Y, FORMATION_SPACING);
    const bulletType: BulletType = useV ? 'aimed' : 'straight';
    for (const pos of positions) {
        addEnemy(state, {
            kind: 'formation',
            x: pos.x,
            y: pos.y,
            vx: 0,
            vy: ENEMY_SPEED,
            phase: 'descend',
            holdLeft: 0,
            fireTimer: FIRST_FIRE_BASE_SEC + rand() * FIRST_FIRE_RANGE_SEC,
            bulletType
        });
    }
}

/** Spawns a solo enemy above the top edge; the x takes one random call. */
function spawnSolo(state: FieldState, kind: SoloKind, input: StepInput): void {
    const x = soloSpawnX(input.rand());
    const y = -ENEMY_RADIUS;
    const v = kind === 'rush' ? rushVelocity(x, y, input.playerX, input.playerY) : { vx: 0, vy: 0 };
    addEnemy(state, { kind, x, y, vx: v.vx, vy: v.vy, phase: 'descend', holdLeft: 0, fireTimer: 0, bulletType: 'straight' });
}

/** The velocity of each bullet one shot of this kind makes (all start at the shooter). No random calls. */
export function shotVelocities(
    type: BulletType, x: number, y: number, playerX: number, playerY: number, speed: number
): { vx: number; vy: number }[] {
    if (type === 'straight') return [{ vx: 0, vy: speed }];
    if (type === 'fast') return [{ vx: 0, vy: speed * FAST_SPEED_MULTIPLIER }];
    if (type === 'aimed') {
        const v = angleToVec(angleTo(x, y, playerX, playerY));
        return [{ vx: v.x * speed, vy: v.y * speed }];
    }
    const angles = type === 'spread8'
        ? Array.from({ length: SPREAD_COUNT }, (_, i) => (i / SPREAD_COUNT) * Math.PI * 2)
        : calcNWayAngles(angleTo(x, y, playerX, playerY), type === 'nway3' ? 3 : 5, NWAY_TOTAL_ANGLE);
    return angles.map((a) => {
        const v = angleToVec(a);
        return { vx: v.x * speed, vy: v.y * speed };
    });
}

/** Counts the fire timer down; once it runs out, picks the next interval, then the bullet type, and shoots. */
function updateEnemyFire(state: FieldState, enemy: EnemyState, params: DifficultyParams, input: StepInput): void {
    enemy.fireTimer -= input.dt;
    if (enemy.fireTimer > 0) return;
    enemy.fireTimer = params.fireIntervalSec + input.rand() * FIRE_JITTER_SEC;
    const types = params.bulletTypes;
    enemy.bulletType = types[Math.floor(input.rand() * types.length)];
    for (const v of shotVelocities(enemy.bulletType, enemy.x, enemy.y, input.playerX, input.playerY, params.bulletSpeed)) {
        addBullet(state, enemy.x, enemy.y, v.vx, v.vy, enemy.bulletType);
    }
}

function isEnemyGone(enemy: EnemyState): boolean {
    if (enemy.kind === 'rush') return isRushGone(enemy.x, enemy.y);
    if (enemy.kind === 'stop') return isStopperGone(enemy);
    return enemy.y > GAME_HEIGHT + FORMATION_GONE_MARGIN;
}

function isBulletGone(b: BulletState): boolean {
    return b.x < -BULLET_GONE_MARGIN || b.x > GAME_WIDTH + BULLET_GONE_MARGIN
        || b.y < -BULLET_GONE_MARGIN || b.y > GAME_HEIGHT + BULLET_GONE_MARGIN;
}

/**
 * One frame of enemies and bullets, in the order: spawn a formation, spawn a solo enemy, move and fire
 * each enemy (in list order), remove the enemies that left, move the bullets, remove the bullets that left.
 * The returned events are reused: read them before the next step.
 */
export function stepField(state: FieldState, input: StepInput, onEnemyMoved?: EnemyMovedHook): StepResult {
    const { dt, elapsedSec, rand } = input;
    const events = state.events;
    clearEvents(events);
    const params = getDifficultyParams(elapsedSec);

    const formation = advanceFormationTimer(state.formationTimer, dt, params.formationIntervalSec);
    state.formationTimer = formation.timer;
    if (formation.spawn) spawnFormation(state, params, rand);

    if (soloSpawnDue(elapsedSec, state.soloSpawnedCount)) {
        spawnSolo(state, soloKindOf(state.soloSpawnedCount), input);
        state.soloSpawnedCount += 1;
    }

    for (const enemy of state.enemies) {
        if (enemy.kind === 'stop') {
            // the first shot comes 0 to 0.3 s after the stop starts; a stopper shoots only while it holds
            if (advanceStopper(enemy, dt)) enemy.fireTimer = rand() * STOP_FIRST_FIRE_RANGE_SEC;
            if (enemy.phase === 'hold') updateEnemyFire(state, enemy, params, input);
        } else {
            enemy.x += enemy.vx * dt;
            enemy.y += enemy.vy * dt;
            if (enemy.kind === 'formation') updateEnemyFire(state, enemy, params, input);
        }
        if (onEnemyMoved?.(enemy)) return { aborted: true, events };
    }
    state.enemies = state.enemies.filter((e) => {
        if (!isEnemyGone(e)) return true;
        events.removedEnemyIds.push(e.id);
        return false;
    });

    for (const b of state.bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
    }
    state.bullets = state.bullets.filter((b) => {
        if (!isBulletGone(b)) return true;
        events.removedBulletIds.push(b.id);
        return false;
    });
    return { aborted: false, events };
}

/** Removes the enemies at these indices (an explosion's victims); the others keep their order. Returns the removed ids. */
export function removeEnemiesAt(state: FieldState, indices: readonly number[]): number[] {
    const drop = new Set(indices);
    const removed: number[] = [];
    state.enemies = state.enemies.filter((e, i) => {
        if (!drop.has(i)) return true;
        removed.push(e.id);
        return false;
    });
    return removed;
}

/** Removes the bullets at these indices (an explosion's victims); the others keep their order. Returns the removed ids. */
export function removeBulletsAt(state: FieldState, indices: readonly number[]): number[] {
    const drop = new Set(indices);
    const removed: number[] = [];
    state.bullets = state.bullets.filter((b, i) => {
        if (!drop.has(i)) return true;
        removed.push(b.id);
        return false;
    });
    return removed;
}
