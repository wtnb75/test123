import {
    CELL,
    COINS_START,
    DT_MAX,
    ENEMY_SPEED,
    KILL_REWARD,
    LIVES_START,
    SELL_RATE,
    SHOT_FLASH,
    SPAWN_INTERVAL,
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
    hasPath,
    isGoal,
    isStart,
    setCell
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
}

export interface Turret {
    x: number;
    y: number;
    /**
     * Seconds of charge; a shot spends TURRET_INTERVAL and keeps the overshoot.
     * Can dip below 0 by at most TIME_EPS right after a shot because of the firing tolerance.
     */
    charge: number;
    /** Remaining seconds to draw the last shot's line. */
    flash: number;
    targetX: number;
    targetY: number;
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
    spawnClock: number;
    spawned: number;
    nextEnemyId: number;
    events: FrameEvents;
}

export type TapResult = 'placed' | 'sold' | 'failed' | 'ignored';

const COST: Readonly<Record<Exclude<CellKind, 'empty'>, number>> = {
    wall: WALL_COST,
    turret: TURRET_COST
};

export function createGame(): GameState {
    const state: GameState = {
        phase: 'build',
        wave: 1,
        lives: LIVES_START,
        coins: COINS_START,
        kills: 0,
        tool: 'wall',
        message: null,
        board: createBoard(),
        path: [],
        pathX: [],
        pathY: [],
        enemies: [],
        turrets: [],
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

export const MSG_BUILD_HINT = 'マスをタップして壁や砲台を置こう（置いたら開始）';

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
    if (getCell(board, col, row) !== 'empty') return 'ignored';
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
    return true;
}

function buildTurrets(board: Board): Turret[] {
    const turrets: Turret[] = [];
    // Row-major order is also the order turrets act in each frame.
    for (let row = 0; row < board.rows; row++) {
        for (let col = 0; col < board.cols; col++) {
            if (getCell(board, col, row) !== 'turret') continue;
            const x = cellCenterX(col);
            const y = cellCenterY(row);
            turrets.push({ x, y, charge: TURRET_INTERVAL, flash: 0, targetX: x, targetY: y });
        }
    }
    return turrets;
}

function pathLength(state: GameState): number {
    return (state.path.length - 1) * CELL;
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
        state.enemies.push({
            id: state.nextEnemyId++,
            hp,
            maxHp: hp,
            traveled: 0,
            x: state.pathX[0],
            y: state.pathY[0]
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
            e.traveled += ENEMY_SPEED * dt;
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

function fireTurrets(state: GameState, dt: number): void {
    const range2 = TURRET_RANGE * TURRET_RANGE;
    ageShotLines(state, dt);
    for (const t of state.turrets) {
        t.charge += dt;
        if (t.charge + TIME_EPS < TURRET_INTERVAL) continue;
        let target: Enemy | null = null;
        for (const e of state.enemies) {
            if (e.hp <= 0) continue;
            const dx = e.x - t.x;
            const dy = e.y - t.y;
            if (dx * dx + dy * dy > range2) continue;
            // Furthest along the path wins; enemies are stored in spawn order, so ties keep the older one.
            if (target === null || e.traveled > target.traveled) target = e;
        }
        if (target === null) {
            // Idle turrets hold at most one shot's worth of charge.
            t.charge = Math.min(t.charge, TURRET_INTERVAL);
            continue;
        }
        target.hp -= TURRET_DAMAGE;
        // Carry the overshoot so the average rate doesn't depend on frame timing.
        t.charge -= TURRET_INTERVAL;
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
    // Turret records are rebuilt from the board at the next wave start; drop them so sold turrets can't linger.
    state.turrets.length = 0;
}
