import { afterEach, describe, expect, it, vi } from 'vitest';
import { P } from '../params';
import { createGrid, type Grid } from './board';
import { columnHeights, demoBot, roamTarget, type DemoSight } from './demoBot';
import type { Plan } from './ai';
import type { Flow } from './round';
import type { MoveInput, Player } from './player';

const I = 0;
const O = 1;
const T = 2;

/** Fills column `c` up to height `h` (rows from the floor). */
const stack = (grid: Grid, c: number, h: number): void => {
    for (let r = P.ROWS - h; r < P.ROWS; r++) grid[r][c] = 1;
};

const field = (heights: Partial<Record<number, number>>): Grid => {
    const grid = createGrid();
    for (const [c, h] of Object.entries(heights)) stack(grid, Number(c), h as number);
    return grid;
};

/** A player standing in column `col` (its centre at col + 0.5 + dx) on a surface of height `h`. */
const standing = (col: number, h: number, dx = 0): Player => ({
    x: col + 0.5 + dx - P.PLAYER_W / 2,
    y: P.ROWS - h - P.PLAYER_H - 1e-6,
    vy: 0,
    onGround: true,
});

const telegraph = (kind: number, rot: number, col: number): Flow => ({
    kind: 'telegraph', plan: { kind, rot, col, row: 18 } as Plan, t: 0,
});
const WAIT: Flow = { kind: 'wait', timer: 1 };

const sight = (grid: Grid, player: Player, flow: Flow = WAIT): DemoSight => ({ grid, player, flow });
const NONE: MoveInput = { left: false, right: false, jump: false };

afterEach(() => vi.restoreAllMocks());

describe('columnHeights', () => {
    it('is the rows from the topmost cell to the floor, 0 for an empty column', () => {
        const grid = field({ 0: 3, 4: 1 });
        grid[5][9] = 1; // a floating cell at row 5: height 15 (AI's definition)
        const h = columnHeights(grid);
        expect(h[0]).toBe(3);
        expect(h[4]).toBe(1);
        expect(h[1]).toBe(0);
        expect(h[9]).toBe(P.ROWS - 5);
    });
});

describe('demoBot: getting out of the way', () => {
    it('goes to the nearer safe column (2 away on the left rather than 3 on the right)', () => {
        // I piece (width 4) over columns 4-7; the climber is in column 5.
        const move = demoBot(sight(createGrid(), standing(5, 0), telegraph(I, 0, 4)), 0);
        expect(move).toEqual({ left: true, right: false, jump: false });
    });

    it('takes the right one on equal distance', () => {
        // T piece (width 3) over columns 4-6; columns 3 and 7 are both 2 away from column 5.
        const move = demoBot(sight(createGrid(), standing(5, 0), telegraph(T, 0, 4)), 0);
        expect(move).toEqual({ left: false, right: true, jump: false });
    });

    it('jumps when the way out is one row higher', () => {
        const grid = field({ 4: 1 });
        const move = demoBot(sight(grid, standing(5, 0), telegraph(O, 0, 5)), 0); // cols 5-6; left is col 4
        expect(move).toEqual({ left: true, right: false, jump: true });
    });

    it('does not jump in the air', () => {
        const grid = field({ 4: 1 });
        const pl = { ...standing(5, 0), onGround: false };
        expect(demoBot(sight(grid, pl, telegraph(O, 0, 5)), 0).jump).toBe(false);
    });

    it('does not choose a way blocked by a wall of 3 rows', () => {
        const grid = field({ 4: 3, 3: 3 }); // the left is walled off; the right is free
        const move = demoBot(sight(grid, standing(5, 0), telegraph(O, 0, 5)), 0); // cols 5-6, right is col 7
        expect(move).toEqual({ left: false, right: true, jump: false });
    });

    it('does not choose a way that drops 3 rows (it could not climb back)', () => {
        // Stand on a 3-high column (5); the left neighbour is the floor (drop 3); the right is level.
        const grid = field({ 5: 3, 6: 3, 7: 3 });
        const move = demoBot(sight(grid, standing(5, 3), telegraph(O, 0, 5)), 0); // cols 5-6; right is col 7
        expect(move).toEqual({ left: false, right: true, jump: false });
    });

    it('picks the right column at distance 3 when the left way out is cut by a step of 3', () => {
        // I piece over columns 4-7; the climber is in column 5. Left: column 3 is 3 high (a wall behind
        // column 4 at the floor): the step from column 4 (floor) to 3 cannot be climbed. Right: column 8.
        const grid = field({ 3: 3 });
        const move = demoBot(sight(grid, standing(5, 0), telegraph(I, 0, 4)), 0);
        expect(move).toEqual({ left: false, right: true, jump: false });
    });

    it('walks out inwards from the wall column when the mino covers its neighbours', () => {
        // O piece over columns 1-2; the climber is in column 0 with its body reaching column 1.
        const nearWall: Player = { ...standing(0, 0), x: 0.5 };
        const move = demoBot(sight(createGrid(), nearWall, telegraph(O, 0, 1)), 0);
        // Centre 0.85 is in column 0 (outside the mino), the body (to 1.2 + margin) reaches column 1.
        expect(move).toEqual({ left: true, right: false, jump: false });
    });

    it('treats the far wall column the same way on the right', () => {
        // O piece over columns 7-8; the climber in column 9 has its body reaching column 8.
        const nearWall: Player = { ...standing(9, 0), x: 8.9 };
        const move = demoBot(sight(createGrid(), nearWall, telegraph(O, 0, 7)), 0);
        expect(move).toEqual({ left: false, right: true, jump: false });
    });

    it('stays put when there is no way out', () => {
        // Walled in on both sides by 3-high walls.
        const grid = field({ 4: 3, 6: 3, 7: 3 });
        expect(demoBot(sight(grid, standing(5, 0), telegraph(O, 0, 5)), 0)).toEqual(NONE);
    });

    it('only avoids when the body (plus the margin) really overlaps the mino columns', () => {
        // O piece over columns 6-7. At t = 3.15 s the stroll target is on the right, so a climber that is
        // not in the way would walk right (but it may not step into the mino column, so it stays).
        const justOutside: Player = { ...standing(5, 0), x: 6 - P.DEMO_BODY_MARGIN - P.PLAYER_W - 1e-9 };
        expect(demoBot(sight(createGrid(), justOutside, telegraph(O, 0, 6)), 3.15)).toEqual(NONE);
        // 0.01 further right the margin reaches into column 6: it moves away (left).
        const inside: Player = { ...justOutside, x: justOutside.x + 0.01 };
        expect(demoBot(sight(createGrid(), inside, telegraph(O, 0, 6)), 3.15)).toEqual({
            left: true, right: false, jump: false,
        });
    });

    it('steps away inside its own column when only the edge of the body reaches the mino', () => {
        // O piece over columns 1-2. The body spans x = 0.58 .. 1.28 (centre 0.93, column 0): still overlapping.
        const edge: Player = { ...standing(0, 0), x: 0.58 };
        const move = demoBot(sight(createGrid(), edge, telegraph(O, 0, 1)), 0);
        expect(move).toEqual({ left: true, right: false, jump: false });
        // Far enough left (right edge + margin = 0.98 < 1): not avoided any more.
        const clear: Player = { ...standing(0, 0), x: 0.2 };
        expect(demoBot(sight(createGrid(), clear, telegraph(O, 0, 1)), 0).left).toBe(false);
    });

    it('also keeps the margin on the left edge of the body (the mino is on its left)', () => {
        // O piece over columns 1-2 (right edge x = 3). At t = 9.45 s the stroll target is on the left.
        // Body's left edge - margin = 2.9999 < 3: still overlapping, so it steps away to the right.
        const edge: Player = { ...standing(3, 0), x: 3 + P.DEMO_BODY_MARGIN - 1e-4 };
        const move = demoBot(sight(createGrid(), edge, telegraph(O, 0, 1)), (P.DEMO_ROAM_PERIOD_S * 3) / 4);
        expect(move).toEqual({ left: false, right: true, jump: false });
        // 0.01 further right the margin is outside the mino: not avoided; it strolls left but may not
        // enter the mino column, so it stays.
        const clear: Player = { ...edge, x: edge.x + 0.01 };
        expect(demoBot(sight(createGrid(), clear, telegraph(O, 0, 1)), (P.DEMO_ROAM_PERIOD_S * 3) / 4)).toEqual(NONE);
    });

    it('steps away to the right when its centre is right of the mino', () => {
        // O piece over columns 1-2; the climber's centre is at 3.05 (column 3), the body starts at 2.7.
        const edge: Player = { ...standing(3, 0), x: 2.7 };
        const move = demoBot(sight(createGrid(), edge, telegraph(O, 0, 1)), 0);
        expect(move).toEqual({ left: false, right: true, jump: false });
    });

    it('uses the landing frame (final orientation), not a rotated look', () => {
        // A vertical I (rot 1) at column 2 covers only column 2: a climber in column 5 is not in the way.
        const move = demoBot(sight(field({ 6: 1 }), standing(5, 0), telegraph(I, 1, 2)), 0);
        // Not avoiding: it climbs toward the higher column on the right instead.
        expect(move.right).toBe(true);
    });
});

describe('demoBot: climbing', () => {
    it('walks right and jumps when the right column is one row higher', () => {
        const move = demoBot(sight(field({ 6: 1 }), standing(5, 0)), 0);
        expect(move).toEqual({ left: false, right: true, jump: true });
    });

    it('does not head for a column 3 rows higher, and does not jump at it', () => {
        const move = demoBot(sight(field({ 6: 3 }), standing(5, 0), WAIT), 0);
        // Nothing climbable: it strolls toward the roam target (x = 5.0 at t = 0; the centre is at 5.5).
        expect(move).toEqual({ left: true, right: false, jump: false });
    });

    it('prefers the nearer one of two equally high columns, and the right on a tie', () => {
        // Columns 4 and 6 are both 1 high: same distance -> right.
        const move = demoBot(sight(field({ 4: 1, 6: 1 }), standing(5, 0)), 0);
        expect(move.right).toBe(true);
        // Column 4 is 1 high and column 7 is 1 high: the nearer one (col 4) wins.
        const move2 = demoBot(sight(field({ 4: 1, 7: 1 }), standing(5, 0)), 0);
        expect(move2.left).toBe(true);
    });

    it('never climbs into the mino columns', () => {
        // The higher column (6) is inside the announced mino (columns 6-7), which is not on the climber.
        const move = demoBot(sight(field({ 6: 1 }), standing(5, 0), telegraph(O, 0, 6)), 0);
        expect(move.right).toBe(false);
        expect(move.jump).toBe(false);
    });
});

describe('demoBot: strolling', () => {
    it('heads for the roam target when nothing higher is near', () => {
        // Level floor; at t = 3.15 s the target is centre + amplitude = 8.5, the climber's centre is 2.5.
        const move = demoBot(sight(createGrid(), standing(2, 0)), 3.15);
        expect(move.right).toBe(true);
        expect(move.jump).toBe(false);
    });

    it('stands still within the arrival tolerance of the target', () => {
        // At t = 0 the target is x = 5.0; a centre at 5.0 + 0.10 is within 0.15.
        expect(demoBot(sight(createGrid(), standing(5, 0, 0.1 - 0.5)), 0)).toEqual(NONE);
        // 0.2 away it moves.
        const move = demoBot(sight(createGrid(), standing(5, 0, 0.2 - 0.5)), 0);
        expect(move.left).toBe(true);
    });

    it('has the target at the centre, centre + amplitude, centre, centre - amplitude', () => {
        expect(roamTarget(0)).toBeCloseTo(P.DEMO_ROAM_CENTER, 9);
        expect(roamTarget(P.DEMO_ROAM_PERIOD_S / 4)).toBeCloseTo(8.5, 9);
        expect(roamTarget(P.DEMO_ROAM_PERIOD_S / 2)).toBeCloseTo(5, 9);
        expect(roamTarget((P.DEMO_ROAM_PERIOD_S * 3) / 4)).toBeCloseTo(1.5, 9);
        expect(P.DEMO_ROAM_PERIOD_S / 4).toBeCloseTo(3.15, 9);
    });

    it('does not stroll into a mino column', () => {
        // Target at t = 3.15 is 8.5 (to the right); the mino covers columns 5-6, the climber is in column 3.
        const move = demoBot(sight(createGrid(), standing(3, 0), telegraph(O, 0, 4)), 3.15); // cols 4-5, ahead = 4
        expect(move.right).toBe(false);
    });
});

describe('demoBot: holes and walls', () => {
    it('does not walk off a drop of 3 rows, but walks off a drop of 2', () => {
        // Standing on a 3-high column, target to the right (t = 3.15), the next column is the floor (drop 3).
        const high = field({ 2: 3 });
        const stay = demoBot(sight(high, standing(2, 3)), 3.15);
        expect(stay.right).toBe(false);
        // Next column 1 high: a drop of 2 is fine.
        const ok = demoBot(sight(field({ 2: 3, 3: 1 }), standing(2, 3)), 3.15);
        expect(ok.right).toBe(true);
    });

    it('does not press against a wall of 3 rows, and does not jump at it', () => {
        const wall = field({ 3: 3 });
        const move = demoBot(sight(wall, standing(2, 0)), 3.15);
        expect(move.right).toBe(false);
        expect(move.jump).toBe(false);
        // A wall of 2 is climbed.
        const low = demoBot(sight(field({ 3: 2 }), standing(2, 0)), 3.15);
        expect(low.right).toBe(true);
        expect(low.jump).toBe(true);
    });

    it('strolls inwards at the left edge', () => {
        // At t = 9.45 s the target is x = 1.5; the climber in column 0 goes right, not into the wall.
        const move = demoBot(sight(createGrid(), standing(0, 0)), (P.DEMO_ROAM_PERIOD_S * 3) / 4);
        expect(move.right).toBe(true);
        expect(move.left).toBe(false);
    });
});

describe('demoBot: purity', () => {
    it('does not use random numbers and gives the same output for the same input', () => {
        vi.spyOn(Math, 'random').mockImplementation(() => {
            throw new Error('the bot must not roll dice');
        });
        const s = sight(field({ 4: 1, 6: 2 }), standing(5, 0), telegraph(O, 0, 5));
        expect(demoBot(s, 1.5)).toEqual(demoBot(s, 1.5));
    });

    it('does not change the sight it was given', () => {
        const grid = field({ 4: 1 });
        const snapshot = JSON.stringify(grid);
        const pl = standing(5, 0);
        demoBot(sight(grid, pl, telegraph(O, 0, 5)), 2);
        expect(JSON.stringify(grid)).toBe(snapshot);
        expect(pl).toEqual(standing(5, 0));
    });
});
