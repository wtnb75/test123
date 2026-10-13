// Board generation ("盤面の生成", docs/spec.md): add movable blocks so that a line can always be cleared
// by walking and pushing, and the optimum is not shorter than the score-based target.
import { PARAMS } from '../params';
import { floorMoves, hasSingleBlockClear, relocateFixed } from './floor';
import { cloneGrid, DIR_LIST, DIRS, fullLineExists, inBounds, key, pick, reachableFrom } from './grid';
import { minClearMoves, targetSolve } from './solve';
import {
    EMPTY, FIXED, MOVABLE,
    type Grid, type KindPt, type LineRef, type Pt, type Relocation, type Rng, type State,
} from './types';

export interface SpawnResult {
    /** Cells that hold a block afterwards and were empty before (or whose block was replaced). */
    added: KindPt[];
    /** Movable blocks that were on the board and are gone afterwards (thinned out). */
    removed: KindPt[];
    /** Fixed blocks moved to another cell (blocks the caller listed as fresh are left out). */
    relocated: Relocation[];
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

/** A finished candidate board together with the leftovers thinned out and the fixed blocks moved to make it. */
interface Candidate {
    grid: Grid;
    removed: KindPt[];
    /** Every fixed block moved before this candidate was made (all rounds so far). */
    moves: Relocation[];
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
function attempt(state: State, base: Grid, rng: Rng, avoid: LineRef[], steps: number): Candidate | null {
    const g = cloneGrid(base);
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
    return { grid: g, removed, moves: [] };
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

/** A judged candidate: where it ranks in "採用の優先順位" (docs/spec/board-generation.md). */
interface Judged {
    cand: Candidate;
    /** The fewest moves to a clear; `target` when the search found none within `target - 1`. */
    found: number;
    /** (B): no single movable block clears a line alone. */
    noSingle: boolean;
    /** 0 = ideal, 1 = pass (meets the floor), 2 = fail. */
    klass: 0 | 1 | 2;
    /** Order found in (earlier wins ties). */
    order: number;
}

/** True when `a` is the better of two candidates of the same class (more moves, then fewer relocations, then earlier). */
const beats = (a: Judged, b: Judged): boolean =>
    a.found !== b.found ? isHarder(a.found, b.found)
        : a.cand.moves.length !== b.cand.moves.length ? a.cand.moves.length < b.cand.moves.length
            : a.order < b.order;

/** Best of the failed candidates: (B) first, then `beats`. */
const beatsFailed = (a: Judged, b: Judged): boolean =>
    a.noSingle !== b.noSingle ? a.noSingle : beats(a, b);

/**
 * Adds movable blocks to `state.grid` (and thins leftovers) so that forward play can clear a line.
 * `avoid` lists the lines that were just cleared; they are not chosen as the next target. `fresh` lists
 * the fixed blocks the same clear's top-up just placed: if one of them is relocated it is not reported
 * in `relocated` (the caller shows it appearing at its final cell only).
 *
 * Candidates are judged as ideal (reaches the target, no single block clears alone), pass (meets the
 * floor) or fail. The attempts are split into `1 + relocateMax` rounds (cumulative caps and deadlines,
 * the clock is read once at the start and once before each attempt); when a round ends with no ideal
 * and no pass candidate, fixed blocks are relocated and the next round starts from that board.
 */
export function generateBlocks(
    state: State,
    rng: Rng,
    avoid: LineRef[],
    now: () => number,
    fresh: readonly Pt[] = [],
): SpawnResult {
    const target = targetSolve(state.score);
    const steps = target + PARAMS.scrambleExtraSteps;
    const floor = floorMoves(target);
    const startedAt = now();
    const rounds = 1 + PARAMS.relocateMax;

    let base: Grid = state.grid;
    let moves: Relocation[] = [];
    const moved = new Set<string>();
    const vacated = new Set<string>();
    const failed: Judged[] = [];
    let adopted: Judged | null = null;
    let order = 0;
    let tried = 0;
    let reading: number | null = null; // a reading carried over a round boundary
    let cut = false;

    for (let k = 0; k < rounds && !adopted && !cut; ) {
        const cap = Math.floor((PARAMS.spawnAttempts * (k + 1)) / rounds);
        const deadline = (PARAMS.spawnTimeLimitMs * (k + 1)) / rounds;
        let bestPass: Judged | null = null;
        while (tried < cap) {
            const t: number = reading ?? now();
            reading = null;
            if (t - startedAt > PARAMS.spawnTimeLimitMs) {
                cut = true;
                break;
            }
            if (t - startedAt > deadline) {
                reading = t;
                break;
            }
            tried++;
            const cand = attempt(state, base, rng, avoid, steps);
            if (!cand) continue;
            cand.moves = moves;
            const found = minClearMoves(cand.grid, state.px, state.py, target - 1) ?? target;
            const noSingle = !hasSingleBlockClear(cand.grid, state.px, state.py);
            const passes = noSingle && found >= floor;
            const klass = passes ? (found >= target ? 0 : 1) : 2;
            const j: Judged = { cand, found, noSingle, klass, order: order++ };
            if (klass === 0) {
                adopted = j;
                break;
            }
            if (klass === 1) {
                if (!bestPass || beats(j, bestPass)) bestPass = j;
            } else {
                failed.push(j);
            }
        }
        if (adopted) break;
        if (bestPass) {
            adopted = bestPass;
            break;
        }
        if (cut || k + 1 >= rounds) break;

        // Relocate fixed blocks for the next round; rounds whose deadline the carried reading already
        // passed are skipped (their attempts would be zero). The reading is within the time limit (a larger
        // one cut the generation), so the last round's deadline always stops this loop.
        let next = k + 1;
        while (reading !== null && reading - startedAt > (PARAMS.spawnTimeLimitMs * (next + 1)) / rounds) next++;
        const moved2 = relocateFixed(base, state.px, state.py, rng, moved, vacated);
        if (!moved2) break;
        base = moved2.grid;
        moves = [...moves, ...moved2.moves];
        moved2.moves.forEach((m) => {
            moved.add(key(m.to.x, m.to.y));
            vacated.add(key(m.from.x, m.from.y));
        });
        k = next;
    }

    let chosen: Candidate | null = adopted?.cand ?? null;
    if (!chosen && failed.length > 0) {
        chosen = failed.reduce((best, j) => (beatsFailed(j, best) ? j : best)).cand;
    }

    if (!chosen) {
        // Steps 10-12: thin once, then try the single-push arrangement; otherwise only the thinning stays.
        const thinned = cloneGrid(state.grid);
        const removed = thin(thinned, rng);
        chosen = { grid: simpleArrangement(state, rng, thinned, avoid) ?? thinned, removed, moves: [] };
    }
    return commit(state, chosen, fresh);
}

/**
 * Writes the chosen board into the state. `removed` is what thinning took away (a cell that is
 * filled again by the new blocks still counts as removed and as added, so both effects play). A cell a
 * fixed block was moved from counts as added when another block now stands there.
 */
function commit(state: State, next: Candidate, fresh: readonly Pt[]): SpawnResult {
    const thinned = new Set(next.removed.map((p) => key(p.x, p.y)));
    const vacated = new Set(next.moves.map((m) => key(m.from.x, m.from.y)));
    const added: KindPt[] = [];
    next.grid.forEach((row, y) => row.forEach((cell, x) => {
        const k = key(x, y);
        if (cell !== EMPTY && (state.grid[y][x] === EMPTY || thinned.has(k) || vacated.has(k))) added.push({ x, y, kind: cell });
        state.grid[y][x] = cell;
    }));
    const freshKeys = new Set(fresh.map((p) => key(p.x, p.y)));
    const relocated = next.moves.filter((m) => !freshKeys.has(key(m.from.x, m.from.y)));
    return { added, removed: next.removed, relocated };
}
