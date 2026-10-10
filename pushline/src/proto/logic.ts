// Pure game rules of the prototype (no Phaser imports) so they can be ported later.
import { P } from './params';

/** 0 = empty, 1 = movable block, 2 = fixed block. The player is not stored in the grid. */
export type Cell = 0 | 1 | 2;
export type Dir = 'up' | 'down' | 'left' | 'right';
export type Rng = () => number;
export interface Pt { x: number; y: number }
export interface KindPt extends Pt { kind: Cell }

export interface State {
    grid: Cell[][];
    px: number;
    py: number;
    moves: number;
    score: number;
    over: boolean;
}

export interface MoveResult {
    moved: boolean;
    pushed: boolean;
    clearedRows: number[];
    clearedCols: number[];
    /** Cells that vanished with the cleared lines (movable and fixed). */
    cleared: KindPt[];
    /** Leftover movable blocks thinned out at spawn time (not part of the cleared line). */
    pruned: KindPt[];
    /** Cells that newly appeared after a clear. */
    spawned: KindPt[];
}

export const DIRS: Record<Dir, Pt> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
};

const inBounds = (grid: Cell[][], x: number, y: number) =>
    y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;

const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];
const cloneGrid = (grid: Cell[][]): Cell[][] => grid.map((r) => r.slice());
const key = (x: number, y: number) => `${x},${y}`;

/** BFS over empty cells from the player; returns a set of "x,y" keys. */
export function reachable(grid: Cell[][], px: number, py: number): Set<string> {
    const seen = new Set<string>([key(px, py)]);
    const queue: Pt[] = [{ x: px, y: py }];
    while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const d of Object.values(DIRS)) {
            const nx = cur.x + d.x;
            const ny = cur.y + d.y;
            if (inBounds(grid, nx, ny) && grid[ny][nx] === 0 && !seen.has(key(nx, ny))) {
                seen.add(key(nx, ny));
                queue.push({ x: nx, y: ny });
            }
        }
    }
    return seen;
}

function countCells(grid: Cell[][], kind: Cell): number {
    return grid.reduce((n, row) => n + row.filter((c) => c === kind).length, 0);
}

function fullLineExists(grid: Cell[][]): boolean {
    if (grid.some((row) => row.every((c) => c !== 0))) return true;
    return grid[0].some((_, x) => grid.every((row) => row[x] !== 0));
}

/** Fixed blocks wanted on the board for the current score. */
export const fixedTarget = (score: number) =>
    Math.min(P.maxFixed, P.initialFixed + Math.floor(score / P.fixedGrowEvery));

/** Add fixed blocks on random empty cells (never on the player) up to the target. */
export function topUpFixed(state: State, rng: Rng): KindPt[] {
    const placed: KindPt[] = [];
    while (countCells(state.grid, 2) < fixedTarget(state.score)) {
        // Keep the empty area connected so the player is never walled in,
        // and never complete a line by placement (it would sit there already full).
        const empties: Pt[] = [];
        state.grid.forEach((row, y) => row.forEach((c, x) => {
            if (c === 0 && !(x === state.px && y === state.py)) empties.push({ x, y });
        }));
        const emptyCount = empties.length + 1;
        const ok = empties.filter((p) => {
            state.grid[p.y][p.x] = 2;
            const valid = reachable(state.grid, state.px, state.py).size === emptyCount - 1
                && !fullLineExists(state.grid);
            state.grid[p.y][p.x] = 0;
            return valid;
        });
        if (ok.length === 0) break;
        const p = pick(ok, rng);
        state.grid[p.y][p.x] = 2;
        placed.push({ ...p, kind: 2 });
    }
    return placed;
}

interface Line { cells: Pt[]; horizontal: boolean; index: number }
interface Candidate { g: Cell[][]; added: KindPt[]; removed: KindPt[] }

function allLines(grid: Cell[][]): Line[] {
    const h = grid.length;
    const w = grid[0].length;
    const lines: Line[] = [];
    for (let y = 0; y < h; y++) {
        lines.push({ cells: Array.from({ length: w }, (_, x) => ({ x, y })), horizontal: true, index: y });
    }
    for (let x = 0; x < w; x++) {
        lines.push({ cells: Array.from({ length: h }, (_, y) => ({ x, y })), horizontal: false, index: x });
    }
    return lines;
}

/**
 * One attempt of reverse generation: start from the board just before the
 * clearing push and walk backwards (undo moves, sometimes undoing a push),
 * so that forward play from the resulting board is guaranteed to clear a line.
 * Existing movable blocks are never moved here; they act as obstacles/decoys.
 */
function scrambleOnce(state: State, rng: Rng, avoid: Line[], steps: number): Candidate | null {
    const { grid } = state;
    const lines = allLines(grid).filter((l) =>
        !avoid.some((a) => a.horizontal === l.horizontal && a.index === l.index)
        && !l.cells.some((p) => p.x === state.px && p.y === state.py));
    if (lines.length === 0) return null;
    const line = pick(lines, rng);
    const empties = line.cells.filter((p) => grid[p.y][p.x] === 0);
    if (empties.length === 0) return null;
    const c = pick(empties, rng);
    const s = rng() < 0.5 ? 1 : -1;
    const d: Pt = line.horizontal ? { x: 0, y: s } : { x: s, y: 0 };
    const feeder: Pt = { x: c.x - d.x, y: c.y - d.y };
    const start: Pt = { x: c.x - 2 * d.x, y: c.y - 2 * d.y };
    if (!inBounds(grid, feeder.x, feeder.y) || !inBounds(grid, start.x, start.y)) return null;
    if (grid[feeder.y][feeder.x] === 2 || grid[start.y][start.x] !== 0) return null;

    const g = cloneGrid(grid);
    // Thin out leftover movable blocks so old ones can't make shortcuts or pile up in corners.
    const leftovers: Pt[] = [];
    g.forEach((row, y) => row.forEach((cell, x) => { if (cell === 1) leftovers.push({ x, y }); }));
    while (leftovers.length > P.keepLeftover) {
        const p = leftovers.splice(Math.floor(rng() * leftovers.length), 1)[0];
        g[p.y][p.x] = 0;
    }
    const fresh = new Set<string>();
    const put = (p: Pt) => { if (g[p.y][p.x] === 0) { g[p.y][p.x] = 1; fresh.add(key(p.x, p.y)); } };

    // Decoys first, so that every later full-line check sees them.
    const reserved = new Set([...line.cells.map((p) => key(p.x, p.y)), key(feeder.x, feeder.y), key(start.x, start.y), key(state.px, state.py)]);
    for (let i = 0; i < P.decoys; i++) {
        const spots: Pt[] = [];
        g.forEach((row, y) => row.forEach((cell, x) => {
            if (cell === 0 && !reserved.has(key(x, y))) spots.push({ x, y });
        }));
        if (spots.length > 0) { const p = pick(spots, rng); put(p); reserved.add(key(p.x, p.y)); }
    }
    line.cells.forEach((p) => { if (!(p.x === c.x && p.y === c.y)) put(p); });
    put(feeder);
    if (fullLineExists(g)) return null;

    let vx = start.x;
    let vy = start.y;
    let pulls = 0;
    let done = 0;
    for (let tries = 0; tries < steps * 6 && done < steps; tries++) {
        const e = pick(Object.values(DIRS), rng);
        const bx = vx - e.x;
        const by = vy - e.y;
        if (!inBounds(g, bx, by) || g[by][bx] !== 0) continue;
        const ax = vx + e.x;
        const ay = vy + e.y;
        const canPull = inBounds(g, ax, ay) && g[ay][ax] === 1 && fresh.has(key(ax, ay))
            && !(vx === state.px && vy === state.py);
        if (canPull && rng() < P.scramblePullProb) {
            g[ay][ax] = 0;
            fresh.delete(key(ax, ay));
            g[vy][vx] = 1;
            fresh.add(key(vx, vy));
            pulls++;
        }
        vx = bx;
        vy = by;
        done++;
        if (fullLineExists(g)) return null;
    }
    if (pulls < P.scrambleMinPulls || g[state.py][state.px] !== 0) return null;
    if (!reachable(g, state.px, state.py).has(key(vx, vy))) return null;

    const added: KindPt[] = [];
    const removed: KindPt[] = [];
    g.forEach((row, y) => row.forEach((cell, x) => {
        if (cell !== 0 && grid[y][x] === 0) added.push({ x, y, kind: cell });
        if (cell === 0 && grid[y][x] !== 0) removed.push({ x, y, kind: grid[y][x] });
    }));
    return { g, added, removed };
}

/**
 * Real optimum: fewest moves from the player's position to the first clear,
 * searching up to `limit` moves. Returns null when no clear exists within the
 * limit (or the node budget ran out, which counts as "hard enough").
 */
export function minClearMoves(grid: Cell[][], px: number, py: number, limit: number): number | null {
    const h = grid.length;
    const w = grid[0].length;
    const enc = (g: Cell[][], x: number, y: number) => `${x},${y}|${g.map((r) => r.join('')).join('')}`;
    const seen = new Set<string>([enc(grid, px, py)]);
    let frontier: { g: Cell[][]; x: number; y: number }[] = [{ g: grid, x: px, y: py }];
    let nodes = 0;
    for (let depth = 1; depth <= limit; depth++) {
        const next: typeof frontier = [];
        for (const cur of frontier) {
            for (const d of Object.values(DIRS)) {
                const nx = cur.x + d.x;
                const ny = cur.y + d.y;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h || cur.g[ny][nx] === 2) continue;
                let g = cur.g;
                if (g[ny][nx] === 1) {
                    const bx = nx + d.x;
                    const by = ny + d.y;
                    if (bx < 0 || by < 0 || bx >= w || by >= h || g[by][bx] !== 0) continue;
                    g = cloneGrid(g);
                    g[by][bx] = 1;
                    g[ny][nx] = 0;
                    if (g[by].every((c) => c !== 0) || g.every((r) => r[bx] !== 0)) return depth;
                }
                const k = enc(g, nx, ny);
                if (seen.has(k)) continue;
                seen.add(k);
                if (++nodes > P.solveNodeCap) return null;
                next.push({ g, x: nx, y: ny });
            }
        }
        frontier = next;
    }
    return null;
}

/** Required optimum for the next board: ramps up with the score. */
export const targetSolve = (score: number) =>
    Math.min(P.solveMax, P.solveBase + Math.floor(score * P.solveRampPerLine));

/** Fallback: complete one line with a single perpendicular push (always valid). */
function spawnSimple(state: State, rng: Rng, avoid: Line[]): KindPt[] {
    const { grid } = state;
    const plans: Pt[][] = [];
    for (const line of allLines(grid)) {
        if (avoid.some((a) => a.horizontal === line.horizontal && a.index === line.index)) continue;
        if (line.cells.some((p) => p.x === state.px && p.y === state.py)) continue;
        for (const c of line.cells) {
            for (const s of [-1, 1]) {
                const d: Pt = line.horizontal ? { x: 0, y: s } : { x: s, y: 0 };
                const feeder = { x: c.x - d.x, y: c.y - d.y };
                const pusher = { x: c.x - 2 * d.x, y: c.y - 2 * d.y };
                if (!inBounds(grid, feeder.x, feeder.y) || !inBounds(grid, pusher.x, pusher.y)) continue;
                if (grid[c.y][c.x] !== 0 || grid[pusher.y][pusher.x] !== 0 || grid[feeder.y][feeder.x] === 2) continue;
                if (feeder.x === state.px && feeder.y === state.py) continue;
                const place = line.cells.filter((p) => !(p.x === c.x && p.y === c.y) && grid[p.y][p.x] === 0);
                if (grid[feeder.y][feeder.x] === 0) place.push(feeder);
                if (place.length === 0) continue;
                const copy = cloneGrid(grid);
                place.forEach((p) => { copy[p.y][p.x] = 1; });
                if (fullLineExists(copy)) continue;
                if (reachable(copy, state.px, state.py).has(key(pusher.x, pusher.y))) plans.push(place);
            }
        }
    }
    if (plans.length === 0) return [];
    const chosen = pick(plans, rng);
    chosen.forEach((p) => { grid[p.y][p.x] = 1; });
    return chosen.map((p) => ({ ...p, kind: 1 as Cell }));
}

/**
 * Add movable blocks so that forward play is guaranteed to be able to clear a
 * line, and (measured by search) not sooner than the score-based target.
 * When no candidate is hard enough, the hardest one found is used.
 */
export function spawnSolvable(state: State, rng: Rng, avoid: Line[] = [], removedOut: KindPt[] = []): KindPt[] {
    const target = targetSolve(state.score);
    const steps = target + P.scrambleExtraSteps;
    let best: Candidate | null = null;
    let bestMoves = -1;
    for (let i = 0; i < P.spawnAttempts; i++) {
        const cand = scrambleOnce(state, rng, avoid, steps);
        if (!cand) continue;
        const found = minClearMoves(cand.g, state.px, state.py, target - 1);
        if (found === null) { best = cand; break; }
        if (found > bestMoves) { best = cand; bestMoves = found; }
    }
    if (best) {
        best.removed.forEach((p) => { state.grid[p.y][p.x] = 0; });
        best.added.forEach((p) => { state.grid[p.y][p.x] = p.kind; });
        removedOut.push(...best.removed);
        return best.added;
    }
    return spawnSimple(state, rng, avoid);
}

export function createState(rng: Rng): State {
    const state: State = {
        grid: Array.from({ length: P.rows }, () => Array<Cell>(P.cols).fill(0)),
        px: Math.floor(P.cols / 2),
        py: P.rows - 1,
        moves: P.startMoves,
        score: 0,
        over: false,
    };
    topUpFixed(state, rng);
    spawnSolvable(state, rng);
    return state;
}

export const giveUp = (state: State) => { state.over = true; };

export function tryMove(state: State, dir: Dir, rng: Rng): MoveResult {
    const res: MoveResult = {
        moved: false, pushed: false, clearedRows: [], clearedCols: [], cleared: [], pruned: [], spawned: [],
    };
    if (state.over) return res;
    const { grid } = state;
    const d = DIRS[dir];
    const nx = state.px + d.x;
    const ny = state.py + d.y;
    if (!inBounds(grid, nx, ny) || grid[ny][nx] === 2) return res;

    let dest: Pt | null = null;
    if (grid[ny][nx] === 1) {
        const bx = nx + d.x;
        const by = ny + d.y;
        if (!inBounds(grid, bx, by) || grid[by][bx] !== 0) return res;
        grid[by][bx] = 1;
        grid[ny][nx] = 0;
        dest = { x: bx, y: by };
        res.pushed = true;
    }
    state.px = nx;
    state.py = ny;
    state.moves -= 1;
    res.moved = true;

    if (dest) {
        if (grid[dest.y].every((c) => c !== 0)) res.clearedRows.push(dest.y);
        if (grid.every((r) => r[dest.x] !== 0)) res.clearedCols.push(dest.x);
        const wipe = (x: number, y: number) => {
            if (grid[y][x] !== 0) res.cleared.push({ x, y, kind: grid[y][x] });
            grid[y][x] = 0;
        };
        res.clearedRows.forEach((y) => grid[y].forEach((_, x) => wipe(x, y)));
        res.clearedCols.forEach((x) => grid.forEach((_, y) => wipe(x, y)));
        const lines = res.clearedRows.length + res.clearedCols.length;
        if (lines > 0) {
            state.score += lines;
            state.moves = Math.min(P.maxMoves, state.moves + P.movesPerLine * lines);
            const avoid: Line[] = [
                ...res.clearedRows.map((index) => ({ cells: [], horizontal: true, index })),
                ...res.clearedCols.map((index) => ({ cells: [], horizontal: false, index })),
            ];
            res.spawned.push(...topUpFixed(state, rng));
            const removed: KindPt[] = [];
            res.spawned.push(...spawnSolvable(state, rng, avoid, removed));
            res.pruned.push(...removed);
        }
    }
    if (state.moves <= 0) state.over = true;
    return res;
}

/** Shortest walk over empty cells (no pushing) from the player to (tx, ty). */
export function findPath(grid: Cell[][], px: number, py: number, tx: number, ty: number): Dir[] | null {
    if (!inBounds(grid, tx, ty) || grid[ty][tx] !== 0) return null;
    const prev = new Map<string, { from: string; dir: Dir }>();
    const seen = new Set<string>([key(px, py)]);
    const queue: Pt[] = [{ x: px, y: py }];
    while (queue.length > 0) {
        const cur = queue.shift()!;
        if (cur.x === tx && cur.y === ty) {
            const path: Dir[] = [];
            let k = key(tx, ty);
            while (prev.has(k)) {
                const p = prev.get(k)!;
                path.unshift(p.dir);
                k = p.from;
            }
            return path;
        }
        for (const [dir, d] of Object.entries(DIRS) as [Dir, Pt][]) {
            const nx = cur.x + d.x;
            const ny = cur.y + d.y;
            if (!inBounds(grid, nx, ny) || grid[ny][nx] !== 0 || seen.has(key(nx, ny))) continue;
            seen.add(key(nx, ny));
            prev.set(key(nx, ny), { from: key(cur.x, cur.y), dir });
            queue.push({ x: nx, y: ny });
        }
    }
    return null;
}
