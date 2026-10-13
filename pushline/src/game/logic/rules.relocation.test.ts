// How a clear hands the generation its "fresh" fixed blocks and what it reports afterwards
// (docs/spec/effects.md 押せないブロックの置き直し, docs/spec/board-generation.md 置き直しの記録). The
// generation is wrapped so each case can see what it was given and move a block on purpose.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as spawn from './spawn';
import { createState, move } from './rules';
import { board, depsOf, renderGrid } from './testkit';
import { EMPTY, FIXED, type Pt, type State } from './types';

vi.mock('./spawn', async (orig) => {
    const actual = await orig<typeof import('./spawn')>();
    return { ...actual, generateBlocks: vi.fn(actual.generateBlocks) };
});

const generate = vi.mocked(spawn.generateBlocks);

beforeEach(async () => {
    const real = await vi.importActual<typeof import('./spawn')>('./spawn');
    generate.mockReset().mockImplementation(real.generateBlocks);
});

// One push down from (4, 3) completes row 5 (see rules.test.ts).
const ROW_CLEAR = ['.....', '.....', '.....', '....@', '....o', 'oooo.'];

const fixedCells = (s: State): string[] => {
    const out: string[] = [];
    s.grid.forEach((row, y) => row.forEach((c, x) => { if (c === FIXED) out.push(`${x},${y}`); }));
    return out.sort();
};

describe('a clear hands the generation the fixed blocks its top-up just placed', () => {
    it('passes exactly the new fixed blocks (and no earlier ones) as fresh', () => {
        const s = board(['x....', '.....', '.....', '....@', '....o', 'oooo.'], { score: 1 });
        // score 1 -> 2: the fixed target goes 3 -> 4, and one fixed block is already there
        let seen: Pt[] = [];
        let before: string[] = [];
        const real = generate.getMockImplementation()!;
        generate.mockImplementation((state, rng, avoid, now, fresh) => {
            seen = [...(fresh ?? [])];
            before = fixedCells(state);
            return real(state, rng, avoid, now, fresh);
        });
        const res = move(s, 'down', depsOf(7));
        expect(res.clearedRows).toEqual([5]);
        expect(generate).toHaveBeenCalledTimes(1);
        const old = new Set(['0,0']); // the block that was there before the clear
        expect(seen.map((p) => `${p.x},${p.y}`).sort()).toEqual(before.filter((k) => !old.has(k)));
        expect(seen.length).toBeGreaterThan(0);
    });
});

describe('what a clear reports when the generation moves a block it has just placed', () => {
    it('the block appears only at its new cell: not listed as relocated, no pop-in at the old cell', () => {
        const s = board(ROW_CLEAR, { score: 1 });
        let from: Pt | null = null;
        let to: Pt | null = null;
        generate.mockImplementation((state, _rng, _avoid, _now, fresh) => {
            // the generation moves the first fresh fixed block to an empty cell nobody uses
            const f = (fresh ?? [])[0];
            const target = findEmpty(state);
            from = f;
            to = target;
            state.grid[f.y][f.x] = EMPTY;
            state.grid[target.y][target.x] = FIXED;
            return { added: [{ x: target.x, y: target.y, kind: FIXED }], removed: [], relocated: [] };
        });
        const res = move(s, 'down', depsOf(7));
        expect(from).not.toBeNull();
        expect(res.relocated).toEqual([]);
        expect(res.spawned).toContainEqual({ x: to!.x, y: to!.y, kind: FIXED });
        expect(res.spawned.some((p) => p.x === from!.x && p.y === from!.y)).toBe(false);
        for (const p of res.spawned) expect(s.grid[p.y][p.x]).toBe(p.kind); // every spawn is on the board
    });

    it('a block that was on the board before is reported as relocated and also pops in at its new cell', () => {
        const s = board(['x....', '.....', '.....', '....@', '....o', 'oooo.'], { score: 1 });
        generate.mockImplementation((state) => {
            const target = findEmpty(state);
            state.grid[0][0] = EMPTY; // the old fixed block
            state.grid[target.y][target.x] = FIXED;
            return { added: [{ x: target.x, y: target.y, kind: FIXED }], removed: [], relocated: [{ from: { x: 0, y: 0 }, to: target }] };
        });
        const res = move(s, 'down', depsOf(7));
        expect(res.relocated).toHaveLength(1);
        const m = res.relocated[0];
        expect(m.from).toEqual({ x: 0, y: 0 });
        expect(res.spawned).toContainEqual({ x: m.to.x, y: m.to.y, kind: FIXED });
        expect(s.grid[m.to.y][m.to.x]).toBe(FIXED);
    });
});

describe('the initial board', () => {
    it('is built through the same generation', () => {
        const s = createState(depsOf(5));
        expect(generate).toHaveBeenCalledTimes(1);
        expect(fixedCells(s)).toHaveLength(3);
        expect(renderGrid(s.grid)[5][2]).toBe('.'); // the character's cell is empty
    });
});

function findEmpty(state: State): Pt {
    for (let y = state.grid.length - 1; y >= 0; y--) {
        for (let x = 0; x < state.grid[0].length; x++) {
            if (state.grid[y][x] === EMPTY && !(x === state.px && y === state.py)) return { x, y };
        }
    }
    throw new Error('no empty cell');
}
