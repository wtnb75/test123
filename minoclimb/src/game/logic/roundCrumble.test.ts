// Stuck-crumble wired into the round (docs/spec/stuck-crumble.md, "同じフレームの処理順").
import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { shapeCells } from './pieces';
import { type MoveInput, type Player } from './player';
import { Round, type RoundOptions } from './round';

const NONE: MoveInput = { left: false, right: false, jump: false };
const DT = 1 / 60;
const O = 1;
const I = 0;

const fillRow = (round: Round, r: number, gaps: readonly number[] = []): void => {
    for (let c = 0; c < P.COLS; c++) if (!gaps.includes(c)) round.grid[r][c] = 1;
};

/** The climber standing with the feet on the top edge of row `feetRow` (ROWS = the floor under the last row). */
const standingOnTop = (x: number, feetRow: number): Player => ({ x, y: feetRow - P.PLAYER_H - 1e-6, vy: 0, onGround: true });

/** Spec example A, with the climber inside and no mino coming (the next one is held back for good). */
const sealedRound = (options?: RoundOptions): Round => {
    const round = new Round(() => 0.9, options);
    for (let r = 15; r <= 19; r++) fillRow(round, r, r === 15 ? [] : [4, 5]);
    round.player = standingOnTop(4.15, P.ROWS);
    round.flow = { kind: 'wait', timer: 1e9 };
    return round;
};

const frames = (round: Round, n: number): void => {
    for (let i = 0; i < n; i++) round.step(DT, NONE);
};

describe('Round with a sealed-in climber', () => {
    it('starts the warning on the 60th frame and removes the cell on the 180th', () => {
        const round = sealedRound();
        frames(round, 59);
        expect(round.crumble.target).toBeNull();
        frames(round, 1);
        expect(round.crumble.target).toEqual({ c: 4, r: 15, t: 0 });
        frames(round, 119);
        expect(round.crumble.target).not.toBeNull();
        expect(round.grid[15][4]).toBe(1);
        frames(round, 1);
        expect(round.grid[15][4]).toBe(0);
        expect(round.crumble.target).toBeNull();
        expect(round.status).toBe('playing');
    });

    it('stays quiet once the crumble has opened the pocket', () => {
        const round = sealedRound();
        frames(round, 400);
        expect(round.crumble.removed).toBe(1);
        expect(round.crumble.target).toBeNull();
        expect(round.crumble.sealedFor).toBe(0);
    });

    it('does nothing at all when the crumble is switched off', () => {
        const round = sealedRound({ crumble: false });
        frames(round, 400);
        expect(round.crumble.target).toBeNull();
        expect(round.crumble.removed).toBe(0);
        expect(round.grid[15][4]).toBe(1);
    });

    it('counts a long frame at MAX_DT, like the rest of the round', () => {
        const round = sealedRound();
        for (let i = 0; i < 20; i++) round.step(1, NONE); // each counts as MAX_DT = 0.05 s: 20 steps = 1 s
        expect(round.crumble.target).toEqual({ c: 4, r: 15, t: 0 });
    });
});

describe('Round: the frame that ends the round does not advance the crumble', () => {
    /** A warning one frame from vanishing, and a mino that tops out on this very frame (or, as a control, none). */
    const nearlyGone = (topsOut: boolean): Round => {
        const round = sealedRound();
        round.grid[3][0] = 1; // a stump the mino lands on, so it locks at row 1 (above TOP_OUT_ROW)
        round.crumble.target = { c: 4, r: 15, t: P.CRUMBLE_TIME - DT / 2 };
        if (topsOut) {
            round.flow = {
                kind: 'drop',
                piece: { kind: O, rot: 0, cells: shapeCells(O, 0), col: 0, y: 1 },
                plan: { kind: O, rot: 0, col: 0, row: 1 },
            };
        }
        return round;
    };

    it('control: the same warning does remove the cell on an ordinary frame', () => {
        const round = nearlyGone(false);
        frames(round, 1);
        expect(round.status).toBe('playing');
        expect(round.grid[15][4]).toBe(0);
    });

    it('leaves the warning frozen on the frame a mino tops out', () => {
        const round = nearlyGone(true);
        frames(round, 1);
        expect(round.status).toBe('lost');
        expect(round.loseReason).toBe('toppedOut');
        expect(round.grid[15][4]).toBe(1);
        expect(round.crumble.target).toEqual({ c: 4, r: 15, t: P.CRUMBLE_TIME - DT / 2 });
    });

    it('stays frozen on later steps after the round ended', () => {
        const round = nearlyGone(true);
        frames(round, 5);
        expect(round.grid[15][4]).toBe(1);
        expect(round.crumble.target?.t).toBe(P.CRUMBLE_TIME - DT / 2);
    });
});

describe('Round: a line clear while the warning blinks', () => {
    /**
     * A roof (row 14, columns 4-5), a pocket (columns 4-5, rows 15-16) and a full floor row 17 that clears at the
     * next lock. The blinking cell is the roof cell (4,14); the floor row is below it.
     */
    const roofed = (hesitate = true): Round => {
        const round = new Round(() => 0.9, { hesitate });
        fillRow(round, 14, [0, 1, 2, 3, 6, 7, 8, 9]);
        fillRow(round, 15, [4, 5]);
        fillRow(round, 16, [4, 5]);
        fillRow(round, 17);
        round.player = standingOnTop(4.15, 17);
        round.flow = { kind: 'wait', timer: 1e9 };
        return round;
    };

    it('picks the roof cell first (cost 1, not under the feet, highest row)', () => {
        const round = roofed();
        frames(round, 60);
        expect(round.crumble.target).toEqual({ c: 4, r: 14, t: 0 });
    });

    it('moves the blinking cell down with the stack when a row below it clears, keeping its time', () => {
        const round = roofed(false);
        frames(round, 60);
        // An I mino lands flat on columns 0-3 (row 14); the lock clears the full floor row 17.
        round.flow = {
            kind: 'drop',
            piece: { kind: I, rot: 0, cells: shapeCells(I, 0), col: 0, y: 0 },
            plan: { kind: I, rot: 0, col: 0, row: 14 },
        };
        let guard = 0;
        while (round.flow.kind === 'drop' && guard++ < 200) round.step(DT, NONE);
        expect(round.status).toBe('playing');
        expect(round.grid[15][4]).toBe(1); // the roof cell now sits one row lower
        expect(round.crumble.target).toMatchObject({ c: 4, r: 15 });
        expect(round.crumble.target!.t).toBeGreaterThan(0);
        expect(round.crumble.target!.t).toBeLessThan(P.CRUMBLE_TIME);
    });

    it('keeps counting the time sealed in across a lock and a line clear (nothing is reset)', () => {
        // Without the hesitating drop, so the count is only the frames of this test.
        const round = roofed(false);
        frames(round, 30);
        expect(round.crumble.sealedFor).toBeCloseTo(30 * DT, 9);
        round.flow = {
            kind: 'drop',
            piece: { kind: I, rot: 0, cells: shapeCells(I, 0), col: 0, y: 0 },
            plan: { kind: I, rot: 0, col: 0, row: 14 },
        };
        let k = 0;
        while (round.flow.kind === 'drop' && k < 200) {
            round.step(DT, NONE);
            k++;
        }
        expect(30 + k).toBeLessThan(60); // still before the warning would start
        expect(round.crumble.sealedFor).toBeCloseTo((30 + k) * DT, 9);
        expect(round.crumble.target).toBeNull();
        frames(round, 60 - (30 + k));
        expect(round.crumble.target).not.toBeNull(); // the 60th sealed frame overall
    });
});

describe('Round: the warning restarts on the same frame when a clear removes its row', () => {
    /**
     * A three-thick roof (rows 12-14, columns 4-5) over a pocket (columns 4-5, rows 15-16). The warning is set by
     * hand on the roof cell (4,14), whose row an I mino completes (the natural choice would be elsewhere).
     */
    const thickRoof = (): Round => {
        const round = new Round(() => 0.9);
        fillRow(round, 12, [0, 1, 2, 3, 6, 7, 8, 9]);
        fillRow(round, 13, [0, 1, 2, 3, 6, 7, 8, 9]);
        fillRow(round, 14, [0, 1, 2, 3]); // cols 4-9 solid: the I mino at columns 0-3 completes the row
        fillRow(round, 15, [4, 5]);
        fillRow(round, 16, [4, 5]);
        fillRow(round, 17, [0]); // a floor with a gap that stays closed off: it never fills up
        round.player = standingOnTop(4.15, 17);
        round.flow = { kind: 'wait', timer: 1e9 };
        return round;
    };

    it('drops the stale warning and starts a new one at t = 0 on the cheapest cell of the shifted board', () => {
        const round = thickRoof();
        round.crumble.sealedFor = P.STUCK_TIME;
        round.crumble.target = { c: 4, r: 14, t: 0.4 };
        round.flow = {
            kind: 'drop',
            piece: { kind: I, rot: 0, cells: shapeCells(I, 0), col: 0, y: 0 },
            plan: { kind: I, rot: 0, col: 0, row: 14 },
        };
        let guard = 0;
        while (round.flow.kind === 'drop' && guard++ < 200) round.step(DT, NONE);
        expect(round.status).toBe('playing');
        // Row 14 is gone and the roof moved down one row (rows 13-14 now); the pocket is still closed.
        expect(round.grid[14][4]).toBe(1);
        expect(round.grid[12][4]).toBe(0);
        // Both (4,14) (its left neighbour is open) and (3,15) cost 1; the higher row wins. The warning is new: t = 0, not 0.4.
        expect(round.crumble.target).toEqual({ c: 4, r: 14, t: 0 });
    });
});

describe('Round: the frames that end a round by a crush or by reaching the goal', () => {
    /** A pocket at the goal: roof row 3, pocket columns 4-5 rows 4-5, floor row 6. The climber hangs inside it. */
    const goalPocket = (y: number): Round => {
        const round = new Round(() => 0.9);
        fillRow(round, 3);
        fillRow(round, 4, [4, 5]);
        fillRow(round, 5, [4, 5]);
        fillRow(round, 6);
        round.player = { x: 4.15, y, vy: 0, onGround: false };
        round.flow = { kind: 'wait', timer: 1e9 };
        round.crumble.sealedFor = P.STUCK_TIME;
        round.crumble.target = { c: 4, r: 3, t: P.CRUMBLE_TIME - DT / 2 };
        return round;
    };

    it('control: below the goal height the same warning removes the cell', () => {
        const round = goalPocket(4.2); // feet at 5.1: lower than the goal line (5.01 at most), so no clear
        frames(round, 1);
        expect(round.status).toBe('playing');
        expect(round.grid[3][4]).toBe(0);
    });

    it('does not remove the cell on the frame the climber reaches the goal', () => {
        const round = goalPocket(4.0); // feet at 4.9, within GOAL_TOL of the goal line after the frame
        frames(round, 1);
        expect(round.status).toBe('cleared');
        expect(round.grid[3][4]).toBe(1);
        expect(round.crumble.target?.t).toBe(P.CRUMBLE_TIME - DT / 2);
    });

    it('does not remove the cell on the frame a falling mino crushes the climber', () => {
        const round = sealedRound();
        round.crumble.sealedFor = P.STUCK_TIME;
        round.crumble.target = { c: 4, r: 15, t: P.CRUMBLE_TIME - DT / 2 };
        round.flow = {
            kind: 'drop',
            piece: { kind: O, rot: 0, cells: shapeCells(O, 0), col: 4, y: 17.5 },
            plan: { kind: O, rot: 0, col: 4, row: 18 },
        };
        frames(round, 1);
        expect(round.status).toBe('lost');
        expect(round.loseReason).toBe('crushed');
        expect(round.grid[15][4]).toBe(1);
        expect(round.crumble.target?.t).toBe(P.CRUMBLE_TIME - DT / 2);
    });
});

describe('Round: the crumble draws no random numbers', () => {
    /** Example A without a full row (a gap at (0,15) outside the pocket), played with the real mino flow. */
    const play = (crumble: boolean): { draws: number; removed: number } => {
        let draws = 0;
        const round = new Round(() => {
            draws++;
            return 0.9;
        }, { crumble });
        for (let r = 15; r <= 19; r++) fillRow(round, r, r === 15 ? [0] : [4, 5]);
        round.player = standingOnTop(4.15, P.ROWS);
        for (let i = 0; i < 600 && round.status === 'playing'; i++) round.step(DT, NONE);
        return { draws, removed: round.crumble.removed };
    };

    it('asks the random source exactly as often with the crumble on as off, and the crumble does act', () => {
        const off = play(false);
        const on = play(true);
        expect(off.draws).toBeGreaterThan(1);
        expect(on.draws).toBe(off.draws);
        expect(off.removed).toBe(0);
        expect(on.removed).toBeGreaterThanOrEqual(1);
    });
});
