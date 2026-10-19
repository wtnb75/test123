import { describe, expect, it } from 'vitest';
import { P } from '../params';
import type { Plan } from './ai';
import { createGrid } from './board';
import { demoBot } from './demoBot';
import type { Player } from './player';

const I = 0;

const standing = (col: number): Player => ({
    x: col + 0.5 - P.PLAYER_W / 2,
    y: P.ROWS - P.PLAYER_H - 1e-6,
    vy: 0,
    onGround: true,
});

// The landing frame follows the displayed mino, but the demo bot keeps reading the chosen (final) landing.
describe('demoBot: reads the final landing, not the displayed (still turning) mino', () => {
    // I, final vertical (rot 1) at col 8: one turn, displayed flat (cols 6-9) until 0.30, then column 8 only.
    const plan = { kind: I, rot: 1, col: 8, row: 16 } as Plan;
    const move = (col: number, t: number) =>
        demoBot({ grid: createGrid(), player: standing(col), flow: { kind: 'telegraph', plan, t } }, 0);

    it('gives the same move at every time of the telegraph, even while the mino is still turning', () => {
        const early = move(8, 0);
        expect(early.left || early.right).toBe(true); // standing in the final column 8, it steps away
        for (const t of [0.1, 0.29, 0.3, 0.6, P.TELEGRAPH_TIME]) expect(move(8, t)).toEqual(early);
    });

    it('does not run from a column only the displayed flat mino covers (the final one is column 8 only)', () => {
        const early = move(6, 0);
        expect(early).toEqual(move(6, 0.6));
        expect(early.jump).toBe(false);
    });
});
