// Board generation ("盤面の生成", docs/spec.md): add movable blocks so that a line can always be cleared
// by walking and pushing, and the optimum is not shorter than the score-based target.
import { PARAMS } from '../params';
import { cloneGrid, DIR_LIST, DIRS, fullLineExists, inBounds, key, pick, reachableFrom } from './grid';
import { minClearMoves, targetSolve } from './solve';
import { EMPTY, FIXED, MOVABLE, type Grid, type KindPt, type LineRef, type Pt, type Rng, type State } from './types';

export interface SpawnResult {
    /** Cells that hold a block afterwards and were empty before. */
    added: KindPt[];
    /** Movable blocks that were on the board and are gone afterwards (thinned out). */
    removed: KindPt[];
}

export interface Line extends LineRef {
    cells: Pt[];
}

const allLines = (grid: Grid): Line[] => {
    const h = grid.length;
    const w = grid[0].length;
    const lines: Line[] = [];
    for (let y = 0; y < h; y++) {
        lines.push({ horizontal: true, index: y, cells: Array.from({ length: w }, (_, x) => ({ x, y })) });
    }
    for (let x = 0; x < w; x++) {
        lines.push({ horizontal: false, index: x, cells: Array.from({ length: h }, (_, y) => ({ x, y })) });
    }
    return lines;
};

/** Lines that may be chosen as the target: not just cleared, not through the player. */
export const eligibleLines = (state: State, avoid: LineRef[]): Line[] =>
    allLines(state.grid).filter((l) =>
        !avoid.some((a) => a.horizontal === l.horizontal && a.index === l.index)
        && !l.cells.some((p) => p.x === state.px && p.y === state.py));

/** Step 1: remove random movable blocks until only `keepLeftover` remain; returns what was removed. */
function thin(grid: Grid, rng: Rng): KindPt[] {
    const movables: Pt[] = [];
    grid.forEach((row, y) => row.forEach((cell, x) => { if (cell === MOVABLE) movables.push({ x, y }); }));
    const removed: KindPt[] = [];
    while (movables.length > PARAMS.keepLeftover) {
        const [p] = movables.splice(Math.floor(rng() * movables.length), 1);
        grid[p.y][p.x] = EMPTY;
        removed.push({ ...p, kind: MOVABLE });
    }
    return removed;
}

/** A finished candidate board together with the leftovers thinned out to make it. */
interface Candidate {
    grid: Grid;
    removed: KindPt[];
}

/** The geometry of one attempt: target line, the missing cell `c`, the feeder and the pusher start. */
interface Plan {
    line: Line;
    c: Pt;
    feeder: Pt;
    start: Pt;
}

/** Steps 2-3 on a (thinned) grid; null when this choice is unusable. */
function makePlan(grid: Grid, line: Line, c: Pt, s: 1 | -1): Plan | null {
    const d: Pt = line.horizontal ? { x: 0, y: s } : { x: s, y: 0 };
    const feeder = { x: c.x - d.x, y: c.y - d.y };
    const start = { x: c.x - 2 * d.x, y: c.y - 2 * d.y };
    if (!inBounds(grid, feeder.x, feeder.y) || !inBounds(grid, start.x, start.y)) return null;
    if (grid[feeder.y][feeder.x] === FIXED || grid[start.y][start.x] !== EMPTY) return null;
    return { line, c, feeder, start };
}

/** Steps 1-7 of one attempt. Returns the resulting candidate, or null when the attempt is discarded. */
function attempt(state: State, rng: Rng, avoid: LineRef[], steps: number): Candidate | null {
    const g = cloneGrid(state.grid);
    const removed = thin(g, rng);

    const lines = eligibleLines(state, avoid);
    if (lines.length === 0) return null;
    const line = pick(lines, rng);
    const empties = line.cells.filter((p) => g[p.y][p.x] === EMPTY);
    if (empties.length === 0) return null;
    const plan = makePlan(g, line, pick(empties, rng), rng() < 0.5 ? 1 : -1);
    if (!plan) return null;
    const { c, feeder, start } = plan;

    // Blocks placed in this attempt are the only ones the reverse walk may pull.
    const fresh = new Set<string>();
    const put = (p: Pt) => {
        if (g[p.y][p.x] === EMPTY) {
            g[p.y][p.x] = MOVABLE;
            fresh.add(key(p.x, p.y));
        }
    };

    const reserved = new Set<string>([
        ...line.cells.map((p) => key(p.x, p.y)), key(feeder.x, feeder.y), key(start.x, start.y), key(state.px, state.py),
    ]);
    for (let i = 0; i < PARAMS.decoys; i++) {
        const spots: Pt[] = [];
        g.forEach((row, y) => row.forEach((cell, x) => {
            if (cell === EMPTY && !reserved.has(key(x, y))) spots.push({ x, y });
        }));
        if (spots.length === 0) break;
        const p = pick(spots, rng);
        put(p);
        reserved.add(key(p.x, p.y));
    }
    line.cells.forEach((p) => { if (!(p.x === c.x && p.y === c.y)) put(p); });
    put(feeder);
    if (fullLineExists(g)) return null;

    // Reverse play: undo moves (and sometimes pushes) from the board just before the clearing push.
    let vx = start.x;
    let vy = start.y;
    let pulls = 0;
    let done = 0;
    let retries = steps * PARAMS.scrambleRetryFactor;
    while (done < steps) {
        const e = DIRS[pick(DIR_LIST, rng)];
        const bx = vx - e.x;
        const by = vy - e.y;
        if (!inBounds(g, bx, by) || g[by][bx] !== EMPTY) {
            if (--retries < 0) return null;
            continue;
        }
        const ax = vx + e.x;
        const ay = vy + e.y;
        const onPlayer = vx === state.px && vy === state.py;
        const pullable = inBounds(g, ax, ay) && g[ay][ax] === MOVABLE && fresh.has(key(ax, ay)) && !onPlayer;
        if (pullable && rng() < PARAMS.scramblePullProb) {
            g[ay][ax] = EMPTY;
            fresh.delete(key(ax, ay));
            g[vy][vx] = MOVABLE;
            fresh.add(key(vx, vy));
            pulls++;
        }
        vx = bx;
        vy = by;
        done++;
        if (fullLineExists(g)) return null;
    }
    if (pulls < PARAMS.scrambleMinPulls || g[state.py][state.px] !== EMPTY) return null;
    if (!reachableFrom(g, state.px, state.py).has(key(vx, vy))) return null;
    return { grid: g, removed };
}

/** Step 10: every single-push arrangement, one picked at random (no decoys, no reverse play). */
function simpleArrangement(state: State, rng: Rng, thinned: Grid, avoid: LineRef[]): Grid | null {
    const options: Grid[] = [];
    for (const line of eligibleLines(state, avoid)) {
        for (const c of line.cells) {
            if (thinned[c.y][c.x] !== EMPTY) continue;
            for (const s of [-1, 1] as const) {
                const plan = makePlan(thinned, line, c, s);
                if (!plan) continue;
                const g = cloneGrid(thinned);
                line.cells.forEach((p) => { if (!(p.x === c.x && p.y === c.y) && g[p.y][p.x] === EMPTY) g[p.y][p.x] = MOVABLE; });
                if (g[plan.feeder.y][plan.feeder.x] === EMPTY) g[plan.feeder.y][plan.feeder.x] = MOVABLE;
                if (g[state.py][state.px] !== EMPTY || fullLineExists(g)) continue;
                if (reachableFrom(g, state.px, state.py).has(key(plan.start.x, plan.start.y))) options.push(g);
            }
        }
    }
    return options.length > 0 ? pick(options, rng) : null;
}

/** Step 8: a candidate whose optimum `found` is longer than the best so far replaces it. */
export const isHarder = (found: number, bestSoFar: number): boolean => found > bestSoFar;

/**
 * Adds movable blocks to `state.grid` (and thins leftovers) so that forward play can clear a line.
 * `avoid` lists the lines that were just cleared; they are not chosen as the next target.
 */
export function generateBlocks(state: State, rng: Rng, avoid: LineRef[], now: () => number): SpawnResult {
    const target = targetSolve(state.score);
    const steps = target + PARAMS.scrambleExtraSteps;
    const startedAt = now();

    let chosen: Candidate | null = null;
    let best: Candidate | null = null;
    let bestMoves = -1;
    for (let i = 0; i < PARAMS.spawnAttempts && now() - startedAt <= PARAMS.spawnTimeLimitMs; i++) {
        const cand = attempt(state, rng, avoid, steps);
        if (!cand) continue;
        const found = minClearMoves(cand.grid, state.px, state.py, target - 1);
        if (found === null) {
            chosen = cand;
            break;
        }
        if (isHarder(found, bestMoves)) {
            best = cand;
            bestMoves = found;
        }
    }
    chosen = chosen ?? best;

    if (!chosen) {
        // Steps 10-12: thin once, then try the single-push arrangement; otherwise only the thinning stays.
        const thinned = cloneGrid(state.grid);
        const removed = thin(thinned, rng);
        chosen = { grid: simpleArrangement(state, rng, thinned, avoid) ?? thinned, removed };
    }
    return commit(state, chosen);
}

/**
 * Writes the chosen board into the state. `removed` is what thinning took away (a cell that is
 * filled again by the new blocks still counts as removed and as added, so both effects play).
 */
function commit(state: State, next: Candidate): SpawnResult {
    const thinned = new Set(next.removed.map((p) => key(p.x, p.y)));
    const added: KindPt[] = [];
    next.grid.forEach((row, y) => row.forEach((cell, x) => {
        if (cell !== EMPTY && (state.grid[y][x] === EMPTY || thinned.has(key(x, y)))) added.push({ x, y, kind: cell });
        state.grid[y][x] = cell;
    }));
    return { added, removed: next.removed };
}
