// Wall kick (docs/spec.md "壁蹴り"): contact, kick, lock, same-side limit and the barred side.
// Expected values are worked by hand from the spec's numbers, not taken from the implementation.
import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { createGrid, type Grid } from './board';
import { InputArbiter, type PointerState, type RawInput } from './input';
import { shiftForClears, stepPlayer, type MoveInput, type Player, type WallKick } from './player';

const DT = 1 / 60;
const EPS = 1e-6;
const NONE: MoveInput = { left: false, right: false, jump: false };
const JUMP: MoveInput = { left: false, right: false, jump: true };

const block = (grid: Grid, rows: number[], cols: number[]): void => {
    for (const r of rows) for (const c of cols) grid[r][c] = 1;
};
const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** A wall on the left only: column 3, rows 0..19 (its right face is x = 4). Open ground to the right. */
const leftWall = (): Grid => {
    const g = createGrid();
    block(g, range(0, 19), [3]);
    return g;
};
/** A hole of the given width starting at column 4, walls on both sides (faces x = 4 and x = 4 + width). */
const hole = (width: number): Grid => {
    const g = createGrid();
    block(g, range(0, 19), [3, 4 + width]);
    return g;
};
const air = (x: number, y: number, kick?: WallKick): Player => ({ x, y, vy: 0, onGround: false, kick });
const memory = (over: Partial<WallKick>): WallKick => ({ side: 0, since: Infinity, jumpHeld: false, kicked: false, barred: 0, ...over });

const KICK_VY = -P.WALL_KICK_VY + P.GRAVITY * DT; // after gravity in the kick frame: -10.2133...

describe('wall contact (WALL_TOUCH_TOL)', () => {
    const tryKick = (grid: Grid, x: number, y: number): boolean => stepPlayer(grid, air(x, y), JUMP, DT).kick?.kicked === true;

    it('kicks when the body is exactly WALL_TOUCH_TOL from the wall face', () => {
        expect(tryKick(leftWall(), 4 + P.WALL_TOUCH_TOL, 10)).toBe(true);
    });

    it('allows 1e-9 of floating point slack on the tolerance, on both walls', () => {
        expect(tryKick(leftWall(), 4 + P.WALL_TOUCH_TOL + 5e-10, 10)).toBe(true);
        expect(tryKick(leftWall(), 4 + P.WALL_TOUCH_TOL + 2e-9, 10)).toBe(false);
        const g = createGrid();
        block(g, range(0, 19), [7]);
        expect(tryKick(g, 7 - P.PLAYER_W - P.WALL_TOUCH_TOL - 5e-10, 10)).toBe(true);
        expect(tryKick(g, 7 - P.PLAYER_W - P.WALL_TOUCH_TOL - 2e-9, 10)).toBe(false);
    });

    it('does not kick when the body is 0.01 farther than the tolerance', () => {
        expect(tryKick(leftWall(), 4 + P.WALL_TOUCH_TOL + 0.01, 10)).toBe(false);
    });

    it('touches the right wall by the same tolerance', () => {
        const g = createGrid();
        block(g, range(0, 19), [7]); // left face at x = 7
        expect(tryKick(g, 7 - P.PLAYER_W - P.WALL_TOUCH_TOL, 10)).toBe(true);
        expect(tryKick(g, 7 - P.PLAYER_W - P.WALL_TOUCH_TOL - 0.01, 10)).toBe(false);
    });

    it('does not touch a cell that only sits below the feet', () => {
        const g = createGrid();
        block(g, [18], [3]); // top edge at y = 18
        expect(tryKick(g, 4 + EPS, 18 - P.PLAYER_H)).toBe(false); // feet exactly at 18
        expect(tryKick(g, 4 + EPS, 18 - P.PLAYER_H + 0.1)).toBe(true); // 0.1 into the cell
    });

    it('does not touch a cell that only sits above the head', () => {
        const g = createGrid();
        block(g, [16], [3]); // bottom edge at y = 17
        expect(tryKick(g, 4 + EPS, 17)).toBe(false); // head exactly at 17
        expect(tryKick(g, 4 + EPS, 16.9)).toBe(true);
    });

    it('kicks off the side of a locked mino as well as the field wall', () => {
        const g = createGrid();
        block(g, [10, 11], [4]); // a mino piece: right face x = 5
        expect(tryKick(g, 5 + EPS, 10.5)).toBe(true);
    });
});

describe('the kick', () => {
    it('on the ground, jumping next to a wall is a normal jump, not a kick', () => {
        const pl: Player = { x: 4 + EPS, y: P.ROWS - P.PLAYER_H - EPS, vy: 0, onGround: true };
        const out = stepPlayer(leftWall(), pl, JUMP, DT);
        expect(out.kick?.kicked).toBe(false);
        expect(out.vy).toBeCloseTo(-P.JUMP_V + P.GRAVITY * DT, 9);
        expect(out.x).toBeCloseTo(4 + EPS, 9);
    });

    it('in the air next to the left wall, a new press sets vy and moves away at WALL_KICK_VX', () => {
        const out = stepPlayer(leftWall(), air(4 + EPS, 10), JUMP, DT);
        expect(out.kick?.kicked).toBe(true);
        expect(out.kick?.side).toBe(-1);
        expect(out.vy).toBeCloseTo(KICK_VY, 9);
        expect(out.x).toBeCloseTo(4 + EPS + P.WALL_KICK_VX * DT, 9);
    });

    it('next to the right wall the kick goes left', () => {
        const g = createGrid();
        block(g, range(0, 19), [7]);
        const out = stepPlayer(g, air(7 - P.PLAYER_W - EPS, 10), JUMP, DT);
        expect(out.kick?.side).toBe(1);
        expect(out.x).toBeCloseTo(7 - P.PLAYER_W - EPS - P.WALL_KICK_VX * DT, 9);
    });

    it('ignores the direction keys on the kick frame', () => {
        const out = stepPlayer(leftWall(), air(4 + EPS, 10), { left: true, right: false, jump: true }, DT);
        expect(out.x).toBeCloseTo(4 + EPS + P.WALL_KICK_VX * DT, 9);
    });

    it('does not kick while jump is held from the previous frame', () => {
        const out = stepPlayer(leftWall(), air(4 + EPS, 10, memory({ jumpHeld: true })), JUMP, DT);
        expect(out.kick?.kicked).toBe(false);
        expect(out.vy).toBeCloseTo(P.GRAVITY * DT, 9);
    });

    it('kicks on a release followed by a new press', () => {
        const g = leftWall();
        const a = stepPlayer(g, air(4 + EPS, 10, memory({ jumpHeld: true })), NONE, DT);
        expect(a.kick?.kicked).toBe(false);
        const b = stepPlayer(g, a, JUMP, DT);
        expect(b.kick?.kicked).toBe(true);
    });

    it('does not kick without touching a wall', () => {
        const out = stepPlayer(leftWall(), air(6, 10), JUMP, DT);
        expect(out.kick?.kicked).toBe(false);
        expect(out.vy).toBeCloseTo(P.GRAVITY * DT, 9);
    });

    it('stops at a ceiling (vy = 0) and keeps the kick', () => {
        const g = leftWall();
        block(g, [9], range(4, 9)); // ceiling: bottom edge at y = 10
        const out = stepPlayer(g, air(4 + EPS, 10 + EPS), JUMP, DT);
        expect(out.kick?.kicked).toBe(true);
        expect(out.vy).toBe(0);
        expect(out.kick?.side).toBe(-1);
    });

    it('clamps a long frame to MAX_DT', () => {
        const out = stepPlayer(leftWall(), air(4 + EPS, 10), JUMP, 0.2);
        expect(out.x).toBeCloseTo(4 + EPS + P.WALL_KICK_VX * P.MAX_DT, 9);
    });
});

describe('the kick on the field walls and in a real sequence', () => {
    it('kicks off the left and right walls around the field', () => {
        const left = stepPlayer(createGrid(), air(EPS, 10), JUMP, DT);
        expect(left.kick?.side).toBe(-1);
        const right = stepPlayer(createGrid(), air(P.COLS - P.PLAYER_W - EPS, 10), JUMP, DT);
        expect(right.kick?.side).toBe(1);
    });

    it('ignores both keys, and the key toward the wall too, on the kick frame', () => {
        for (const input of [{ left: true, right: true, jump: true }, { left: false, right: true, jump: true }]) {
            const out = stepPlayer(leftWall(), air(4 + EPS, 10), input, DT);
            expect(out.x).toBeCloseTo(4 + EPS + P.WALL_KICK_VX * DT, 9);
        }
    });

    it('follows the 1-wide hole example: kick, stop at the right wall at x = 4.3, press again and kick left', () => {
        const g = hole(1); // faces x = 4 and x = 5
        let pl = stepPlayer(g, air(4 + EPS, 8), JUMP, DT);
        expect(pl.x).toBeCloseTo(4 + EPS + 4 / 60, 9);
        for (let f = 1; f < 6; f++) pl = stepPlayer(g, pl, JUMP, DT); // 5 more frames: reaches 4.3 on the 5th frame
        expect(pl.x).toBeCloseTo(5 - P.PLAYER_W - EPS, 9);
        expect(pl.kick?.kicked).toBe(false);
        expect(pl.kick?.barred).toBe(0); // the right wall was touched: the bar is lifted
        pl = stepPlayer(g, pl, NONE, DT); // release
        expect(pl.kick?.kicked).toBe(false);
        const x0 = pl.x;
        pl = stepPlayer(g, pl, JUMP, DT); // new press at the right wall
        expect(pl.kick?.kicked).toBe(true);
        expect(pl.kick?.side).toBe(1);
        expect(pl.x).toBeCloseTo(x0 - P.WALL_KICK_VX * DT, 9);
    });

    it('does not lift the bar by touching the same wall again', () => {
        const out = stepPlayer(leftWall(), air(4 + EPS, 10, memory({ side: -1, since: 0.5, barred: -1 })), NONE, DT);
        expect(out.kick?.barred).toBe(-1);
    });
});

describe('the kick through the input layer', () => {
    const raw = (keys: string[], pointers: PointerState[] = []): RawInput => ({
        keys: new Set(keys),
        pointers,
        pressedKeys: new Set(keys),
        pointerPressed: false,
    });
    const rightFinger: PointerState = { id: 1, x: 300, downX: 300, downY: 500, isDown: true };
    const arbiter = (): InputArbiter => new InputArbiter(180, P.STICK_DEADZONE, P.STICK_RING_RADIUS);
    const step = (a: InputArbiter, pl: Player, r: RawInput): Player => stepPlayer(leftWall(), pl, { ...a.read(r).move }, DT);

    it('adding a second jump key or a finger while jump is held is not a new press', () => {
        const a = arbiter();
        let pl = air(4 + EPS, 10, memory({ jumpHeld: true }));
        pl = step(a, pl, raw(['Space']));
        pl = step(a, pl, raw(['Space', 'ArrowUp']));
        pl = step(a, pl, raw(['Space', 'ArrowUp'], [rightFinger]));
        expect(pl.kick?.kicked).toBe(false);
    });

    it('a held key that is ignored until released does not count, and a fresh key then kicks', () => {
        const a = arbiter();
        a.blockHeld(raw(['Space'])); // e.g. the retry key still down
        let pl = air(4 + EPS, 10);
        pl = step(a, pl, raw(['Space']));
        expect(pl.kick?.kicked).toBe(false);
        pl = step(a, pl, raw(['Space', 'ArrowUp'])); // ArrowUp is new
        expect(pl.kick?.kicked).toBe(true);
    });

    it('a finger on the right half is a jump press like a key', () => {
        const a = arbiter();
        let pl = air(4 + EPS, 10);
        pl = step(a, pl, raw([]));
        expect(pl.kick?.kicked).toBe(false);
        pl = step(a, pl, raw([], [rightFinger]));
        expect(pl.kick?.kicked).toBe(true);
    });
});

describe('the lock (WALL_KICK_LOCK)', () => {
    /** Kicks off the left wall in open ground, then feeds `after(frame)` for frames 1... Returns the x after each frame. */
    const xs = (after: (f: number) => MoveInput, frames: number, dt = DT): number[] => {
        const g = leftWall();
        let pl = stepPlayer(g, air(4 + EPS, 8), JUMP, dt);
        const out = [pl.x];
        for (let f = 1; f < frames; f++) {
            pl = stepPlayer(g, pl, after(f), dt);
            out.push(pl.x);
        }
        return out;
    };

    it('moves away at the kick speed for 9 frames whatever the keys say', () => {
        const x = xs(() => ({ left: true, right: false, jump: true }), 9);
        for (let f = 0; f < 9; f++) expect(x[f]).toBeCloseTo(4 + EPS + (f + 1) * P.WALL_KICK_VX * DT, 9);
    });

    it('goes back to the keys on the 10th frame (t = 0.15)', () => {
        const x = xs((f) => ({ left: false, right: f >= 9, jump: true }), 11);
        expect(x[8] - x[7]).toBeCloseTo(P.WALL_KICK_VX * DT, 9); // frame 8: still the kick
        expect(x[9] - x[8]).toBeCloseTo(P.WALK_SPEED * DT, 9); // frame 9: WALK_SPEED
    });

    it('counts MAX_DT-clamped frames in the lock: 0.2 s frames count 0.05 each', () => {
        const x = xs(() => ({ left: false, right: true, jump: true }), 4, 0.2);
        expect(x[1] - x[0]).toBeCloseTo(P.WALL_KICK_VX * P.MAX_DT, 9); // 0.05 elapsed
        expect(x[2] - x[1]).toBeCloseTo(P.WALL_KICK_VX * P.MAX_DT, 9); // 0.10 elapsed: still locked
        expect(x[3] - x[2]).toBeCloseTo(P.WALK_SPEED * P.MAX_DT, 9); // 0.15 elapsed: free
    });

    it('counts the lock in summed dt: three 0.05 frames after the kick frame are still locked at t = 0.10', () => {
        const x = xs(() => ({ left: false, right: true, jump: true }), 4, 0.05);
        expect(x[1] - x[0]).toBeCloseTo(P.WALL_KICK_VX * 0.05, 9); // t = 0.05
        expect(x[2] - x[1]).toBeCloseTo(P.WALL_KICK_VX * 0.05, 9); // t = 0.10
        expect(x[3] - x[2]).toBeCloseTo(P.WALK_SPEED * 0.05, 9); // t = 0.15: free
    });
});

describe('the same-side limit', () => {
    it('does not kick the same side again while in the air', () => {
        const out = stepPlayer(leftWall(), air(4 + EPS, 10, memory({ side: -1, since: 1, barred: -1 })), JUMP, DT);
        expect(out.kick?.kicked).toBe(false);
        expect(out.vy).toBeCloseTo(P.GRAVITY * DT, 9);
    });

    it('kicks the opposite wall at once', () => {
        const g = hole(1); // faces x = 4 and x = 5
        const out = stepPlayer(g, air(5 - P.PLAYER_W - EPS, 10, memory({ side: -1, since: 0.5, barred: -1 })), JUMP, DT);
        expect(out.kick?.kicked).toBe(true);
        expect(out.kick?.side).toBe(1);
        expect(out.x).toBeLessThan(5 - P.PLAYER_W - EPS);
    });

    it('also kicks the opposite wall during the lock of the previous kick', () => {
        const g = hole(1);
        const out = stepPlayer(g, air(5 - P.PLAYER_W - EPS, 10, memory({ side: -1, since: 0.05, barred: -1 })), JUMP, DT);
        expect(out.kick?.kicked).toBe(true);
        expect(out.kick?.side).toBe(1);
    });

    it('forgets the side on landing: the frame after landing, either side can be kicked', () => {
        const g = leftWall();
        // 0.01 above the floor, falling: lands this frame.
        const falling: Player = { x: 4 + EPS, y: P.ROWS - P.PLAYER_H - 0.01, vy: 5, onGround: false, kick: memory({ side: -1, since: 0.3, barred: -1 }) };
        const landed = stepPlayer(g, falling, NONE, DT);
        expect(landed.onGround).toBe(true);
        expect(landed.kick?.side).toBe(0);
        const up = stepPlayer(g, { ...landed, onGround: false, y: 10, vy: 0 }, JUMP, DT);
        expect(up.kick?.kicked).toBe(true);
        expect(up.kick?.side).toBe(-1);
    });

    it('moves the landing frame at the kick speed when the lock was still on', () => {
        const falling: Player = { x: 6, y: P.ROWS - P.PLAYER_H - 0.01, vy: 5, onGround: false, kick: memory({ side: -1, since: 0.05, barred: -1 }) };
        const out = stepPlayer(createGrid(), falling, { left: true, right: false, jump: false }, DT);
        expect(out.onGround).toBe(true);
        expect(out.x).toBeCloseTo(6 + P.WALL_KICK_VX * DT, 9);
    });
});

describe('the barred side (no return to the kicked wall)', () => {
    /** Kicks off the left wall, runs the 9 locked frames, and returns the state (frame 9 is next). */
    const afterLock = (g: Grid): Player => {
        let pl = stepPlayer(g, air(4 + EPS, 8), JUMP, DT);
        for (let f = 1; f < 9; f++) pl = stepPlayer(g, pl, { left: false, right: false, jump: true }, DT);
        return pl;
    };

    it('bars the kicked side at the kick frame', () => {
        const out = stepPlayer(leftWall(), air(4 + EPS, 8), JUMP, DT);
        expect(out.kick?.barred).toBe(-1);
    });

    it('ignores the barred direction once the lock is over, and the free direction still works', () => {
        const g = leftWall();
        const pl = afterLock(g);
        const left = stepPlayer(g, pl, { left: true, right: false, jump: true }, DT);
        expect(left.x).toBeCloseTo(pl.x, 9);
        const right = stepPlayer(g, pl, { left: false, right: true, jump: true }, DT);
        expect(right.x).toBeCloseTo(pl.x + P.WALK_SPEED * DT, 9);
    });

    it('moves right only when both keys are held and the left is barred', () => {
        const g = leftWall();
        const pl = afterLock(g);
        const out = stepPlayer(g, pl, { left: true, right: true, jump: true }, DT);
        expect(out.x).toBeCloseTo(pl.x + P.WALK_SPEED * DT, 9);
    });

    it('lets the right wall bar the right side when it is the one kicked', () => {
        const g = createGrid();
        block(g, range(0, 19), [7]);
        let pl = stepPlayer(g, air(7 - P.PLAYER_W - EPS, 8), JUMP, DT);
        for (let f = 1; f < 9; f++) pl = stepPlayer(g, pl, JUMP, DT);
        const out = stepPlayer(g, pl, { left: false, right: true, jump: true }, DT);
        expect(out.x).toBeCloseTo(pl.x, 9);
        expect(out.kick?.barred).toBe(1);
    });

    it('lifts the bar at the end of the frame in which the opposite wall is touched', () => {
        const g = hole(3); // faces x = 4 and x = 7; the right wall is reached at x = 6.3
        let pl = stepPlayer(g, air(4 + EPS, 8), JUMP, DT);
        let touchedAt = -1;
        for (let f = 1; f < 60 && touchedAt < 0; f++) {
            pl = stepPlayer(g, pl, { left: false, right: true, jump: true }, DT);
            if (pl.kick?.barred === 0) touchedAt = f;
            else expect(pl.x + P.PLAYER_W).toBeLessThan(7 - P.WALL_TOUCH_TOL); // still barred: not touching yet
        }
        expect(touchedAt).toBeGreaterThan(9); // not during the lock: 0.6 cells is far from the gap of 2.3
        expect(pl.x + P.PLAYER_W).toBeGreaterThanOrEqual(7 - P.WALL_TOUCH_TOL - 1e-9);
        const back = stepPlayer(g, pl, { left: true, right: false, jump: true }, DT);
        expect(back.x).toBeCloseTo(pl.x - P.WALK_SPEED * DT, 9);
    });

    it('lifts the bar on landing, and the next frame walks toward that wall', () => {
        const g = leftWall();
        const falling: Player = { x: 6, y: P.ROWS - P.PLAYER_H - 0.01, vy: 5, onGround: false, kick: memory({ side: -1, since: 0.3, barred: -1 }) };
        const landed = stepPlayer(g, falling, NONE, DT);
        expect(landed.kick?.barred).toBe(0);
        const out = stepPlayer(g, landed, { left: true, right: false, jump: false }, DT);
        expect(out.x).toBeCloseTo(6 - P.WALK_SPEED * DT, 9);
    });

    it('a new kick on the other side bars that side instead', () => {
        const g = hole(1);
        const out = stepPlayer(g, air(5 - P.PLAYER_W - EPS, 10, memory({ side: -1, since: 0.5, barred: -1 })), JUMP, DT);
        expect(out.kick?.barred).toBe(1);
    });

    it('keeps the remembered side when the bar is lifted by touching the other wall', () => {
        const g = hole(1);
        // Barred on the left, moving right into the right wall: the bar goes, the memory (side) stays.
        const pl = air(5 - P.PLAYER_W - 0.1, 10, memory({ side: -1, since: 0.5, barred: -1 }));
        const out = stepPlayer(g, pl, { left: false, right: true, jump: false }, 1 / 20);
        expect(out.kick?.barred).toBe(0);
        expect(out.kick?.side).toBe(-1);
    });
});

describe('row clears', () => {
    it('keep the kick memory, the barred side and the elapsed time when the player is moved down', () => {
        const g = createGrid();
        block(g, [10], [4]); // a fallen overhang in the player's rectangle
        const kick = memory({ side: -1, since: 0.05, barred: -1 });
        const pl: Player = { x: 4.1, y: 9.5, vy: 0, onGround: false, kick };
        const out = shiftForClears(g, pl, [12]);
        expect(out.y).toBeCloseTo(10.5, 9);
        expect(out.kick).toBe(kick);
    });
});
