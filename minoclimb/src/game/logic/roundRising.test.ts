// docs/spec/rising.md: how a Round rises its field (timing, losing, clearing, events, randomness).
import { describe, expect, it } from 'vitest';
import { P } from '../params';
import type { Piece } from './board';
import { shapeCells } from './pieces';
import type { MoveInput, Player } from './player';
import { Round, type RoundEvent, type RoundOptions } from './round';
import { riseDue } from './rising';

const O = 1;
const NONE: MoveInput = { left: false, right: false, jump: false };
const DT = 0.05;
const HOLE_VALUE = 0.35; // column 3

const piece = (kind: number, rot: number, col: number, y: number): Piece => ({
    kind, rot, cells: shapeCells(kind, rot), col, y,
});
const floorStand = (x: number): Player => ({ x, y: P.ROWS - P.PLAYER_H - 1e-6, vy: 0, onGround: true });
const sky: Player = { x: 8, y: 5, vy: 0, onGround: false };
const cells = (...pairs: [number, number][]) => pairs.map(([c, r]) => ({ c, r }));
const drain = (round: Round): RoundEvent[] => {
    const out: RoundEvent[] = [];
    round.drainEvents((e) => out.push(e));
    return out;
};
const risenRows = (round: Round): number => round.grid.filter((row) => row.includes(P.RISE_CELL)).length;

const newRound = (options: RoundOptions = {}, rng: () => number = () => 0.9): Round =>
    new Round(rng, { rising: true, riseRng: () => HOLE_VALUE, crumble: false, ...options });

/** An O about to lock in rows 18-19 at columns 0-1 on the next frame. */
const readyToLock = (round: Round): void => {
    round.flow = { kind: 'drop', piece: piece(O, 0, 0, 17.9), plan: { kind: O, rot: 0, col: 0, row: 18 } };
};

describe('Round rising: when it happens', () => {
    it('does not rise on a lock before the interval has run out', () => {
        const round = newRound();
        round.player = floorStand(8);
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL - 2 * DT; // 11.9 + this frame's 0.05 = 11.95
        round.step(DT, NONE);
        expect(round.flow.kind).toBe('wait');
        expect(risenRows(round)).toBe(0);
        expect(drain(round).some((e) => e.kind === 'risen')).toBe(false);
        expect(round.riseElapsed).toBeCloseTo(11.95, 9);
    });

    it('rises on the very frame whose time reaches the interval, if a mino locks in it', () => {
        const round = newRound();
        round.player = floorStand(8);
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL - DT; // this frame's 0.05 makes exactly 12
        round.step(DT, NONE);
        expect(risenRows(round)).toBe(1);
    });

    it('puts the bottom row in, moves the fixed mino up, and restarts the timer from 0', () => {
        const round = newRound();
        round.player = floorStand(8);
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        const bottom = Array<number>(P.COLS).fill(P.RISE_CELL);
        bottom[3] = 0;
        expect(round.grid[P.ROWS - 1]).toEqual(bottom);
        // the O (kind 1, cell value 2) fixed in rows 18-19 sits in rows 17-18 now
        for (const r of [17, 18]) for (const c of [0, 1]) expect(round.grid[r][c]).toBe(2);
        expect(round.riseElapsed).toBe(0);
        round.step(DT, NONE);
        expect(round.riseElapsed).toBeCloseTo(DT, 12);
    });

    it('keeps the next preview on its normal schedule: SPAWN_DELAY after the lock, on the risen field', () => {
        const round = newRound();
        round.player = floorStand(8);
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(round.flow).toEqual({ kind: 'wait', timer: P.SPAWN_DELAY });
    });

    it('does not rise while a mino is previewed or falling, however overdue, but does at the lock', () => {
        const round = newRound();
        round.player = floorStand(8);
        round.riseElapsed = 50;
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 4), plan: { kind: O, rot: 0, col: 0, row: 18 } };
        let guard = 0;
        while (round.flow.kind === 'drop' && guard++ < 100) {
            expect(risenRows(round)).toBe(0);
            round.step(1 / 60, NONE);
        }
        expect(round.flow.kind).toBe('wait');
        expect(risenRows(round)).toBe(1);
        const waitingRound = newRound();
        waitingRound.player = floorStand(8);
        waitingRound.riseElapsed = 50;
        waitingRound.flow = { kind: 'telegraph', plan: { kind: O, rot: 0, col: 0, row: 18 }, t: 0 };
        waitingRound.step(DT, NONE);
        expect(risenRows(waitingRound)).toBe(0);
    });

    it('rises at the lock after a line clear of the same frame, on the field the clear left', () => {
        const round = newRound();
        round.player = sky;
        for (let c = 2; c < P.COLS; c++) round.grid[19][c] = 1;
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        // row 19 cleared, the O's upper half came down to row 19, then everything went up one row
        expect(round.grid[18][0]).toBe(2);
        expect(round.grid[18][1]).toBe(2);
        expect(round.grid[19].filter((v) => v === P.RISE_CELL)).toHaveLength(P.COLS - 1);
        expect(round.grid[17].every((v) => v === 0)).toBe(true);
    });

    it('does not rise when the lock crushes the climber, and leaves the timer alone', () => {
        const round = newRound();
        round.player = floorStand(0.05);
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(round.status).toBe('lost');
        expect(round.loseReason).toBe('crushed');
        expect(risenRows(round)).toBe(0);
        expect(round.riseElapsed).toBeCloseTo(P.RISE_INTERVAL + DT, 9);
    });

    it('does not rise when the lock itself stacks too high (the lock loses first)', () => {
        const round = newRound();
        round.player = floorStand(8);
        round.grid[3][0] = 1;
        round.grid[3][1] = 1;
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 0.9), plan: { kind: O, rot: 0, col: 0, row: 1 } };
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(round.status).toBe('lost');
        expect(round.loseReason).toBe('toppedOut');
        expect(risenRows(round)).toBe(0);
    });

    it('never rises in a round without the rising option, even with an old timer', () => {
        const round = new Round(() => 0.9, { riseRng: () => { throw new Error('riseRng must not be drawn'); } });
        round.player = floorStand(8);
        readyToLock(round);
        round.riseElapsed = 99;
        round.step(DT, NONE);
        expect(risenRows(round)).toBe(0);
        expect(round.riseElapsed).toBe(99);
    });
});

describe('Round rising: the timer in 1/60 s frames', () => {
    const idle = (): Round => {
        const round = newRound();
        round.flow = { kind: 'wait', timer: 1e9 }; // nothing falls: only the timer is looked at
        return round;
    };

    it('counts from the start: due on the 720th frame, not on the 719th', () => {
        const round = idle();
        for (let i = 0; i < 719; i++) round.step(1 / 60, NONE);
        expect(riseDue(round.riseElapsed)).toBe(false);
        round.step(1 / 60, NONE);
        expect(riseDue(round.riseElapsed)).toBe(true);
    });

    it('is a plain 0 in a round that does not rise', () => {
        const round = new Round(() => 0.9, { crumble: false });
        round.flow = { kind: 'wait', timer: 1e9 };
        for (let i = 0; i < 100; i++) round.step(1 / 60, NONE);
        expect(round.riseElapsed).toBe(0);
    });

    it('caps a long frame at MAX_DT like the rest of the round', () => {
        const round = idle();
        round.step(10, NONE);
        expect(round.riseElapsed).toBeCloseTo(P.MAX_DT, 12);
    });

    it('stops once the round has ended', () => {
        const round = idle();
        round.status = 'lost';
        round.step(DT, NONE);
        expect(round.riseElapsed).toBe(0);
    });
});

describe('Round rising: the climber and the goal', () => {
    it('pushes a climber standing on the floor up one cell', () => {
        const round = newRound();
        round.player = floorStand(8);
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(round.player.y).toBeCloseTo(P.ROWS - 1 - P.PLAYER_H, 4);
    });

    it('does not push when the rise stacks the field too high: the round is lost and nothing else happens', () => {
        const round = newRound();
        round.player = floorStand(8);
        round.grid[P.TOP_OUT_ROW][9] = 1;
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(round.status).toBe('lost');
        expect(round.loseReason).toBe('toppedOut');
        expect(round.player.y).toBeCloseTo(P.ROWS - P.PLAYER_H, 4);
        expect(round.riseElapsed).toBeCloseTo(P.RISE_INTERVAL + DT, 9);
        expect(drain(round)).toEqual([]);
    });

    it('survives when the highest cell lands exactly on TOP_OUT_ROW', () => {
        const round = newRound();
        round.player = floorStand(8);
        round.grid[P.TOP_OUT_ROW + 1][9] = 1;
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(round.status).toBe('playing');
        expect(round.grid[P.TOP_OUT_ROW][9]).toBe(1);
    });

    it('clears on the next frame, not the rising frame, when the push lifts the feet onto the goal', () => {
        const round = newRound();
        round.grid[6][8] = 1; // the stack top the climber stands on; it becomes row 5
        round.player = { x: 8.05, y: 6 - P.PLAYER_H - 1e-6, vy: 0, onGround: true };
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(round.status).toBe('playing');
        expect(round.player.y + P.PLAYER_H).toBeLessThanOrEqual(P.GOAL_ROW + P.GOAL_TOL);
        round.step(DT, NONE);
        expect(round.status).toBe('cleared');
    });

    it('counts the lifted height in the highest height reached', () => {
        const round = newRound();
        round.player = floorStand(8);
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(round.maxHeight).toBe(1);
        expect(round.height).toBe(1);
    });
});

describe('Round rising: events and the stuck-crumble', () => {
    it('reports the lock and clear lights in the risen field (one row up) and then the rise with its hole', () => {
        const round = newRound();
        round.player = sky;
        for (let c = 2; c < P.COLS; c++) round.grid[19][c] = 1;
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(drain(round)).toEqual([
            { kind: 'locked', cells: cells([0, 18], [1, 18]) },
            { kind: 'cleared', rows: [18] },
            { kind: 'risen', hole: 3 },
        ]);
    });

    it('reports a plain lock with the rise right after it', () => {
        const round = newRound();
        round.player = floorStand(8);
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(drain(round)).toEqual([
            { kind: 'locked', cells: cells([0, 17], [1, 17], [0, 18], [1, 18]) },
            { kind: 'risen', hole: 3 },
        ]);
    });

    it('reports no rise event when the lock came before the interval (events as before)', () => {
        const round = newRound();
        round.player = floorStand(8);
        readyToLock(round);
        round.step(DT, NONE);
        expect(drain(round)).toEqual([{ kind: 'locked', cells: cells([0, 18], [1, 18], [0, 19], [1, 19]) }]);
    });

    it('moves the blinking crumble cell up with the field, keeping its time', () => {
        const round = newRound();
        round.player = floorStand(8);
        readyToLock(round);
        round.crumble.target = { c: 4, r: 10, t: 0.5 };
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(round.crumble.target).toEqual({ c: 4, r: 9, t: 0.5 });
    });
});

describe('Round rising: randomness', () => {
    const counting = (): { rng: () => number; calls: () => number } => {
        let n = 0;
        return { rng: () => { n++; return 0.9; }, calls: () => n };
    };

    it('draws the hole from riseRng once per rise and never touches the field rng', () => {
        const field = counting();
        let drawn = 0;
        const round = newRound({ riseRng: () => { drawn++; return HOLE_VALUE; } }, field.rng);
        round.player = floorStand(8);
        readyToLock(round);
        const before = field.calls();
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(drawn).toBe(1);
        expect(field.calls()).toBe(before);
    });

    it('draws riseRng even when the rise stacks the field too high (one draw per rise)', () => {
        let drawn = 0;
        const round = newRound({ riseRng: () => { drawn++; return HOLE_VALUE; } });
        round.player = floorStand(8);
        round.grid[P.TOP_OUT_ROW][9] = 1;
        readyToLock(round);
        round.riseElapsed = P.RISE_INTERVAL;
        round.step(DT, NONE);
        expect(drawn).toBe(1);
    });

    it('is the same Round as before until the interval runs out: same field, flow and field-rng use', () => {
        const run = (rising: boolean): { states: string[]; calls: number } => {
            let seed = 12345;
            let n = 0;
            const rng = (): number => {
                n++;
                seed = (seed * 1103515245 + 12345) % 2147483648;
                return seed / 2147483648;
            };
            const round = new Round(rng, { rising, riseRng: () => HOLE_VALUE });
            const states: string[] = [];
            for (let i = 0; i < 700; i++) { // 11.67 s: before the first rise is due
                round.step(1 / 60, NONE);
                states.push(JSON.stringify([round.grid, round.flow, round.status, round.player]));
            }
            return { states, calls: n };
        };
        const plain = run(false);
        const rising = run(true);
        expect(rising.calls).toBe(plain.calls);
        expect(rising.states).toEqual(plain.states);
        expect(plain.calls).toBeGreaterThan(5); // minos really did drop meanwhile
    });
});
