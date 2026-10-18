// The demo waits for a relocated fixed block to finish growing (700 ms after the push, docs/spec/title-demo.md),
// not only for the new blocks (590 ms). The generation is wrapped so a clear moves a fixed block on purpose.
import { describe, expect, it, vi } from 'vitest';
import * as spawn from './spawn';
import { Demo, type DemoEvent, type Planner } from './demo';
import { board, frozenClock, seeded } from './testkit';
import { EMPTY, FIXED, type Dir, type State } from './types';

vi.mock('./spawn', async (orig) => {
    const actual = await orig<typeof import('./spawn')>();
    return { ...actual, generateBlocks: vi.fn(actual.generateBlocks) };
});

const DIRS: Record<Dir, { x: number; y: number }> = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

/** The first clear is the one push down; afterwards, a single step into any free neighbour cell. */
const planner: Planner = (s: State) => {
    if (s.score === 0) return ['down'];
    const dir = (Object.keys(DIRS) as Dir[]).find((d) => s.grid[s.py + DIRS[d].y]?.[s.px + DIRS[d].x] === EMPTY);
    return dir ? [dir] : null;
};

const isMove = (e: DemoEvent | null): boolean => e?.kind === 'move';

describe('Demo waiting for a relocated fixed block', () => {
    it('moves 700 ms after the clear when a fixed block was relocated (699 ms is too early)', () => {
        vi.mocked(spawn.generateBlocks).mockImplementation((state) => {
            const target = { x: 3, y: 0 };
            state.grid[0][0] = EMPTY; // the old fixed block
            state.grid[target.y][target.x] = FIXED;
            return { added: [{ ...target, kind: FIXED }], removed: [], relocated: [{ from: { x: 0, y: 0 }, to: target }] };
        });
        const demo = new Demo({ rng: seeded(7), now: frozenClock }, 0, {
            planner,
            initial: () => board(['x....', '.....', '.....', '....@', '....o', 'oooo.']),
        });
        const clear = demo.tick(500); // the wait is over: the push down clears row 5
        expect(clear?.kind === 'move' && clear.result.relocated.length).toBe(1);
        expect(demo.tick(500 + 589)).toBeNull();
        expect(demo.tick(500 + 699)).toBeNull(); // the plain growth (590 ms) is over, the relocated block's is not
        expect(isMove(demo.tick(500 + 700))).toBe(true);
    });
});
