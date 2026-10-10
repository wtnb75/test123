// Helpers shared by the unit tests: ASCII boards, a seeded random source, fake clocks, an independent search.
import { PARAMS } from '../params';
import type { Cell, Deps, Dir, Grid, Rng, State } from './types';

const CELLS: Record<string, Cell> = { '.': 0, o: 1, x: 2, '@': 0 };

/**
 * A state from ASCII rows (top to bottom): `.` empty, `o` movable block, `x` fixed block, `@` the player.
 * Exactly `PARAMS.rows` rows of `PARAMS.cols` characters and one `@`.
 */
export function board(rows: string[], extra: Partial<State> = {}): State {
    if (rows.length !== PARAMS.rows || rows.some((r) => r.length !== PARAMS.cols)) {
        throw new Error(`board needs ${PARAMS.rows} rows of ${PARAMS.cols} characters`);
    }
    let px = -1;
    let py = -1;
    const grid: Grid = rows.map((row, y) =>
        [...row].map((ch, x) => {
            if (ch === '@') {
                px = x;
                py = y;
            }
            const cell = CELLS[ch];
            if (cell === undefined) throw new Error(`unknown board character "${ch}"`);
            return cell;
        }));
    if (px < 0) throw new Error('board needs a player (@)');
    return { grid, px, py, moves: 20, score: 0, over: false, history: [], ...extra };
}

/** The state as ASCII rows, the inverse of `board`. */
export const render = (s: State): string[] =>
    s.grid.map((row, y) => row.map((c, x) => (x === s.px && y === s.py ? '@' : '.ox'[c])).join(''));

/** The grid alone as ASCII rows (the player is not shown). */
export const renderGrid = (grid: Grid): string[] => grid.map((row) => row.map((c) => '.ox'[c]).join(''));

/** Deterministic random source (mulberry32). */
export function seeded(seed: number): Rng {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A clock that never moves (generation never hits its time limit). */
export const frozenClock = (): number => 0;

/**
 * A clock that stays at 0 for its first `reads` readings and jumps far past any limit afterwards.
 * `generateBlocks` reads it once at the start and once before each attempt, so `reads = n + 1`
 * lets exactly `n` attempts run.
 */
export function cutOffAfter(reads: number): { now: () => number; readings: () => number } {
    let n = 0;
    return {
        now: () => (n++ < reads ? 0 : 1e9),
        readings: () => n,
    };
}

/** A clock that counts its readings and never moves. */
export function countingClock(): { now: () => number; readings: () => number } {
    let n = 0;
    return {
        now: () => {
            n += 1;
            return 0;
        },
        readings: () => n,
    };
}

export const depsOf = (seed: number, now: () => number = frozenClock, maxUndo?: number): Deps => ({
    rng: seeded(seed),
    now,
    maxUndo,
});

/** Number of cells holding `kind`. */
export const count = (grid: Grid, kind: Cell): number => grid.flat().filter((c) => c === kind).length;

/** An empty 5 x 6 board with the player at the bottom centre. */
export const EMPTY_ROWS = ['.....', '.....', '.....', '.....', '.....', '..@..'];

const STEPS: [Dir, number, number][] = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];

/**
 * Independent oracle: the shortest sequence of steps from an ASCII board (player `@`) to the first
 * line clear, searched breadth-first on plain strings. Returns null when none exists within `limit`
 * steps. When more than `cap` states are visited it returns null, or throws when `strict` is set.
 * Written separately from the game's own search on purpose.
 */
export function oracleSolve(rows: string[], limit: number, cap = 200000, strict = false): Dir[] | null {
    const h = rows.length;
    const w = rows[0].length;
    let level: { flat: string; path: Dir[] }[] = [{ flat: rows.join(''), path: [] }];
    const seen = new Set([level[0].flat]);
    for (let depth = 1; depth <= limit; depth++) {
        const next: typeof level = [];
        for (const { flat, path } of level) {
            const at = flat.indexOf('@');
            const px = at % w;
            const py = Math.floor(at / w);
            for (const [dir, dx, dy] of STEPS) {
                const nx = px + dx;
                const ny = py + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const target = flat[ny * w + nx];
                if (target === 'x') continue;
                const cells = [...flat];
                cells[py * w + px] = '.';
                if (target === 'o') {
                    const bx = nx + dx;
                    const by = ny + dy;
                    if (bx < 0 || by < 0 || bx >= w || by >= h || cells[by * w + bx] !== '.') continue;
                    cells[by * w + bx] = 'o';
                    const rowDone = [...Array(w).keys()].every((x) => cells[by * w + x] !== '.');
                    const colDone = [...Array(h).keys()].every((y) => cells[y * w + bx] !== '.');
                    if (rowDone || colDone) return [...path, dir];
                }
                cells[ny * w + nx] = '@';
                const key = cells.join('');
                if (seen.has(key)) continue;
                seen.add(key);
                if (seen.size > cap) {
                    if (strict) throw new Error(`oracle search exceeded ${cap} states`);
                    return null;
                }
                next.push({ flat: key, path: [...path, dir] });
            }
        }
        level = next;
        if (level.length === 0) return null;
    }
    return null;
}

/** Number of steps of the shortest clear, or null (see `oracleSolve`). */
export const oracleMin = (rows: string[], limit: number, cap = 200000, strict = false): number | null =>
    oracleSolve(rows, limit, cap, strict)?.length ?? null;

/** `oracleMin` for a state. */
export const oracleMinOf = (s: State, limit: number, cap?: number, strict?: boolean): number | null =>
    oracleMin(render(s), limit, cap, strict);
