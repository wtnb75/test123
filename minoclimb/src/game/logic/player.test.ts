import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { createGrid, type Grid } from './board';
import {
    createPlayer, feetY, heightOf, reachedGoal, shiftForClears, stepPlayer, type MoveInput, type Player,
} from './player';

const NONE: MoveInput = { left: false, right: false, jump: false };
const DT = 1 / 60;

const block = (grid: Grid, rows: number[], cols: number[]): void => {
    for (const r of rows) for (const c of cols) grid[r][c] = 1;
};

const run = (grid: Grid, start: Player, frames: number, input: MoveInput | ((f: number) => MoveInput)): Player => {
    let pl = start;
    for (let f = 0; f < frames; f++) {
        pl = stepPlayer(grid, pl, typeof input === 'function' ? input(f) : input, DT);
    }
    return pl;
};

/** A player whose feet are exactly at `feet` (rows), not touching anything. */
const atFeet = (feet: number, x = 4.65): Player => ({ x, y: feet - P.PLAYER_H, vy: 0, onGround: false });

describe('createPlayer', () => {
    it('starts centred, standing on the floor', () => {
        const pl = createPlayer();
        expect(pl.x).toBeCloseTo(P.COLS / 2 - P.PLAYER_W / 2, 9);
        expect(feetY(pl)).toBeCloseTo(P.ROWS, 5);
        expect(feetY(pl)).toBeLessThanOrEqual(P.ROWS);
        expect(pl.onGround).toBe(true);
        expect(pl.vy).toBe(0);
    });
});

describe('stepPlayer: walking', () => {
    it('stands still on the floor with no input', () => {
        const grid = createGrid();
        const start = createPlayer();
        const pl = run(grid, start, 30, NONE);
        expect(pl.x).toBeCloseTo(start.x, 9);
        expect(pl.y).toBeCloseTo(start.y, 4);
        expect(pl.onGround).toBe(true);
    });

    it('moves WALK_SPEED cells per second to the right and to the left', () => {
        const grid = createGrid();
        const start = createPlayer();
        const right = run(grid, start, 12, { ...NONE, right: true });
        expect(right.x - start.x).toBeCloseTo(P.WALK_SPEED * 12 * DT, 6);
        const left = run(grid, start, 12, { ...NONE, left: true });
        expect(start.x - left.x).toBeCloseTo(P.WALK_SPEED * 12 * DT, 6);
    });

    it('does not move when left and right are pressed together', () => {
        const start = createPlayer();
        const pl = run(createGrid(), start, 10, { left: true, right: true, jump: false });
        expect(pl.x).toBeCloseTo(start.x, 9);
    });

    it('stops against the right wall without entering it', () => {
        const pl = run(createGrid(), createPlayer(), 120, { ...NONE, right: true });
        expect(pl.x + P.PLAYER_W).toBeLessThanOrEqual(P.COLS);
        expect(pl.x + P.PLAYER_W).toBeGreaterThan(P.COLS - 0.01);
    });

    it('stops against the left wall without entering it', () => {
        const pl = run(createGrid(), createPlayer(), 120, { ...NONE, left: true });
        expect(pl.x).toBeGreaterThanOrEqual(0);
        expect(pl.x).toBeLessThan(0.01);
    });

    it('stops against a locked cell', () => {
        const grid = createGrid();
        block(grid, [19], [7]);
        const pl = run(grid, createPlayer(), 120, { ...NONE, right: true });
        expect(pl.x + P.PLAYER_W).toBeLessThanOrEqual(7);
        expect(pl.x + P.PLAYER_W).toBeGreaterThan(7 - 0.01);
    });

    it('clamps a long frame to MAX_DT', () => {
        const start = createPlayer();
        const big = stepPlayer(createGrid(), start, { ...NONE, right: true }, 1);
        const small = stepPlayer(createGrid(), start, { ...NONE, right: true }, P.MAX_DT);
        expect(big.x).toBeCloseTo(small.x, 9);
        expect(big.x - start.x).toBeCloseTo(P.WALK_SPEED * P.MAX_DT, 9);
    });
});

describe('stepPlayer: jumping', () => {
    it('rises about 2.3 cells and lands where it started', () => {
        const grid = createGrid();
        let pl = createPlayer();
        const startY = pl.y;
        let minY = pl.y;
        pl = stepPlayer(grid, pl, { ...NONE, jump: true }, DT);
        expect(pl.vy).toBeLessThan(0);
        for (let f = 0; f < 120 && !pl.onGround; f++) {
            minY = Math.min(minY, pl.y);
            pl = stepPlayer(grid, pl, NONE, DT);
        }
        expect(pl.onGround).toBe(true);
        expect(pl.y).toBeCloseTo(startY, 4);
        const rise = startY - minY;
        // v^2 / 2g = 2.31 (a little less with per-frame integration): above a 2-cell step, below a 3-cell one.
        expect(rise).toBeGreaterThan(2.05);
        expect(rise).toBeLessThan(2.6);
    });

    it('cannot jump again while airborne', () => {
        const grid = createGrid();
        let pl = stepPlayer(grid, createPlayer(), { ...NONE, jump: true }, DT);
        let prevVy = pl.vy;
        let airFrames = 0;
        while (!pl.onGround && airFrames < 120) {
            pl = stepPlayer(grid, pl, { ...NONE, jump: true }, DT);
            if (!pl.onGround) {
                // Gravity only: velocity keeps increasing; a second jump would reset it to -JUMP_V.
                expect(pl.vy).toBeGreaterThan(prevVy);
                prevVy = pl.vy;
            }
            airFrames++;
        }
        expect(airFrames).toBeGreaterThan(10);
    });

    it('jumps again on every landing while jump is held', () => {
        const grid = createGrid();
        let pl = createPlayer();
        let launches = 0;
        let wasOnGround = true;
        for (let f = 0; f < 60 * 3; f++) {
            pl = stepPlayer(grid, pl, { ...NONE, jump: true }, DT);
            if (wasOnGround && pl.vy < 0) launches++;
            wasOnGround = pl.onGround;
        }
        // One jump lasts about 0.7 s, so three seconds hold at least four launches.
        expect(launches).toBeGreaterThanOrEqual(4);
    });

    it('stays on the ground when jump is not pressed', () => {
        const pl = run(createGrid(), createPlayer(), 20, NONE);
        expect(pl.vy).toBeGreaterThanOrEqual(0);
        expect(pl.onGround).toBe(true);
    });

    it('bumps its head on a ceiling and falls back', () => {
        const grid = createGrid();
        block(grid, [17], [4, 5]); // ceiling directly above: bottom edge at y = 18
        let pl = createPlayer();
        let minY = pl.y;
        let hitZeroVy = false;
        pl = stepPlayer(grid, pl, { ...NONE, jump: true }, DT);
        for (let f = 0; f < 120; f++) {
            minY = Math.min(minY, pl.y);
            if (pl.vy === 0 && pl.y < createPlayer().y - 0.5) hitZeroVy = true;
            pl = stepPlayer(grid, pl, NONE, DT);
        }
        expect(minY).toBeGreaterThanOrEqual(18);
        expect(hitZeroVy).toBe(true);
        expect(pl.onGround).toBe(true);
    });
});

describe('stepPlayer: climbing steps', () => {
    // Walk right with jump held for 2 s (re-jumps on every landing), then let the player settle for 1 s.
    // Re-pressing in the air next to the step would be a wall kick (and bars the way back to that wall).
    const walkAndJump = (grid: Grid): Player =>
        run(grid, createPlayer(), 60 * 3, (f) => ({ left: false, right: true, jump: f < 120 }));

    it('can jump onto a 2-high step', () => {
        const grid = createGrid();
        block(grid, [18, 19], [6, 7, 8, 9]);
        const pl = walkAndJump(grid);
        expect(feetY(pl)).toBeLessThanOrEqual(18 + 1e-6);
        expect(feetY(pl)).toBeGreaterThan(18 - 1e-3);
        expect(pl.x).toBeGreaterThan(6);
    });

    it('cannot jump onto a 3-high step', () => {
        const grid = createGrid();
        block(grid, [17, 18, 19], [6, 7, 8, 9]);
        const pl = walkAndJump(grid);
        expect(feetY(pl)).toBeGreaterThan(19 - 1e-3);
        expect(pl.x + P.PLAYER_W).toBeLessThanOrEqual(6);
    });
});

describe('stepPlayer: falling', () => {
    it('lands on a one-cell-thick floor even from the fastest fall in one long frame', () => {
        const grid = createGrid();
        block(grid, [12], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); // a single thin floor
        // vy = 78 + gravity * MAX_DT = 80 cells/s -> 4 cells in one frame, more than the floor is thick.
        const start: Player = { x: 4.65, y: 9, vy: 78, onGround: false };
        const pl = stepPlayer(grid, start, NONE, P.MAX_DT);
        expect(pl.onGround).toBe(true);
        expect(feetY(pl)).toBeLessThanOrEqual(12);
        expect(feetY(pl)).toBeGreaterThan(12 - 0.01);
        expect(pl.vy).toBe(0);
    });
});

describe('stepPlayer: falling from far above', () => {
    it('lands on a one-cell-thick floor after a long fall from above the field', () => {
        const grid = createGrid();
        block(grid, [12], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        let pl: Player = { x: 4.65, y: -30, vy: 0, onGround: false };
        for (let f = 0; f < 200 && !pl.onGround; f++) pl = stepPlayer(grid, pl, NONE, P.MAX_DT);
        expect(pl.onGround).toBe(true);
        expect(feetY(pl)).toBeLessThanOrEqual(12);
        expect(feetY(pl)).toBeGreaterThan(12 - 0.01);
    });
});

describe('goal and height', () => {
    it('reaches the goal when the feet are exactly at GOAL_ROW', () => {
        expect(reachedGoal(atFeet(P.GOAL_ROW))).toBe(true);
    });

    it('reaches the goal within the tolerance and not 0.02 below it', () => {
        expect(reachedGoal(atFeet(P.GOAL_ROW + 0.005))).toBe(true);
        expect(reachedGoal(atFeet(P.GOAL_ROW + 0.02))).toBe(false);
    });

    it('does not reach the goal on the floor', () => {
        expect(reachedGoal(createPlayer())).toBe(false);
    });

    it('has height 0 on the floor and ROWS - GOAL_ROW at the goal', () => {
        expect(heightOf(createPlayer())).toBe(0);
        expect(heightOf(atFeet(P.GOAL_ROW))).toBe(P.ROWS - P.GOAL_ROW);
    });

    it('rounds the height down so the goal height only shows on reaching it', () => {
        expect(heightOf(atFeet(P.GOAL_ROW + 0.02))).toBe(P.ROWS - P.GOAL_ROW - 1);
        expect(heightOf(atFeet(P.GOAL_ROW + 0.5))).toBe(P.ROWS - P.GOAL_ROW - 1);
        expect(heightOf(atFeet(P.ROWS - 3))).toBe(3);
        expect(heightOf(atFeet(P.ROWS - 0.5))).toBe(0);
    });

    it('never reports a negative height', () => {
        expect(heightOf(atFeet(P.ROWS + 2))).toBe(0);
    });
});

describe('shiftForClears (the field is the one after the clear)', () => {
    const feet = 15;

    it('leaves a standing player where they are: the stack drops and gravity does the rest', () => {
        const pl = { ...atFeet(feet), onGround: true };
        expect(shiftForClears(createGrid(), pl, [16])).toBe(pl);
        expect(shiftForClears(createGrid(), pl, [16, 17])).toBe(pl);
    });

    it('leaves an airborne player where they are, with their velocity', () => {
        const pl: Player = { x: 4.65, y: 9, vy: -6, onGround: false };
        expect(shiftForClears(createGrid(), pl, [16])).toBe(pl);
    });

    it('moves the player down when a fallen overhang would overlap them', () => {
        const grid = createGrid();
        block(grid, [10], [4]); // the overhang, now at row 10 (it was at row 9)
        const pl: Player = { x: 4.65, y: 9.6, vy: 0, onGround: true }; // rows 9.6 .. 10.5
        expect(shiftForClears(grid, pl, [16]).y).toBeCloseTo(10.6, 9);
    });

    it('moves the player once per cleared row below their feet when an overhang overlaps', () => {
        const grid = createGrid();
        block(grid, [10], [4]);
        const pl: Player = { x: 4.65, y: 9.6, vy: 0, onGround: false };
        expect(shiftForClears(grid, pl, [16, 17]).y).toBeCloseTo(11.6, 9);
        expect(shiftForClears(grid, pl, [5, 16]).y).toBeCloseTo(10.6, 9);
    });

    it('does not move a player who is only touching a fallen cell', () => {
        const grid = createGrid();
        block(grid, [10], [4]); // top edge at y = 10
        const pl = atFeet(10); // feet exactly on that edge
        expect(shiftForClears(grid, pl, [16])).toBe(pl);
    });

    it('does not move a player whose head only touches a fallen overhang', () => {
        const grid = createGrid();
        block(grid, [9], [4]); // bottom edge at y = 10
        const pl: Player = { x: 4.65, y: 10, vy: 0, onGround: false };
        expect(shiftForClears(grid, pl, [16])).toBe(pl);
        // 0.01 higher and the head is inside the cell.
        const inside: Player = { x: 4.65, y: 9.99, vy: 0, onGround: false };
        expect(shiftForClears(grid, inside, [16]).y).toBeCloseTo(10.99, 9);
    });

    it('does not move a player whose side only touches a fallen cell', () => {
        const grid = createGrid();
        block(grid, [10], [6]); // left edge at x = 6
        const pl: Player = { x: 5.3, y: 9.6, vy: 0, onGround: false }; // right edge at x = 6.0
        expect(shiftForClears(grid, pl, [16])).toBe(pl);
        const inside: Player = { x: 5.31, y: 9.6, vy: 0, onGround: false };
        expect(shiftForClears(grid, inside, [16]).y).toBeCloseTo(10.6, 9);
    });

    it('leaves a standing player alone when a platform is under them and an overhang stays clear', () => {
        const grid = createGrid();
        block(grid, [19], [4, 5]); // the platform, already lowered by the clear
        block(grid, [16], [4]); // an overhang that fell and still has a gap above the head
        const pl: Player = { x: 4.65, y: 18 - 0.9, vy: 0, onGround: true }; // rows 17.1 .. 18.0, platform top at 19
        expect(shiftForClears(grid, pl, [19])).toBe(pl);
    });

    it('does not move a player who is below every cleared row, overlap or not', () => {
        const grid = createGrid();
        block(grid, [10], [4]);
        const pl: Player = { x: 4.65, y: 9.6, vy: 0, onGround: false };
        expect(shiftForClears(grid, pl, [5])).toBe(pl);
        expect(shiftForClears(grid, pl, [])).toBe(pl);
    });

    it('brackets the tolerance on the cleared row top edge when an overhang overlaps', () => {
        const grid = createGrid();
        block(grid, [13], [4]);
        const inside = atFeet(14 + P.GOAL_TOL - 1e-9); // rows 13.11 .. 14.01: overlaps the cell at row 13
        const outside = atFeet(14 + P.GOAL_TOL + 1e-9);
        expect(shiftForClears(grid, inside, [14]).y).toBeCloseTo(inside.y + 1, 9);
        expect(shiftForClears(grid, outside, [14])).toBe(outside);
    });

    it('keeps the other fields when it moves the player', () => {
        const grid = createGrid();
        block(grid, [10], [4]);
        const pl: Player = { x: 4.65, y: 9.6, vy: 2, onGround: true };
        expect(shiftForClears(grid, pl, [19])).toEqual({ x: 4.65, y: 10.6, vy: 2, onGround: true });
    });
});
