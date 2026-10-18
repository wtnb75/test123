import { describe, expect, it } from 'vitest';
import { Demo, solverPlanner, type DemoEvent, type Planner } from './demo';
import { createState } from './rules';
import { board, frozenClock, render, seeded } from './testkit';
import { EMPTY, type State } from './types';

/** Three moves clear row 5: right, then push the block down twice. */
const THREE = ['.....', '.....', '...@.', '....o', '.....', 'oooo.'];
/** One push down completes row 5. */
const ONE = ['.....', '.....', '.....', '....@', '....o', 'oooo.'];
/** The player stands on the top row, so "up" can never be played. */
const TOP = ['..@..', '.....', '.....', '.....', '.....', 'oooo.'];

const demoOn = (rows: string[], options: ConstructorParameters<typeof Demo>[2] = {}, seed = 7): Demo =>
    new Demo({ rng: seeded(seed), now: frozenClock }, 0, { initial: () => board(rows), ...options });

const cleared = (e: DemoEvent | null): boolean =>
    e?.kind === 'move' && e.result.clearedRows.length + e.result.clearedCols.length > 0;

describe('Demo timing', () => {
    it('plays the first move after the wait and then one move per step', () => {
        const demo = demoOn(THREE);
        expect(demo.tick(0)).toBeNull();
        expect(demo.tick(499)).toBeNull();
        expect(demo.tick(500)?.kind).toBe('move');
        expect(demo.phase).toBe('stepping');
        expect(demo.tick(719)).toBeNull();
        expect(demo.tick(720)?.kind).toBe('move');
        expect(demo.tick(939)).toBeNull();
        const last = demo.tick(940);
        expect(cleared(last)).toBe(true);
        expect(demo.lines).toBe(1);
        expect(demo.phase).toBe('waiting');
    });

    it('waits for the new blocks to finish growing (590 ms, 700 ms with a relocation) before the next move', () => {
        // Spec (title-demo.md): the clear at 940 ms, then the pop-in ends 590 ms later (700 ms if a fixed block moved).
        const outcomes = new Set<number>();
        for (let seed = 1; seed <= 60; seed++) {
            const demo = demoOn(THREE, {}, seed);
            demo.tick(500);
            demo.tick(720);
            const clear = demo.tick(940);
            expect(cleared(clear)).toBe(true);
            if (clear?.kind !== 'move') throw new Error('expected a move');
            const growth = clear.result.relocated.length > 0 ? 700 : 590;
            outcomes.add(growth);
            expect(demo.tick(940 + growth - 1)).toBeNull();
            expect(demo.tick(940 + growth)?.kind).toBe('move');
        }
        expect(outcomes.has(590)).toBe(true); // the plain case is exercised (700 ms: demo.relocation.test.ts)
    });

    it('keeps the plain pause when it outlasts the growth (a pause of 800 ms)', () => {
        // The wait is the longer of the pause and the growth (590 / 700 ms): here the pause decides.
        const demo = demoOn(THREE, { timing: { stepMs: 220, waitMs: 800, lines: 4, fadeMs: 300 } });
        demo.tick(800);
        demo.tick(1020);
        expect(cleared(demo.tick(1240))).toBe(true);
        expect(demo.tick(1240 + 799)).toBeNull();
        expect(demo.tick(1240 + 800)?.kind).toBe('move');
    });

    it('does not delay the fade when no plan is found after a clear (the plain pause decides)', () => {
        let calls = 0;
        const planner: Planner = (s) => (++calls === 1 ? solverPlanner(s) : null);
        const demo = demoOn(THREE, { planner });
        demo.tick(500);
        demo.tick(720);
        expect(cleared(demo.tick(940))).toBe(true);
        expect(demo.tick(1439)).toBeNull();
        expect(demo.tick(1440)).toEqual({ kind: 'fade-out' });
    });

    it('asks a planner that is still working again, and moves once it has a plan and the growth is over', () => {
        let calls = 0;
        const planner: Planner = (s) => (++calls === 2 ? 'pending' : solverPlanner(s));
        const demo = demoOn(ONE, { planner });
        expect(demo.tick(500)?.kind).toBe('move'); // call 1: the plan clears the line
        let t = 501;
        while (calls < 2) demo.tick(t++); // call 2 answers 'pending'
        expect(calls).toBe(2);
        // the board after the clear is planned again: some later frame moves, never before the growth is over
        let moved = -1;
        for (; moved < 0 && t < 3000; t++) if (demo.tick(t)?.kind === 'move') moved = t;
        expect(moved).toBeGreaterThanOrEqual(500 + 590);
    });

    it('makes at most one move per call even after a long frame', () => {
        const demo = demoOn(THREE);
        expect(demo.tick(5000)?.kind).toBe('move');
        expect(demo.tick(5000)).toBeNull();
        expect(demo.tick(5219)).toBeNull();
        expect(demo.tick(5220)?.kind).toBe('move');
    });

    it('starts with an initial board and no lines', () => {
        const demo = new Demo({ rng: seeded(3), now: frozenClock }, 0);
        expect(demo.lines).toBe(0);
        expect(demo.phase).toBe('waiting');
        expect([demo.state.px, demo.state.py]).toEqual([2, 5]);
        expect(demo.opacity(0)).toBe(1);
    });
});

describe('Demo game boundaries', () => {
    it.each([1, 2, 3, 5, 8])('rebuilds the board 500 ms after the 4th clear (seed %i)', (seed) => {
        const demo = new Demo({ rng: seeded(seed), now: frozenClock }, 0);
        let clears = 0;
        let lastClear = -1;
        let fadeStart = -1;
        for (let t = 10; fadeStart < 0 && t < 200000; t += 10) {
            const e = demo.tick(t);
            if (cleared(e)) {
                clears++;
                lastClear = t;
                // the 4th clear refills the board like any other: new blocks appear
                if (clears === 4 && e?.kind === 'move') expect(e.result.spawned.length).toBeGreaterThan(0);
            }
            if (e?.kind === 'fade-out') fadeStart = t;
        }
        expect(clears).toBe(4);
        expect(fadeStart - lastClear).toBe(500);
        expect(demo.lines).toBe(4);
    });

    it('starts the fade exactly 500 ms after the last line of a game (hand-timed, one line per game)', () => {
        const timing = { stepMs: 220, waitMs: 500, lines: 1, fadeMs: 300 };
        let calls = 0;
        const planner: Planner = (s) => {
            calls++;
            return solverPlanner(s);
        };
        const demo = demoOn(THREE, { timing, planner });
        demo.tick(500);
        demo.tick(720);
        const clear = demo.tick(940);
        expect(cleared(clear)).toBe(true);
        if (clear?.kind === 'move') expect(clear.result.spawned.length).toBeGreaterThan(0);
        expect(calls).toBe(1);
        for (let t = 941; t < 1440; t += 7) expect(demo.tick(t)).toBeNull();
        expect(demo.tick(1439)).toBeNull();
        expect(demo.phase).toBe('waiting');
        // the last line of a game is not planned from: no solver work in that wait
        expect(calls).toBe(1);
        expect(demo.tick(1440)).toEqual({ kind: 'fade-out' });
        expect(demo.tick(1739)).toBeNull();
        expect(demo.tick(1740)).toEqual({ kind: 'fade-in' });
    });

    it('does not wait for a plan that is still pending once the last line of a game is cleared', () => {
        const timing = { stepMs: 220, waitMs: 500, lines: 1, fadeMs: 300 };
        let first = true;
        const planner: Planner = (s) => {
            if (!first) return 'pending';
            first = false;
            return solverPlanner(s);
        };
        const demo = demoOn(THREE, { timing, planner });
        demo.tick(500);
        demo.tick(720);
        expect(cleared(demo.tick(940))).toBe(true);
        expect(demo.tick(1440)).toEqual({ kind: 'fade-out' });
    });

    it('does not rebuild before the 4th line, however long the game runs', () => {
        const demo = new Demo({ rng: seeded(2), now: frozenClock }, 0);
        let fadeOutAtLines = -1;
        for (let t = 10; fadeOutAtLines < 0 && t < 200000; t += 10) {
            if (demo.tick(t)?.kind === 'fade-out') fadeOutAtLines = demo.lines;
        }
        expect(fadeOutAtLines).toBe(4);
    });

    it('fades out, swaps in a fresh board, fades in, and waits before the next move', () => {
        let calls = 0;
        const planner: Planner = (s) => (++calls === 1 ? null : solverPlanner(s));
        // The first game's board is THREE; the one after the swap is ONE, so the swap can be seen.
        let boards = 0;
        const demo = demoOn(THREE, { planner, initial: () => board(boards++ === 0 ? THREE : ONE) });
        expect(demo.tick(499)).toBeNull();
        expect(demo.tick(500)).toEqual({ kind: 'fade-out' });
        expect(render(demo.state)).toEqual(THREE); // still the old board while it fades out
        expect(demo.phase).toBe('fading-out');
        expect(demo.opacity(500)).toBe(1);
        expect(demo.opacity(650)).toBe(0.5);
        expect(demo.tick(799)).toBeNull();
        expect(demo.tick(800)).toEqual({ kind: 'fade-in' });
        expect(demo.phase).toBe('fading-in');
        expect(demo.opacity(800)).toBe(0);
        expect(demo.opacity(950)).toBe(0.5);
        expect(render(demo.state)).toEqual(ONE);
        expect(demo.tick(1099)).toBeNull();
        expect(demo.phase).toBe('fading-in');
        expect(demo.tick(1100)).toBeNull();
        expect(demo.phase).toBe('waiting');
        expect(demo.opacity(1100)).toBe(1);
        expect(demo.tick(1599)).toBeNull();
        expect(demo.tick(1600)?.kind).toBe('move');
    });

    it('starts a new game from a clean score after the swap', () => {
        const demo = demoOn(THREE);
        let t = 0;
        while (demo.phase !== 'fading-in' && t < 200000) demo.tick((t += 10));
        expect(demo.phase).toBe('fading-in');
        expect(demo.lines).toBe(0);
        expect(demo.state.history).toEqual([]);
    });
});

describe('Demo without a plan', () => {
    it('rebuilds the board 500 ms after the wait began when there is no way to clear a line', () => {
        const demo = demoOn(THREE, { planner: () => null });
        expect(demo.tick(499)).toBeNull();
        expect(demo.tick(500)).toEqual({ kind: 'fade-out' });
    });

    it('rebuilds on a board with nothing to clear (the real solver finds no plan)', () => {
        const demo = demoOn(['.....', '.....', '.....', '.....', '.....', '..@..']);
        expect(demo.tick(499)).toBeNull();
        expect(demo.tick(500)).toEqual({ kind: 'fade-out' });
    });

    it('waits for a plan that is still being computed and moves as soon as it is ready', () => {
        let ready = false;
        const planner: Planner = (s) => (ready ? solverPlanner(s) : 'pending');
        const demo = demoOn(THREE, { planner });
        expect(demo.tick(500)).toBeNull();
        expect(demo.tick(600)).toBeNull();
        expect(demo.phase).toBe('waiting');
        ready = true;
        expect(demo.tick(700)?.kind).toBe('move');
    });

    it('asks for the plan on the frame after the wait began, not on the frame of the clear itself', () => {
        let calls = 0;
        const planner: Planner = (s) => {
            calls++;
            return solverPlanner(s);
        };
        const demo = demoOn(THREE, { planner });
        demo.tick(0);
        expect(calls).toBe(0);
        demo.tick(1);
        expect(calls).toBe(1);
        demo.tick(2);
        expect(calls).toBe(1);
    });

    it('uses a plan that finished before the wait ended at the end of the wait', () => {
        let ready = false;
        const planner: Planner = (s) => (ready ? solverPlanner(s) : 'pending');
        const demo = demoOn(THREE, { planner });
        expect(demo.tick(100)).toBeNull();
        ready = true;
        expect(demo.tick(300)).toBeNull();
        expect(demo.tick(499)).toBeNull();
        expect(demo.tick(500)?.kind).toBe('move');
    });

    it('plans again when a planned move cannot be played', () => {
        let calls = 0;
        const planner: Planner = () => {
            calls++;
            return ['up'];
        };
        const demo = demoOn(TOP, { planner });
        expect(demo.tick(500)).toBeNull();
        expect(demo.phase).toBe('waiting');
        expect(render(demo.state)).toEqual(TOP);
        expect(demo.tick(1000)).toBeNull();
        expect(calls).toBe(2);
    });

    it('plans again when a plan ends without clearing a line', () => {
        let calls = 0;
        const planner: Planner = () => {
            calls++;
            return ['down'];
        };
        const demo = demoOn(TOP, { planner });
        expect(demo.tick(500)?.kind).toBe('move');
        expect(demo.phase).toBe('waiting');
        expect(demo.tick(1000)?.kind).toBe('move');
        expect(calls).toBe(2);
    });

    it('treats an empty plan as nothing to play and plans again', () => {
        let calls = 0;
        const demo = demoOn(THREE, { planner: () => (calls++, []) });
        expect(demo.tick(500)).toBeNull();
        expect(demo.tick(1000)).toBeNull();
        expect(calls).toBe(2);
    });
});

describe('Demo run', () => {
    it('has no move budget: 60 moves that clear nothing never end the run', () => {
        // The board starts with 20 moves left, so an uncapped budget would run out after 20 of these.
        const plan = Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? 'left' : 'right') as 'left' | 'right');
        const demo = demoOn(TOP, { planner: () => plan });
        let moves = 0;
        for (let t = 500; moves < 60; t += 220) {
            const e = demo.tick(t);
            expect(e?.kind).toBe('move');
            if (e?.kind === 'move') expect(e.result.moved).toBe(true);
            expect(demo.state.over).toBe(false);
            moves++;
        }
        expect(demo.lines).toBe(0);
    });

    it('never runs out of moves: 100 moves in a row, no game over, no undo history', () => {
        const demo = new Demo({ rng: seeded(11), now: frozenClock }, 0);
        let moves = 0;
        for (let t = 10; moves < 100 && t < 3000000; t += 10) {
            const e = demo.tick(t);
            if (e?.kind !== 'move') continue;
            moves++;
            expect(demo.state.over).toBe(false);
            expect(demo.state.history).toHaveLength(0);
        }
        expect(moves).toBe(100);
    });

    it('does not touch another game: running the demo first leaves a same-seed game board unchanged', () => {
        // The reference is made BEFORE the demo runs; shared module state changed by the demo would show up.
        const reference: State = createState({ rng: seeded(42), now: frozenClock });
        let demoDraws = 0;
        const rng = seeded(99);
        const demo = new Demo({ rng: () => (demoDraws++, rng()), now: frozenClock }, 0);
        let fades = 0;
        for (let t = 10; t < 40000; t += 10) if (demo.tick(t)?.kind === 'fade-in') fades++;
        expect(fades).toBeGreaterThan(0); // the run went through at least one board swap
        expect(demoDraws).toBeGreaterThan(0); // and used its own random source
        const game: State = createState({ rng: seeded(42), now: frozenClock });
        expect(render(game)).toEqual(render(reference));
        expect(game.score).toBe(0);
        expect(game.grid.flat().includes(EMPTY)).toBe(true);
    });

    it('with the real solver every wait ends in a clear: no plan runs out or fails to play', () => {
        const demo = new Demo({ rng: seeded(5), now: frozenClock }, 0);
        let moves = 0;
        for (let t = 10; t < 60000; t += 10) {
            const e = demo.tick(t);
            if (e?.kind !== 'move') continue;
            moves++;
            // a move that clears starts a wait; any other move leaves the plan going
            expect(demo.phase).toBe(cleared(e) ? 'waiting' : 'stepping');
        }
        expect(moves).toBeGreaterThan(10);
    });
});
