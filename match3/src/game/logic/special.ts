// Special stones (docs/spec/special-gems.md): which stones one clear removes, and which special stones it leaves.
// Pure: no Phaser, no randomness, no time.
import { BOMB_RADIUS, LINE_MIN, MATCH_MIN, RAINBOW_MIN } from '../params';
import { RAINBOW, samePos, type Board, type Fall, type Kind, type Kinds, type Pos } from './board';

/** A straight run of equal colours. `cells` are in board order (left to right, or top to bottom). */
export interface Run {
    dir: 'h' | 'v';
    color: number;
    cells: Pos[];
}

/** A special stone a clear leaves behind, at `r`, `c`. A colour stone has the colour `RAINBOW`. */
export interface Spawn extends Pos {
    color: number;
    kind: Kind;
}

/** One clear: the stones that vanish, the special stones left in place, and how many stones count for points. */
export interface ClearPlan {
    /** Stones removed from the board, in board order (top row first, left to right). */
    cleared: Pos[];
    spawned: Spawn[];
    /** Every stone of the clear, the ones that turn into special stones included. */
    count: number;
}

/**
 * The texture name of a stone: one per (colour, kind) that can occur. A colour stone has no colour, so every
 * colour of 'rainbow' maps to the same name.
 */
export function gemKey(color: number, kind: Kind): string {
    if (kind === 'rainbow') return 'gem.rainbow';
    return kind === 'normal' ? `gem${color}` : `gem${color}.${kind}`;
}

/** All horizontal runs (rows top to bottom, left to right), then all vertical runs (columns left to right). */
export function findRuns(board: Board): Run[] {
    const rows = board.length;
    const cols = rows > 0 ? board[0].length : 0;
    const runs: Run[] = [];
    const push = (dir: 'h' | 'v', color: number, cells: Pos[]) => {
        if (cells.length >= MATCH_MIN) runs.push({ dir, color, cells });
    };
    const colorAt = (r: number, c: number): number | null => {
        const v = board[r][c];
        return v !== null && v >= 0 ? v : null;
    };
    for (let r = 0; r < rows; r++) {
        let cells: Pos[] = [];
        let color: number | null = null;
        for (let c = 0; c <= cols; c++) {
            const here = c < cols ? colorAt(r, c) : null;
            if (here !== null && here === color) {
                cells.push({ r, c });
                continue;
            }
            if (color !== null) push('h', color, cells);
            color = here;
            cells = here === null ? [] : [{ r, c }];
        }
    }
    for (let c = 0; c < cols; c++) {
        let cells: Pos[] = [];
        let color: number | null = null;
        for (let r = 0; r <= rows; r++) {
            const here = r < rows ? colorAt(r, c) : null;
            if (here !== null && here === color) {
                cells.push({ r, c });
                continue;
            }
            if (color !== null) push('v', color, cells);
            color = here;
            cells = here === null ? [] : [{ r, c }];
        }
    }
    return runs;
}

/** Runs that share a stone belong to one group. Groups and the runs in them keep the order of `runs`. */
function groupRuns(runs: Run[], cols: number): Run[][] {
    const parent = new Map<number, number>();
    const find = (x: number): number => {
        let root = x;
        while (parent.get(root) !== root) root = parent.get(root) as number;
        return root;
    };
    const key = (p: Pos) => p.r * cols + p.c;
    for (const run of runs) for (const p of run.cells) if (!parent.has(key(p))) parent.set(key(p), key(p));
    for (const run of runs) {
        const head = find(key(run.cells[0]));
        for (const p of run.cells) parent.set(find(key(p)), head);
    }
    const groups = new Map<number, Run[]>();
    for (const run of runs) {
        const root = find(key(run.cells[0]));
        groups.set(root, [...(groups.get(root) ?? []), run]);
    }
    return [...groups.values()];
}

const has = (cells: Pos[], p: Pos): boolean => cells.some((q) => samePos(q, p));

/** The middle cell of a run, left/top-leaning for an even length: index `floor((length - 1) / 2)`. */
const middleOf = (cells: Pos[]): Pos => cells[Math.floor((cells.length - 1) / 2)];

/** The special stone one group of runs leaves, or null when it leaves none (three in a row only). */
function spawnFor(group: Run[], swapped: Pos[], kinds: Kinds): Spawn | null {
    const longest = group.reduce((best, run) => (run.cells.length > best.cells.length ? run : best), group[0]);
    const horizontal = group.filter((run) => run.dir === 'h');
    const vertical = group.filter((run) => run.dir === 'v');
    const crossing = horizontal
        .flatMap((run) => run.cells)
        .filter((p) => vertical.some((run) => has(run.cells, p)))
        .sort((x, y) => x.r - y.r || x.c - y.c);

    let kind: Kind;
    let targets: Pos[];
    let fallback: Pos;
    if (longest.cells.length >= RAINBOW_MIN) {
        kind = 'rainbow';
        targets = longest.cells;
        fallback = middleOf(longest.cells);
    } else if (crossing.length > 0) {
        kind = 'bomb';
        targets = crossing;
        fallback = crossing[0];
    } else if (longest.cells.length >= LINE_MIN) {
        kind = longest.dir === 'h' ? 'lineCol' : 'lineRow';
        targets = longest.cells;
        fallback = middleOf(longest.cells);
    } else {
        return null;
    }
    const at = swapped.find((p) => has(targets, p)) ?? fallback;
    if (kinds[at.r][at.c] !== 'normal') return null; // a special stone already stands there: it just goes off
    return { r: at.r, c: at.c, color: kind === 'rainbow' ? RAINBOW : longest.color, kind };
}

/** The stones a colour stone swapped with a neighbour removes (the colour stones themselves included). */
function rainbowSeeds(board: Board, swapped: Pos[]): Pos[] {
    const rows = board.length;
    const cols = rows > 0 ? board[0].length : 0;
    const rainbows = swapped.filter((p) => board[p.r][p.c] === RAINBOW);
    if (rainbows.length === 0) return [];
    if (rainbows.length === 2) return rainbows;
    const rainbow = rainbows[0];
    const partner = swapped.find((p) => !samePos(p, rainbow)) as Pos;
    const color = board[partner.r][partner.c];
    const out: Pos[] = [rainbow];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] === color) out.push({ r, c });
    return out;
}

/** The cells a special stone at `p` removes when it goes off. A colour stone caught in a blast removes only itself. */
function reach(kind: Kind, p: Pos, rows: number, cols: number): Pos[] {
    const out: Pos[] = [];
    if (kind === 'lineRow') for (let c = 0; c < cols; c++) out.push({ r: p.r, c });
    else if (kind === 'lineCol') for (let r = 0; r < rows; r++) out.push({ r, c: p.c });
    else if (kind === 'bomb') {
        for (let r = p.r - BOMB_RADIUS; r <= p.r + BOMB_RADIUS; r++) {
            for (let c = p.c - BOMB_RADIUS; c <= p.c + BOMB_RADIUS; c++) {
                if (r >= 0 && r < rows && c >= 0 && c < cols) out.push({ r, c });
            }
        }
    }
    return out;
}

/**
 * Decides one clear on `board` (already holding the swap, if any). `swapped` is the two cells of the swap in the
 * order the player gave them, for the first clear of a swap; it is empty for the later laps of a chain. Returns
 * null when nothing clears. The board and kinds are not changed.
 */
export function planClear(board: Board, kinds: Kinds, swapped: Pos[]): ClearPlan | null {
    const rows = board.length;
    const cols = rows > 0 ? board[0].length : 0;
    const key = (p: Pos) => p.r * cols + p.c;
    const all = new Map<number, Pos>();
    const add = (p: Pos): boolean => {
        if (board[p.r][p.c] === null || all.has(key(p))) return false;
        all.set(key(p), p);
        return true;
    };

    const spawns = new Map<number, Spawn>();
    for (const group of groupRuns(findRuns(board), cols)) {
        for (const run of group) run.cells.forEach(add);
        const spawn = spawnFor(group, swapped, kinds);
        if (spawn) spawns.set(key(spawn), spawn);
    }
    rainbowSeeds(board, swapped).forEach(add);
    if (all.size === 0) return null;

    // Special stones that go off set off the ones they reach, until nothing new is added. The stones about to be
    // made are not set off.
    const queue = [...all.values()];
    for (let p = queue.pop(); p; p = queue.pop()) {
        if (spawns.has(key(p))) continue;
        for (const q of reach(kinds[p.r][p.c], p, rows, cols)) if (add(q)) queue.push(q);
    }

    const cleared = [...all.entries()]
        .filter(([k]) => !spawns.has(k))
        .sort(([x], [y]) => x - y)
        .map(([, p]) => p);
    return { cleared, spawned: [...spawns.values()], count: all.size };
}

/** Moves the kinds along with the stones that fell (the same moves `collapse` made on the board). */
export function applyFalls(kinds: Kinds, falls: Fall[]): void {
    for (const f of falls) {
        kinds[f.to][f.c] = kinds[f.from][f.c];
        kinds[f.from][f.c] = 'normal';
    }
}
