// docs/spec/rising.md: priorities in one frame, the second period, randomness independence, and the AI/regression
// conditions of the "テスト観点".
import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { rankPlacements } from './ai';
import { createGrid, type Grid, type Piece } from './board';
import { flashAlpha } from './effects';
import { shapeCells } from './pieces';
import type { MoveInput, Player } from './player';
import { Round, type RoundOptions } from './round';
import { riseDue } from './rising';

const O = 1;
const NONE: MoveInput = { left: false, right: false, jump: false };
const DT = 0.05;
const FRAME = 1 / 60;
const sky: Player = { x: 8, y: 5, vy: 0, onGround: false };

const piece = (col: number, y: number): Piece => ({ kind: O, rot: 0, cells: shapeCells(O, 0), col, y });
const newRound = (options: RoundOptions = {}, rng: () => number = () => 0.9): Round =>
    new Round(rng, { rising: true, riseRng: () => 0.35, crumble: false, ...options });
const lockAt = (round: Round, col: number, y: number, row: number): void => {
    round.flow = { kind: 'drop', piece: piece(col, y), plan: { kind: O, rot: 0, col, row } };
};
const riseRows = (round: Round): number => round.grid.filter((row) => row.includes(P.RISE_CELL)).length;

describe('Round rising: the same frame as the goal', () => {
    const setup = (stackedCell: boolean): Round => {
        const round = newRound();
        // Falling from y = 3.9 for one frame puts the feet at about 4.9, above the goal line (row 5).
        round.player = { ...sky, y: 3.9 };
        if (stackedCell) round.grid[P.TOP_OUT_ROW][9] = 1;
        lockAt(round, 0, 17.9, 18);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        return round;
    };

    it('is cleared when the goal was reached and the rise stacks nothing too high (the baseline of the next test)', () => {
        expect(setup(false).status).toBe('cleared');
    });

    it('is lost, not cleared, when the rise stacks the field too high in the frame the goal was reached', () => {
        const round = setup(true);
        expect(round.status).toBe('lost');
        expect(round.loseReason).toBe('toppedOut');
    });
});

describe('Round rising: the second period', () => {
    // After the first rise, wait n - 1 idle frames, then let a mino lock in the nth frame (1/60 s each).
    const secondLock = (n: number): Round => {
        const round = newRound();
        round.player = sky;
        lockAt(round, 0, 17.9, 18);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(riseRows(round)).toBe(1);
        round.player = sky;
        round.flow = { kind: 'wait', timer: 1e9 };
        for (let i = 0; i < n - 1; i++) {
            round.player = sky;
            round.step(FRAME, NONE);
        }
        lockAt(round, 4, 17, 17); // resting on the risen row: locks at once
        round.step(FRAME, NONE);
        return round;
    };

    it('is not due 719 frames after the rise (11.98 s): the next lock does not rise', () => {
        const round = secondLock(719);
        expect(round.flow.kind).toBe('wait');
        expect(riseRows(round)).toBe(1);
    });

    it('is due 720 frames after the rise (12 s, nothing carried over): the next lock rises again', () => {
        const round = secondLock(720);
        expect(riseRows(round)).toBe(2);
        expect(round.riseElapsed).toBe(0);
    });

    it('counts exactly the interval after a rise, whatever the overrun was before it', () => {
        const round = newRound();
        round.player = sky;
        lockAt(round, 0, 17.9, 18);
        round.riseElapsed = P.RISE_INTERVAL + 7; // very overdue
        round.step(DT, NONE);
        round.flow = { kind: 'wait', timer: 1e9 };
        for (let i = 0; i < 719; i++) round.step(FRAME, NONE);
        expect(riseDue(round.riseElapsed)).toBe(false);
    });
});

describe('Round rising: before the interval the random source is not touched', () => {
    it('does not draw riseRng on a lock before the interval', () => {
        const round = newRound({ riseRng: () => { throw new Error('riseRng must not be drawn before the interval'); } });
        round.player = { ...sky };
        lockAt(round, 0, 17.9, 18);
        round.riseElapsed = 3;
        expect(() => round.step(DT, NONE)).not.toThrow();
        expect(round.flow.kind).toBe('wait');
    });
});

describe('Round rising: the hole value does not disturb the field random stream', () => {
    const run = (holeValue: number): { calls: number; kind: number | null } => {
        let calls = 0;
        const rng = (): number => { calls++; return 0.25; };
        const round = newRound({ riseRng: () => holeValue }, rng);
        round.player = { ...sky };
        lockAt(round, 0, 17.9, 18);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE); // lock and rise
        for (let i = 0; i < 100 && round.flow.kind !== 'telegraph'; i++) round.step(FRAME, NONE);
        const flow = round.flow;
        return { calls, kind: flow.kind === 'telegraph' ? flow.plan.kind : null };
    };

    it('uses the field rng the same number of times and picks the same mino kind, whichever column the hole is in', () => {
        const left = run(0);
        const right = run(0.99);
        expect(left.kind).not.toBeNull();
        expect(right.calls).toBe(left.calls);
        expect(right.kind).toBe(left.kind);
    });
});

describe('Round without rising: a long run is what it always was', () => {
    it('never rises in 50 s of play: no risen cell, no riseRng draw, a timer left at 0', () => {
        let drawn = 0;
        let seed = 99;
        const rng = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        const round = new Round(rng, { riseRng: () => { drawn++; return 0.5; } });
        let locks = 0;
        for (let i = 0; i < 3000 && round.status === 'playing'; i++) {
            // Held in the column the landing AI keeps open, just below the goal line, so that minos rarely reach it.
            round.player = { x: round.wellCol === 0 ? 0.15 : 9.15, y: 6, vy: 0, onGround: false };
            round.step(FRAME, NONE);
            round.drainEvents((e) => { if (e.kind === 'locked') locks++; });
            expect(round.grid.flat().includes(P.RISE_CELL)).toBe(false);
        }
        expect(locks).toBeGreaterThan(10);
        expect(drawn).toBe(0);
        expect(round.riseElapsed).toBe(0);
    });
});

describe('landing AI on risen cells', () => {
    const board = (cellValue: number): Grid => {
        const grid = createGrid();
        for (let c = 0; c < P.COLS; c++) if (c !== 3) grid[19][c] = cellValue; // a risen row, hole in column 3
        grid[18][5] = cellValue === P.RISE_CELL ? 4 : cellValue;
        grid[18][6] = cellValue === P.RISE_CELL ? 4 : cellValue;
        return grid;
    };

    it.each([0, 1, 2, 3, 4, 5, 6])('ranks kind %i the same on RISE_CELL cells as on ordinary cells', (kind) => {
        const withRise = rankPlacements(board(P.RISE_CELL), kind, 0);
        const ordinary = rankPlacements(board(2), kind, 0);
        expect(withRise.length).toBeGreaterThan(10);
        expect(withRise).toEqual(ordinary);
    });
});

describe('RISE_FLASH_TIME light', () => {
    it('is full at the start and exactly gone at RISE_FLASH_TIME, like the clear light', () => {
        expect(P.RISE_FLASH_TIME).toBe(P.CLEAR_FLASH_TIME);
        expect(flashAlpha(0, P.RISE_FLASH_TIME)).toBe(1);
        expect(flashAlpha(P.RISE_FLASH_TIME, P.RISE_FLASH_TIME)).toBe(0);
        expect(flashAlpha(P.RISE_FLASH_TIME / 2, P.RISE_FLASH_TIME)).toBeCloseTo(0.5, 12);
    });
});
