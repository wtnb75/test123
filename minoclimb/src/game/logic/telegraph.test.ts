import { describe, expect, it } from 'vitest';
import { P } from '../params';
import type { Plan } from './ai';
import { remainingTurns, telegraphView, turnCount } from './telegraph';
import { KIND_COUNT, ROTATION_COUNT, shapeCells } from './pieces';

const key = (cells: readonly { c: number; r: number }[]): string =>
    cells.map(({ c, r }) => `${c},${r}`).sort().join(' ');

const plan = (kind: number, rot: number, col: number): Plan => ({ kind, rot, col, row: 10 });

describe('turnCount', () => {
    // Hand-worked from docs/spec.md: n = (3 * kind + 5 * rot + 7 * col) mod 4, kinds I=0 O=1 T=2 S=3 Z=4 J=5 L=6.
    it.each([
        ['Z, rot 2, col 1 (12 + 10 + 7 = 29)', plan(4, 2, 1), 1],
        ['T, rot 1, col 4 (6 + 5 + 28 = 39)', plan(2, 1, 4), 3],
        ['I, rot 0, col 0 (0)', plan(0, 0, 0), 0],
        ['O, rot 2, col 5 (3 + 10 + 35 = 48)', plan(1, 2, 5), 0],
        ['L, rot 3, col 2 (18 + 15 + 14 = 47)', plan(6, 3, 2), 3],
        ['I, rot 2, col 0 (10)', plan(0, 2, 0), 2],
    ])('is the spec value for %s', (_name, p, expected) => {
        expect(turnCount(p)).toBe(expected);
    });

    it('gives all four turn counts as the final rotation goes 0..3 for the same kind and column', () => {
        for (let kind = 0; kind < KIND_COUNT; kind++) {
            for (let col = 0; col < P.COLS; col++) {
                const counts = new Set([0, 1, 2, 3].map((rot) => turnCount(plan(kind, rot, col))));
                expect(counts.size).toBe(4);
            }
        }
    });

    it('is deterministic: the same plan always spins the same way', () => {
        expect(turnCount(plan(5, 3, 7))).toBe(turnCount(plan(5, 3, 7)));
    });

    it('stays within 0-3 for every reachable plan', () => {
        for (let kind = 0; kind < KIND_COUNT; kind++) {
            for (let rot = 0; rot < ROTATION_COUNT; rot++) {
                for (let col = 0; col < P.COLS; col++) {
                    const n = turnCount(plan(kind, rot, col));
                    if (!Number.isInteger(n) || n < 0 || n > 3) expect.fail(`n=${n} for ${kind}/${rot}/${col}`);
                }
            }
        }
    });
});

describe('ROTATE_TIMES', () => {
    it('has n turn times for n turns, increasing, all done by 0.6 s', () => {
        for (let n = 0; n <= 3; n++) {
            const times = P.ROTATE_TIMES[n];
            expect(times).toHaveLength(n);
            for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
            if (n > 0) expect(times[n - 1]).toBeLessThanOrEqual(0.6);
        }
    });

    it('has one row per possible turn count, matching the modulus turnCount uses', () => {
        expect(P.ROTATE_TIMES).toHaveLength(ROTATION_COUNT);
    });

    it('slows down before stopping: each gap is longer than the one before (3 turns: 0.14, 0.20, 0.26)', () => {
        const [a, b, c] = P.ROTATE_TIMES[3];
        expect(a).toBeCloseTo(0.14, 10);
        expect(b - a).toBeCloseTo(0.2, 10);
        expect(c - b).toBeCloseTo(0.26, 10);
    });
});

describe('remainingTurns', () => {
    it('is 0 for a mino that makes no turns, at any time', () => {
        expect(remainingTurns(0, 0)).toBe(0);
        expect(remainingTurns(0, 0.5)).toBe(0);
    });

    it('counts down at 0.14, 0.34 and 0.6 for 3 turns, not before', () => {
        expect(remainingTurns(3, 0)).toBe(3);
        expect(remainingTurns(3, 0.14 - 1e-3)).toBe(3);
        expect(remainingTurns(3, 0.14)).toBe(2);
        expect(remainingTurns(3, 0.34 - 1e-3)).toBe(2);
        expect(remainingTurns(3, 0.34)).toBe(1);
        expect(remainingTurns(3, 0.6 - 1e-3)).toBe(1);
        expect(remainingTurns(3, 0.6)).toBe(0);
    });

    it('counts down at 0.20 and 0.45 for 2 turns', () => {
        expect(remainingTurns(2, 0)).toBe(2);
        expect(remainingTurns(2, 0.2 - 1e-3)).toBe(2);
        expect(remainingTurns(2, 0.2)).toBe(1);
        expect(remainingTurns(2, 0.45 - 1e-3)).toBe(1);
        expect(remainingTurns(2, 0.45)).toBe(0);
    });

    it('turns once at 0.30 for 1 turn', () => {
        expect(remainingTurns(1, 0.3 - 1e-3)).toBe(1);
        expect(remainingTurns(1, 0.3)).toBe(0);
    });

    it('does not lose a turn to floating point error at the exact turn times', () => {
        // x - 1e-12 stands for an arrival a hair early, as a sum of float steps can be.
        expect(remainingTurns(1, 0.3 - 1e-12)).toBe(0);
        expect(remainingTurns(3, 0.14 - 1e-12)).toBe(2);
        expect(remainingTurns(3, 0.34 - 1e-12)).toBe(1);
        expect(remainingTurns(3, 0.6 - 1e-12)).toBe(0);
    });

    it('pins the 1e-9 tolerance: 5e-10 early counts as arrived, 2e-9 early does not', () => {
        expect(remainingTurns(1, 0.3 - 5e-10)).toBe(0);
        expect(remainingTurns(1, 0.3 - 2e-9)).toBe(1);
        expect(remainingTurns(3, 0.6 - 5e-10)).toBe(0);
        expect(remainingTurns(3, 0.6 - 2e-9)).toBe(1);
    });

    it('stays at 0 until the telegraph ends', () => {
        for (const n of [0, 1, 2, 3]) {
            expect(remainingTurns(n, P.TELEGRAPH_TIME)).toBe(0);
            expect(remainingTurns(n, 5)).toBe(0);
        }
    });
});

describe('telegraphView', () => {
    it('shows a 3-turn mino three rotations before the final orientation, then turns at 0.14, 0.34 and 0.6', () => {
        const p = plan(2, 1, 4); // T, n = 3, final rot 1
        expect(telegraphView(p, 0).rot).toBe(2); // (1 - 3 + 4) % 4
        expect(telegraphView(p, 0.14 - 1e-3).rot).toBe(2);
        expect(telegraphView(p, 0.14).rot).toBe(3);
        expect(telegraphView(p, 0.34).rot).toBe(0);
        expect(telegraphView(p, 0.6 - 1e-3).rot).toBe(0);
        expect(telegraphView(p, 0.6).rot).toBe(1);
    });

    it('shows a 2-turn mino starting two rotations early, turning at 0.20 and 0.45', () => {
        const p = plan(0, 2, 0); // I, n = 2, final rot 2
        expect(telegraphView(p, 0).rot).toBe(0);
        expect(telegraphView(p, 0.2).rot).toBe(1);
        expect(telegraphView(p, 0.45 - 1e-3).rot).toBe(1);
        expect(telegraphView(p, 0.45).rot).toBe(2);
    });

    it('shows a 1-turn mino one rotation early, turning at 0.30', () => {
        const p = plan(4, 2, 1); // Z, n = 1, final rot 2
        expect(telegraphView(p, 0).rot).toBe(1);
        expect(telegraphView(p, 0.3 - 1e-3).rot).toBe(1);
        expect(telegraphView(p, 0.3).rot).toBe(2);
    });

    it('shows a mino with no turns in its final orientation from the first moment', () => {
        const p = plan(0, 0, 0); // I, n = 0
        for (const t of [0, 0.1, 0.5, P.TELEGRAPH_TIME]) expect(telegraphView(p, t).rot).toBe(0);
    });

    it('wraps the starting orientation below 0', () => {
        // Z, rot 0, col 3: (12 + 0 + 21) % 4 = 1 turn, so it starts at (0 - 1 + 4) % 4 = 3.
        expect(telegraphView(plan(4, 0, 3), 0).rot).toBe(3);
    });

    it('shows the final orientation, cells and column from 0.6 s on and keeps it, for every plan', () => {
        for (let kind = 0; kind < KIND_COUNT; kind++) {
            for (let rot = 0; rot < ROTATION_COUNT; rot++) {
                for (let col = 0; col < P.COLS; col++) {
                    for (const t of [0.6, 0.75, P.TELEGRAPH_TIME]) {
                        const view = telegraphView(plan(kind, rot, col), t);
                        const finalWidth = Math.max(...shapeCells(kind, rot).map((cell) => cell.c)) + 1;
                        if (view.rot !== rot || key(view.cells) !== key(shapeCells(kind, rot))) {
                            expect.fail(`not final at t=${t} for ${kind}/${rot}/${col}`);
                        }
                        if (view.col !== Math.min(col, P.COLS - finalWidth)) expect.fail(`column moved for ${kind}/${rot}/${col}`);
                    }
                }
            }
        }
    });

    it('pulls the column in so a wide orientation stays inside the field', () => {
        // I, final vertical (rot 1) at col 8: (0 + 5 + 56) % 4 = 1 turn, so it starts horizontal (rot 0, width 4).
        const edge = plan(0, 1, 8);
        const start = telegraphView(edge, 0);
        expect(start.rot).toBe(0);
        expect(start.col).toBe(P.COLS - 4);
        expect(telegraphView(edge, P.TELEGRAPH_TIME).col).toBe(8);
    });
});
