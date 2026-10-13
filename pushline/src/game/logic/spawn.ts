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

/** Where a judged candidate ranks in "採用の優先順位" (docs/spec/board-generation.md). */
const IDEAL = 0; // reaches the target and no single block clears alone
const PASS = 1; // meets the floor, short of the target
const FAIL = 2; // misses the floor
type Klass = typeof IDEAL | typeof PASS | typeof FAIL;

interface Judged {
    cand: Candidate;
    /** The fewest moves to a clear; `target` when the search found none within `target - 1`. */
    found: number;
    /** (B): no single movable block clears a line alone. */
    noSingle: boolean;
    klass: Klass;
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

/** What one generation carries from round to round. */
interface Search {
    state: State;
    rng: Rng;
    avoid: LineRef[];
    now: () => number;
    target: number;
    floor: number;
    steps: number;
    startedAt: number;
    rounds: number;
    /** The board the attempts start from: the real one, then the relocated ones. */
    base: Grid;
    /** Every fixed block moved so far, the cells they stand on now, and the cells they left. */
    moves: Relocation[];
    moved: Set<string>;
    vacated: Set<string>;
    /** Candidates that missed the floor, from every round. */
    failed: Judged[];
    order: number;
    tried: number;
    /** A clock reading that ended a round and is used for the next round's first attempt. */
    reading: number | null;
    /** A reading went past the time limit: no more attempts, no more rounds. */
    cut: boolean;
}

/**
 * Steps 8-9 for one candidate: how far it gets (docs/spec/board-generation.md "簡単さの下限").
 * It also fills `cand.moves` (the relocations so far) and advances `s.order`.
 */
function judge(s: Search, cand: Candidate): Judged {
    cand.moves = s.moves;
    const found = minClearMoves(cand.grid, s.state.px, s.state.py, s.target - 1) ?? s.target;
    const noSingle = !hasSingleBlockClear(cand.grid, s.state.px, s.state.py);
    const passes = noSingle && found >= s.floor;
    const klass: Klass = !passes ? FAIL : found >= s.target ? IDEAL : PASS;
    return { cand, found, noSingle, klass, order: s.order++ };
}

/**
 * Attempts of round `k` up to its cumulative cap and its deadline (the time limit scaled to the round).
 * Returns the first ideal candidate, or else the round's best pass, or null. A reading past the round's
 * deadline is kept in `s.reading` for the next round; one past the limit sets `s.cut`.
 */
function runRound(s: Search, k: number): Judged | null {
    const cap = Math.floor((PARAMS.spawnAttempts * (k + 1)) / s.rounds);
    const deadline = (PARAMS.spawnTimeLimitMs * (k + 1)) / s.rounds;
    let bestPass: Judged | null = null;
    while (s.tried < cap) {
        const t: number = s.reading ?? s.now();
        s.reading = null;
        if (t - s.startedAt > PARAMS.spawnTimeLimitMs) {
            s.cut = true;
            break;
        }
        if (t - s.startedAt > deadline) {
            s.reading = t;
            break;
        }
        s.tried++;
        const cand = attempt(s.state, s.base, s.rng, s.avoid, s.steps);
        if (!cand) continue;
        const j = judge(s, cand);
        if (j.klass === IDEAL) return j;
        if (j.klass === PASS) {
            if (!bestPass || beats(j, bestPass)) bestPass = j;
        } else {
            s.failed.push(j);
        }
    }
    return bestPass;
}

/**
 * Relocates fixed blocks for the round after `k` and returns that round's index, or null when no round
 * follows (cut, last round, or no block can be moved). Rounds whose deadline the carried reading already
 * passed are skipped (their attempts would be zero); the reading is within the time limit (a larger one
 * cut the generation), so the last round's deadline always stops the skipping.
 */
function startNextRound(s: Search, k: number): number | null {
    if (s.cut || k + 1 >= s.rounds) return null;
    let next = k + 1;
    while (s.reading !== null && s.reading - s.startedAt > (PARAMS.spawnTimeLimitMs * (next + 1)) / s.rounds) next++;
    const relocated = relocateFixed(s.base, s.state.px, s.state.py, s.rng, s.moved, s.vacated);
    if (!relocated) return null;
    s.base = relocated.grid;
    s.moves = [...s.moves, ...relocated.moves];
    relocated.moves.forEach((m) => {
        s.moved.add(key(m.to.x, m.to.y));
        s.vacated.add(key(m.from.x, m.from.y));
    });
    return next;
}

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
    const search: Search = {
        state, rng, avoid, now, target,
        floor: floorMoves(target),
        steps: target + PARAMS.scrambleExtraSteps,
        startedAt: now(),
        rounds: 1 + PARAMS.relocateMax,
        base: state.grid,
        moves: [],
        moved: new Set(),
        vacated: new Set(),
        failed: [],
        order: 0,
        tried: 0,
        reading: null,
        cut: false,
    };

    let adopted: Judged | null = null;
    // After an adoption nothing is relocated: startNextRound would spend random numbers for a round
    // that never runs, which changes the boards of every seed.
    for (let k: number | null = 0; k !== null && !adopted; k = adopted ? null : startNextRound(search, k)) {
        adopted = runRound(search, k);
    }

    let chosen: Candidate | null = adopted?.cand ?? null;
    if (!chosen && search.failed.length > 0) {
        chosen = search.failed.reduce((best, j) => (beatsFailed(j, best) ? j : best)).cand;
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
