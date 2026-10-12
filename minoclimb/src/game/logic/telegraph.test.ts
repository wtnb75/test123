import { describe, expect, it } from 'vitest';
import { P } from '../params';
import type { Plan } from './ai';
import { remainingTurns, telegraphView } from './telegraph';
import { shapeCells } from './pieces';

const key = (cells: readonly { c: number; r: number }[]): string =>
    cells.map(({ c, r }) => `${c},${r}`).sort().join(' ');

describe('remainingTurns', () => {
    it('is 3 at the start and counts down one per ROTATE_STEP', () => {
        expect(remainingTurns(0)).toBe(3);
        expect(remainingTurns(P.ROTATE_STEP - 0.01)).toBe(3);
        expect(remainingTurns(P.ROTATE_STEP)).toBe(2);
        expect(remainingTurns(P.ROTATE_STEP * 2)).toBe(1);
    });

    it('reaches 0 at exactly ROTATE_STEP * 3 despite floating point error', () => {
        // 0.6 / 0.2 evaluates to 2.9999999999999996 in IEEE doubles.
        expect(0.6 / 0.2).toBeLessThan(3);
        expect(remainingTurns(0.6)).toBe(0);
        expect(remainingTurns(0.599)).toBe(1);
    });

    it('stays at 0 until the telegraph ends', () => {
        expect(remainingTurns(P.TELEGRAPH_TIME)).toBe(0);
        expect(remainingTurns(5)).toBe(0);
    });
});

describe('telegraphView', () => {
    const plan: Plan = { kind: 2, rot: 2, col: 4, row: 10 };

    it('starts three rotations before the final orientation', () => {
        expect(telegraphView(plan, 0).rot).toBe(3);
        expect(telegraphView(plan, 0.2).rot).toBe(0);
        expect(telegraphView(plan, 0.4).rot).toBe(1);
    });

    it('shows the final orientation from ROTATE_STEP * 3 on and keeps it', () => {
        for (const t of [0.6, 0.75, P.TELEGRAPH_TIME]) {
            const view = telegraphView(plan, t);
            expect(view.rot).toBe(2);
            expect(key(view.cells)).toBe(key(shapeCells(2, 2)));
            expect(view.col).toBe(4);
        }
    });

    it('wraps the starting orientation for a final rotation of 0', () => {
        expect(telegraphView({ ...plan, rot: 0 }, 0).rot).toBe(1);
    });

    it('pulls the column in so a wide orientation stays inside the field', () => {
        // Final: vertical I at the last column; the first shown orientation is horizontal (width 4).
        const edge: Plan = { kind: 0, rot: 1, col: P.COLS - 1, row: 10 };
        const start = telegraphView(edge, 0);
        expect(start.rot).toBe(2); // (1 - 3 + 4) % 4 = 2, a horizontal I
        expect(start.col).toBe(P.COLS - 4);
        expect(telegraphView(edge, P.TELEGRAPH_TIME).col).toBe(P.COLS - 1);
    });
});
