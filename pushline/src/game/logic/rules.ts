// The rules of one run: state, moves, line clears, undo and the outcome of a tap.
import { PARAMS } from '../params';
import { topUpFixed } from './fixed';
import { colFull, DIR_LIST, DIRS, emptyGrid, inBounds, rowFull } from './grid';
import { findPath } from './path';
import { generateBlocks } from './spawn';
import {
    EMPTY, FIXED, MOVABLE,
    type Deps, type Dir, type LineRef, type MoveResult, type Snapshot, type State, type TapOutcome,
} from './types';

/** Initial board: character at the bottom centre, fixed blocks topped up, one generation. */
export function createState(deps: Deps): State {
    const state: State = {
        grid: emptyGrid(),
        px: PARAMS.playerStartX,
        py: PARAMS.playerStartY,
        moves: PARAMS.startMoves,
        score: 0,
        over: false,
        history: [],
    };
    topUpFixed(state, deps.rng);
    generateBlocks(state, deps.rng, [], deps.now);
    return state;
}

const snapshot = (state: State): Snapshot => ({
    grid: state.grid.map((row) => row.slice()),
    px: state.px,
    py: state.py,
    moves: state.moves,
});

/** Moves one cell (pushing a movable block when it is in the way). Blocked moves change nothing. */
export function move(state: State, dir: Dir, deps: Deps): MoveResult {
    const res: MoveResult = {
        moved: false, pushed: false, clearedRows: [], clearedCols: [], cleared: [], pruned: [], spawned: [], recovered: 0,
    };
    if (state.over) return res;
    const { grid } = state;
    const d = DIRS[dir];
    const nx = state.px + d.x;
    const ny = state.py + d.y;
    if (!inBounds(grid, nx, ny) || grid[ny][nx] === FIXED) return res;

    const pushing = grid[ny][nx] === MOVABLE;
    const bx = nx + d.x;
    const by = ny + d.y;
    if (pushing && (!inBounds(grid, bx, by) || grid[by][bx] !== EMPTY)) return res;

    const before = snapshot(state);
    let dest: { x: number; y: number } | null = null;
    if (pushing) {
        grid[by][bx] = MOVABLE;
        grid[ny][nx] = EMPTY;
        dest = { x: bx, y: by };
        res.pushed = true;
    }
    state.px = nx;
    state.py = ny;
    state.moves -= 1;
    res.moved = true;

    if (dest && (rowFull(grid, dest.y) || colFull(grid, dest.x))) {
        clearLines(state, dest, res, deps);
    } else {
        state.history.push(before);
        if (state.history.length > (deps.maxUndo ?? PARAMS.maxUndo)) state.history.shift();
    }
    if (state.moves <= 0) state.over = true;
    return res;
}

/** Clears the completed row/column through `dest`, then refills: fixed top-up, then new movable blocks. */
function clearLines(state: State, dest: { x: number; y: number }, res: MoveResult, deps: Deps): void {
    const { grid } = state;
    if (rowFull(grid, dest.y)) res.clearedRows.push(dest.y);
    if (colFull(grid, dest.x)) res.clearedCols.push(dest.x);
    const wipe = (x: number, y: number) => {
        if (grid[y][x] !== EMPTY) res.cleared.push({ x, y, kind: grid[y][x] });
        grid[y][x] = EMPTY;
    };
    res.clearedRows.forEach((y) => grid[y].forEach((_, x) => wipe(x, y)));
    res.clearedCols.forEach((x) => grid.forEach((_, y) => wipe(x, y)));

    const lines = res.clearedRows.length + res.clearedCols.length;
    state.score += lines;
    const movesBefore = state.moves;
    state.moves = Math.min(PARAMS.maxMoves, state.moves + PARAMS.movesPerLine * lines);
    res.recovered = state.moves - movesBefore;
    state.history = [];

    const avoid: LineRef[] = [
        ...res.clearedRows.map((index) => ({ horizontal: true, index })),
        ...res.clearedCols.map((index) => ({ horizontal: false, index })),
    ];
    res.spawned.push(...topUpFixed(state, deps.rng));
    const spawn = generateBlocks(state, deps.rng, avoid, deps.now);
    res.spawned.push(...spawn.added);
    res.pruned.push(...spawn.removed);
}

/** Whether Undo can do anything: there is a step to go back and the run is not over. */
export const canUndo = (state: State): boolean => !state.over && state.history.length > 0;

/** Goes back one move. Returns false when there is nothing to undo (or the run is over). */
export function undo(state: State): boolean {
    if (!canUndo(state)) return false;
    const snap = state.history.pop();
    if (!snap) return false;
    state.grid = snap.grid;
    state.px = snap.px;
    state.py = snap.py;
    state.moves = snap.moves;
    return true;
}

/** What a tap on board cell (x, y) does (the cell is known to be on the board). */
export function tapOutcome(state: State, x: number, y: number): TapOutcome {
    if (x === state.px && y === state.py) return { kind: 'none' };
    const cell = state.grid[y][x];
    if (cell === EMPTY) {
        const path = findPath(state.grid, state.px, state.py, x, y);
        return path ? { kind: 'walk', path } : { kind: 'fail' };
    }
    if (cell === MOVABLE) {
        const dir = DIR_LIST.find((d) => state.px + DIRS[d].x === x && state.py + DIRS[d].y === y);
        if (dir) {
            const bx = x + DIRS[dir].x;
            const by = y + DIRS[dir].y;
            if (inBounds(state.grid, bx, by) && state.grid[by][bx] === EMPTY) return { kind: 'push', dir };
        }
    }
    return { kind: 'fail' };
}
