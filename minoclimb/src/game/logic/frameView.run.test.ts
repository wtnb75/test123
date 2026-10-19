import { describe, expect, it } from 'vitest';
import { P } from '../params';
import type { Plan } from './ai';
import { createGrid } from './board';
import { demoBot } from './demoBot';
import { Round } from './round';
import { frameView } from './telegraph';
import { shapeCells } from './pieces';

const seeded = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const DT = 1 / 60;

/** One bot-driven run; `watch` also asks for the landing frame every frame, as the Scene does. */
const run = (seed: number, watch: boolean) => {
    const rng = seeded(seed);
    let draws = 0;
    const round = new Round(() => {
        draws++;
        return rng();
    });
    const plans: Plan[] = [];
    let frames = 0;
    for (; frames < 60 * 20 && round.status === 'playing'; frames++) {
        const { flow } = round;
        if (watch && flow.kind === 'telegraph') {
            const planBefore = { ...flow.plan };
            const gridBefore = round.grid.map((row) => [...row]);
            frameView(round.grid, flow.plan, flow.t);
            // Asking for the frame never changes the plan or the board.
            expect(flow.plan).toEqual(planBefore);
            expect(round.grid).toEqual(gridBefore);
        }
        if (flow.kind === 'telegraph' && flow.t === 0) plans.push({ ...flow.plan });
        round.step(DT, demoBot({ grid: round.grid, player: round.player, flow }, frames * DT));
    }
    return { status: round.status, maxHeight: round.maxHeight, draws, plans, frames };
};

describe('landing frame follows the mino without touching the round (seeded runs)', () => {
    it.each([1, 2, 3, 4, 5, 6, 7, 8])('seed %i: plans, random draws, end frame, state and height are the same', (seed) => {
        const plain = run(seed, false);
        const watched = run(seed, true);
        expect(plain.plans.length).toBeGreaterThan(0);
        expect(watched).toEqual(plain);
    });
});

describe('frameView at the turn times of a 3-turn mino', () => {
    // T (kind 2), final rot 1, col 4: n = 3. Displayed rot is final - remaining turns (mod 4).
    const plan = { kind: 2, rot: 1, col: 4, row: 12 } as Plan;
    const key = (cells: readonly { c: number; r: number }[]): string =>
        cells.map(({ c, r }) => `${c},${r}`).sort().join(' ');

    it.each([
        [0.13, 2],
        [0.14, 3],
        [0.33, 3],
        [0.34, 0],
        [0.59, 0],
        [0.6, 1],
    ])('at t = %f the frame has rotation %i of the T', (t, rot) => {
        expect(key(frameView(createGrid(), plan, t).cells)).toBe(key(shapeCells(2, rot)));
    });

    it('shifts the frame column right so a wide displayed shape stays in the field', () => {
        // I, final vertical (rot 1) at col 8: one turn, displayed flat (width 4) until 0.30, so it sits at col 6.
        const wide = { kind: 0, rot: 1, col: 8, row: 16 } as Plan;
        expect(frameView(createGrid(), wide, 0).col).toBe(P.COLS - 4);
        expect(frameView(createGrid(), wide, 0.3).col).toBe(8);
    });
});
