import {
    CELL,
    COINS_START,
    DT_MAX,
    ENEMY_SPEED,
    KILL_REWARD,
    LIVES_START,
    SELL_RATE,
    SHOT_FLASH,
    SLOW_RANGE,
    SLOW_RATE,
    SLOW_TOWER_COST,
    SPAWN_INTERVAL,
    SPLASH_DAMAGE,
    SPLASH_INTERVAL,
    SPLASH_RADIUS,
    SPLASH_RANGE,
    SPLASH_TOWER_COST,
    SWAMP_SPEED_RATE,
    TIME_EPS,
    TURRET_COST,
    TURRET_DAMAGE,
    TURRET_INTERVAL,
    TURRET_RANGE,
    WALL_COST,
    WAVE_BONUS,
    WAVE_MAX
} from './config';
import {
    type Board,
    type CellKind,
    type CellPos,
    createBoard,
    findPath,
    getCell,
    getTerrain,
    hasPath,
    isGoal,
    isStart,
    setCell,
    type Terrain
} from './board';
import { cellCenterX, cellCenterY, type Tool } from './layout';
import { enemyCount, enemyHp } from './wave';

export type Phase = 'build' | 'wave' | 'cleared' | 'gameover';

export const MSG_START_GOAL = 'S と G には置けません';
export const MSG_NO_COINS = 'コインが足りません';
export const MSG_BLOCKED = '道をふさぐことはできません';

export interface Enemy {
    id: number;
    hp: number;
    maxHp: number;
    /** Distance walked along the path in px. */
    traveled: number;
    x: number;
    y: number;
    /** Whether the enemy was inside a slow tower's range at the start of the last frame it moved in. */
    slowed?: boolean;
}

/** A turret (`splash` false) or a splash tower (`splash` true); both act in the same row-major order. */
export interface Turret {
    x: number;
    y: number;
    splash: boolean;
    /**
     * Seconds of charge; a shot spends the interval and keeps the overshoot.
     * Can dip below 0 by at most TIME_EPS right after a shot because of the firing tolerance.
     */
    charge: number;
    /** Remaining seconds to draw the last shot's line (or the splash ring). */
    flash: number;
    targetX: number;
    targetY: number;
}

/** Centre of a slow tower; its range is SLOW_RANGE. Fixed while a wave runs. */
export interface SlowTower {
    x: number;
    y: number;
}

/** What happened during the last update, for the Scene's effects. Arrays are reused between frames. */
export interface FrameEvents {
    killX: number[];
    killY: number[];
    leaks: number;
}

export interface GameState {
    phase: Phase;
    wave: number;
    lives: number;
    coins: number;
    kills: number;
    tool: Tool;
    /** Failure message shown instead of the phase text; null means the normal text. */
    message: string | null;
    board: Board;
    /** Current shortest path: a live preview during build, fixed during a wave. */
    path: CellPos[];
    pathX: number[];
    pathY: number[];
    enemies: Enemy[];
    turrets: Turret[];
    slows: SlowTower[];
    spawnClock: number;
    spawned: number;
    nextEnemyId: number;
    events: FrameEvents;
}

export type TapResult = 'placed' | 'sold' | 'failed' | 'ignored';

const COST: Readonly<Record<Exclude<CellKind, 'empty'>, number>> = {
    wall: WALL_COST,
    turret: TURRET_COST,
    slow: SLOW_TOWER_COST,
    splash: SPLASH_TOWER_COST
};

/** A new game; without `terrain` the board is all plain (the terrain-less board the unit tests use). */
export function createGame(terrain?: readonly Terrain[]): GameState {
    const state: GameState = {
        phase: 'build',
        wave: 1,
        lives: LIVES_START,
        coins: COINS_START,
        kills: 0,
        tool: 'wall',
        message: null,
        board: createBoard(undefined, undefined, terrain),
        path: [],
        pathX: [],
        pathY: [],
        enemies: [],
        turrets: [],
        slows: [],
        spawnClock: 0,
        spawned: 0,
        nextEnemyId: 0,
        events: { killX: [], killY: [], leaks: 0 }
    };
    refreshPath(state);
    return state;
}

function refreshPath(state: GameState): void {
    // Placement never allows a blocked board, so a path always exists here.
    state.path = findPath(state.board) ?? [];
    state.pathX = state.path.map((p) => cellCenterX(p.col));
    state.pathY = state.path.map((p) => cellCenterY(p.row));
}

export const MSG_BUILD_HINT = 'マスをタップして建物を置こう（置いたら開始）';

export function phaseText(state: GameState): string {
    if (state.phase !== 'build') return `ウェーブ ${state.wave}`;
    const empty = state.board.cells.every((c) => c === 'empty');
    return empty ? MSG_BUILD_HINT : `ウェーブ ${state.wave} の準備（開始を押す）`;
}

export function messageText(state: GameState): string {
    return state.message ?? phaseText(state);
}

export function selectTool(state: GameState, tool: Tool): void {
    state.tool = tool;
    state.message = null;
}

export function tapCell(state: GameState, col: number, row: number): TapResult {
    if (state.phase !== 'build') return 'ignored';
    return state.tool === 'sell' ? sellAt(state, col, row) : placeAt(state, state.tool, col, row);
}

function fail(state: GameState, message: string): TapResult {
    state.message = message;
    return 'failed';
}

function placeAt(state: GameState, kind: Exclude<CellKind, 'empty'>, col: number, row: number): TapResult {
    const { board } = state;
    if (isStart(board, col, row) || isGoal(board, col, row)) return fail(state, MSG_START_GOAL);
    if (getCell(board, col, row) !== 'empty' || getTerrain(board, col, row) === 'rock') return 'ignored';
    if (state.coins < COST[kind]) return fail(state, MSG_NO_COINS);
    setCell(board, col, row, kind);
    if (!hasPath(board)) {
        setCell(board, col, row, 'empty');
        return fail(state, MSG_BLOCKED);
    }
    state.coins -= COST[kind];
    state.message = null;
    refreshPath(state);
    return 'placed';
}

function sellAt(state: GameState, col: number, row: number): TapResult {
    const kind = getCell(state.board, col, row);
    if (kind === 'empty') return 'ignored';
    setCell(state.board, col, row, 'empty');
    state.coins += Math.floor(COST[kind] * SELL_RATE);
    state.message = null;
    refreshPath(state);
    return 'sold';
}

/** Switches to the wave phase; spawning and movement begin on the next update. */
export function startWave(state: GameState): boolean {
    if (state.phase !== 'build') return false;
    refreshPath(state);
    state.phase = 'wave';
    state.message = null;
    state.enemies.length = 0;
    state.spawnClock = 0;
    state.spawned = 0;
    state.turrets = buildTurrets(state.board);
    state.slows = buildSlowTowers(state.board);
    return true;
}

function buildTurrets(board: Board): Turret[] {
    const turrets: Turret[] = [];
    // Row-major order is also the order turrets and splash towers act in each frame.
    for (let row = 0; row < board.rows; row++) {
        for (let col = 0; col < board.cols; col++) {
            const kind = getCell(board, col, row);
            if (kind !== 'turret' && kind !== 'splash') continue;
            const x = cellCenterX(col);
            const y = cellCenterY(row);
            const splash = kind === 'splash';
            turrets.push({ x, y, splash, charge: intervalOf(splash), flash: 0, targetX: x, targetY: y });
        }
    }
    return turrets;
}

function buildSlowTowers(board: Board): SlowTower[] {
    const towers: SlowTower[] = [];
    for (let row = 0; row < board.rows; row++) {
        for (let col = 0; col < board.cols; col++) {
            if (getCell(board, col, row) === 'slow') towers.push({ x: cellCenterX(col), y: cellCenterY(row) });
        }
    }
    return towers;
}

function intervalOf(splash: boolean): number {
    return splash ? SPLASH_INTERVAL : TURRET_INTERVAL;
}

function rangeOf(splash: boolean): number {
    return splash ? SPLASH_RANGE : TURRET_RANGE;
}

function pathLength(state: GameState): number {
    return (state.path.length - 1) * CELL;
}

/**
 * How fast an enemy at `traveled` px walks, as a share of ENEMY_SPEED: it is in path cell k while traveled is in
 * [k * CELL - CELL / 2, k * CELL + CELL / 2), and slow while that cell is a swamp.
 */
export function speedFactor(state: GameState, traveled: number): number {
    const k = Math.min(state.path.length - 1, Math.floor((traveled + CELL / 2) / CELL));
    const { col, row } = state.path[k];
    return getTerrain(state.board, col, row) === 'swamp' ? SWAMP_SPEED_RATE : 1;
}

/** Whether a point lies within SLOW_RANGE (boundary included) of any slow tower. */
export function isSlowed(state: GameState, x: number, y: number): boolean {
    const range2 = SLOW_RANGE * SLOW_RANGE;
    for (const tower of state.slows) {
        const dx = x - tower.x;
        const dy = y - tower.y;
        if (dx * dx + dy * dy <= range2) return true;
    }
    return false;
}

/** Only called for enemies still short of G, so `seg + 1` is always a valid path index. */
function placeOnPath(state: GameState, enemy: Enemy): void {
    const seg = Math.floor(enemy.traveled / CELL);
    const t = (enemy.traveled - seg * CELL) / CELL;
    enemy.x = state.pathX[seg] + (state.pathX[seg + 1] - state.pathX[seg]) * t;
    enemy.y = state.pathY[seg] + (state.pathY[seg + 1] - state.pathY[seg]) * t;
}

function spawnDue(state: GameState, total: number): void {
    const hp = enemyHp(state.wave);
    while (state.spawned < total && state.spawnClock + TIME_EPS >= state.spawned * SPAWN_INTERVAL) {
        const x = state.pathX[0];
        const y = state.pathY[0];
        state.enemies.push({
            id: state.nextEnemyId++,
            hp,
            maxHp: hp,
            traveled: 0,
            x,
            y,
            slowed: isSlowed(state, x, y)
        });
        state.spawned++;
    }
}

function moveEnemies(state: GameState, dt: number, skipFrom: number): void {
    const goalAt = pathLength(state);
    const enemies = state.enemies;
    let w = 0;
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        // Enemies spawned this frame stay on the start cell.
        if (i < skipFrom) {
            // x and y still hold the position at the start of this frame: a slow tower looks at that one.
            e.slowed = isSlowed(state, e.x, e.y);
            e.traveled += ENEMY_SPEED * speedFactor(state, e.traveled) * (e.slowed ? SLOW_RATE : 1) * dt;
            if (e.traveled >= goalAt) {
                state.lives = Math.max(0, state.lives - 1);
                state.events.leaks++;
                continue;
            }
            placeOnPath(state, e);
        }
        enemies[w++] = e;
    }
    enemies.length = w;
}

/** The living enemy in range that is furthest along the path; ties keep the older one. */
function pickTarget(state: GameState, t: Turret, range2: number): Enemy | null {
    let target: Enemy | null = null;
    for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - t.x;
        const dy = e.y - t.y;
        if (dx * dx + dy * dy > range2) continue;
        // Enemies are stored in spawn order, so a strict comparison keeps the older one on ties.
        if (target === null || e.traveled > target.traveled) target = e;
    }
    return target;
}

/** Damages every living enemy within SPLASH_RADIUS of the impact point, the target included. */
function splashAt(state: GameState, x: number, y: number): void {
    const radius2 = SPLASH_RADIUS * SPLASH_RADIUS;
    for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - x;
        const dy = e.y - y;
        if (dx * dx + dy * dy <= radius2) e.hp -= SPLASH_DAMAGE;
    }
}

function fireTurrets(state: GameState, dt: number): void {
    ageShotLines(state, dt);
    for (const t of state.turrets) {
        const interval = intervalOf(t.splash);
        t.charge += dt;
        if (t.charge + TIME_EPS < interval) continue;
        const target = pickTarget(state, t, rangeOf(t.splash) * rangeOf(t.splash));
        if (target === null) {
            // Idle turrets hold at most one shot's worth of charge.
            t.charge = Math.min(t.charge, interval);
            continue;
        }
        if (t.splash) splashAt(state, target.x, target.y);
        else target.hp -= TURRET_DAMAGE;
        // Carry the overshoot so the average rate doesn't depend on frame timing.
        t.charge -= interval;
        t.flash = SHOT_FLASH;
        t.targetX = target.x;
        t.targetY = target.y;
    }
}

function removeDead(state: GameState): void {
    const enemies = state.enemies;
    let w = 0;
    for (const e of enemies) {
        if (e.hp <= 0) {
            state.kills++;
            state.events.killX.push(e.x);
            state.events.killY.push(e.y);
            state.coins += KILL_REWARD;
            continue;
        }
        enemies[w++] = e;
    }
    enemies.length = w;
}

/** Ages the shot lines only; used each wave frame and while the Scene fades out after the game has ended. */
export function ageShotLines(state: GameState, dt: number): void {
    for (const t of state.turrets) t.flash = Math.max(0, t.flash - dt);
}

/** Advances one frame of the wave phase in the order the spec prescribes. */
export function update(state: GameState, rawDt: number): Phase {
    // Events describe only this frame, even when nothing runs.
    state.events.killX.length = 0;
    state.events.killY.length = 0;
    state.events.leaks = 0;
    if (state.phase !== 'wave') return state.phase;
    const dt = Math.min(rawDt, DT_MAX);
    const total = enemyCount(state.wave);
    state.spawnClock += dt;
    const before = state.enemies.length;
    spawnDue(state, total);
    moveEnemies(state, dt, before);
    fireTurrets(state, dt);
    removeDead(state);

    if (state.lives <= 0) {
        state.phase = 'gameover';
    } else if (state.spawned >= total && state.enemies.length === 0) {
        endWave(state);
    }
    return state.phase;
}

function endWave(state: GameState): void {
    if (state.wave >= WAVE_MAX) {
        state.phase = 'cleared';
        return;
    }
    state.coins += WAVE_BONUS;
    state.wave++;
    state.phase = 'build';
    state.message = null;
    // Turret and slow tower records are rebuilt from the board at the next wave start; drop them so sold ones can't linger.
    state.turrets.length = 0;
    state.slows.length = 0;
}
