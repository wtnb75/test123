import { describe, expect, it } from 'vitest';
import {
    BALL_R,
    BUMPER_MIN_OUT,
    BUMPER_R,
    FLIPPER_R,
    FLIPPER_REST_DEG,
    FLIPPER_UP_DEG,
    GRAVITY,
    H,
    LANE_BALL_X,
    LANE_FLOOR_Y,
    MAX_SPEED,
    PHYSICS_DT,
} from '../params';
import {
    WALLS,
    ballSpeed,
    blockRect,
    collideBlock,
    collideBumper,
    collideSegment,
    flipperDir,
    flipperTip,
    isDrained,
    isReady,
    launchSpeed,
    makeBall,
    makeFlippers,
    stepFlipper,
    stepWorld,
    type Ball,
    type Flipper,
    type World,
} from './physics';
import { loadBlocks, loadBumpers } from './stages';


const ball = (x: number, y: number, vx = 0, vy = 0): Ball => ({ x, y, vx, vy });
const deg = (d: number) => (d * Math.PI) / 180;

/** A table with no blocks or bumpers, the flippers down, and the given ball. */
const emptyWorld = (b: Ball): World => ({ ball: b, extras: [], flippers: makeFlippers(), bumpers: [], blocks: [] });

describe('launchSpeed', () => {
    it('maps a charge of 0 / 0.5 / 1 to LAUNCH_MIN / the middle / LAUNCH_MAX', () => {
        expect(launchSpeed(0)).toBe(450);
        expect(launchSpeed(0.5)).toBe(775);
        expect(launchSpeed(1)).toBe(1100);
    });

    it('clamps a charge outside 0..1', () => {
        expect(launchSpeed(-0.2)).toBe(450);
        expect(launchSpeed(1.5)).toBe(1100);
    });
});

describe('isReady', () => {
    it('is true for a ball resting in the lane', () => {
        expect(isReady(ball(345, 623))).toBe(true);
    });

    it('is false when x is exactly LANE_X, true just right of it', () => {
        expect(isReady(ball(330, 623))).toBe(false);
        expect(isReady(ball(330.01, 623))).toBe(true);
    });

    it('is false at y = H - READY_Y_MARGIN (600) and true at 601', () => {
        expect(isReady(ball(345, 600))).toBe(false);
        expect(isReady(ball(345, 601))).toBe(true);
    });

    it('needs |vy| below 40: 40 is not ready, -39 is', () => {
        expect(isReady(ball(345, 623, 0, 40))).toBe(false);
        expect(isReady(ball(345, 623, 0, -39))).toBe(true);
        expect(isReady(ball(345, 623, 0, -40))).toBe(false);
    });
});

describe('isDrained', () => {
    it('is false at y = H + 3 * BALL_R (667) and true just below it', () => {
        expect(isDrained(ball(165, H + 3 * BALL_R))).toBe(false);
        expect(isDrained(ball(165, H + 3 * BALL_R + 0.01))).toBe(true);
    });
});

describe('makeBall / makeFlippers', () => {
    it('puts the ball at rest on the lane floor', () => {
        expect(makeBall()).toEqual({ x: LANE_BALL_X, y: LANE_FLOOR_Y - BALL_R, vx: 0, vy: 0 });
    });

    it('makes both flippers down and still, mirrored left and right', () => {
        const [l, r] = makeFlippers();
        expect([l.px, l.py, l.s, l.omega]).toEqual([95, 560, 1, 0]);
        expect([r.px, r.py, r.s, r.omega]).toEqual([235, 560, -1, 0]);
        expect(l.a).toBeCloseTo(deg(FLIPPER_REST_DEG), 12);
        expect(r.a).toBeCloseTo(deg(FLIPPER_REST_DEG), 12);
    });

    it('has the resting tips at x = 146.21 and 183.79, a gap of about 23.6 between the flipper bodies', () => {
        const [l, r] = makeFlippers();
        const [lx] = flipperTip(l);
        const [rx] = flipperTip(r);
        expect(lx).toBeCloseTo(146.21, 2);
        expect(rx).toBeCloseTo(183.79, 2);
        expect(rx - lx - 2 * FLIPPER_R).toBeCloseTo(23.58, 2);
    });
});

describe('flipperDir', () => {
    it('points (cos 28, sin 28) = right-down for the left flipper and (-cos 28, sin 28) = left-down for the right one when resting', () => {
        const [l, r] = makeFlippers();
        const [lx, ly] = flipperDir(l);
        const [rx, ry] = flipperDir(r);
        expect([lx, ly]).toEqual([expect.closeTo(0.8829, 4), expect.closeTo(0.4695, 4)]);
        expect([rx, ry]).toEqual([expect.closeTo(-0.8829, 4), expect.closeTo(0.4695, 4)]);
    });
});

describe('stepFlipper', () => {
    const dt = PHYSICS_DT;
    const fresh = (): Flipper => makeFlippers()[0];

    it('rises 4.30 degrees per step at 18 rad/s with omega -18', () => {
        const f = fresh();
        stepFlipper(f, true, dt);
        expect((f.a * 180) / Math.PI).toBeCloseTo(23.7028, 3);
        expect(f.omega).toBeCloseTo(-18, 9);
    });

    it('is at -27.86 degrees after 13 steps and stops exactly at -28 on step 14 without overshooting', () => {
        const f = fresh();
        for (let i = 0; i < 13; i++) stepFlipper(f, true, dt);
        expect((f.a * 180) / Math.PI).toBeCloseTo(-27.8634, 3);
        stepFlipper(f, true, dt);
        expect((f.a * 180) / Math.PI).toBeCloseTo(FLIPPER_UP_DEG, 9);
        expect(f.omega).toBeCloseTo(-0.572, 3);
    });

    it('stays up with omega 0 while still pressed at the top', () => {
        const f = fresh();
        for (let i = 0; i < 20; i++) stepFlipper(f, true, dt);
        expect(f.omega).toBe(0);
        expect((f.a * 180) / Math.PI).toBeCloseTo(FLIPPER_UP_DEG, 9);
    });

    it('falls back with a positive omega when released, and settles at rest with omega 0', () => {
        const f = fresh();
        for (let i = 0; i < 20; i++) stepFlipper(f, true, dt);
        stepFlipper(f, false, dt);
        expect(f.omega).toBeCloseTo(18, 9);
        for (let i = 0; i < 20; i++) stepFlipper(f, false, dt);
        expect(f.omega).toBe(0);
        expect((f.a * 180) / Math.PI).toBeCloseTo(FLIPPER_REST_DEG, 9);
    });

    it('does not move a resting flipper that is not pressed', () => {
        const f = fresh();
        stepFlipper(f, false, dt);
        expect(f.omega).toBe(0);
        expect(f.a).toBeCloseTo(deg(FLIPPER_REST_DEG), 12);
    });
});

describe('walls', () => {
    it('has the slant guides flush with the flipper top surface (end points 98.29 / 553.82, start y 501.56)', () => {
        const left = WALLS[6];
        const right = WALLS[7];
        expect(left[0]).toBe(0);
        expect(left[1]).toBeCloseTo(501.56, 2);
        expect(left[2]).toBeCloseTo(98.29, 2);
        expect(left[3]).toBeCloseTo(553.82, 2);
        expect(right[0]).toBe(330);
        expect(right[1]).toBeCloseTo(501.56, 2);
        expect(right[2]).toBeCloseTo(231.71, 2);
        expect(right[3]).toBeCloseTo(553.82, 2);
    });

    it('pushes a ball sunk 1 px into the left wall back to x = 7 and bounces it with WALL_E 0.6 (vx -100 -> +60)', () => {
        const b = ball(6, 300, -100, 0);
        const w = WALLS[0];
        expect(collideSegment(b, w[0], w[1], w[2], w[3], 0, 0.6)).toBeGreaterThanOrEqual(0);
        expect(b.x).toBeCloseTo(7, 9);
        expect(b.vx).toBeCloseTo(60, 9);
    });

    it('bounces off the lane wall from the lane side: (336, 200) with vx -100 -> x = 337, vx = +60', () => {
        const b = ball(336, 200, -100, 0);
        const w = WALLS[3];
        collideSegment(b, w[0], w[1], w[2], w[3], 0, 0.6);
        expect(b.x).toBeCloseTo(337, 9);
        expect(b.vx).toBeCloseTo(60, 9);
    });

    it('does not touch the lane wall above its top end (336, 100 is 20.9 px from (330, 120))', () => {
        const b = ball(336, 100, -100, 0);
        const w = WALLS[3];
        expect(collideSegment(b, w[0], w[1], w[2], w[3], 0, 0.6)).toBe(-1);
        expect(b.vx).toBe(-100);
    });

    it('turns a ball rising up the lane toward the table at the deflector: (345, 65) up at 500 -> (-384, -212)', () => {
        const b = ball(345, 65, 0, -500);
        const w = WALLS[5];
        collideSegment(b, w[0], w[1], w[2], w[3], 0, 0.6);
        expect(b.vx).toBeCloseTo(-384, 6);
        expect(b.vy).toBeCloseTo(-212, 6);
    });

    it('does not touch a wall at exactly the ball radius (x = 7): a ball at x = 7 moving left keeps going', () => {
        const b = ball(7, 300, -100, 0);
        const w = WALLS[0];
        expect(collideSegment(b, w[0], w[1], w[2], w[3], 0, 0.6)).toBe(-1);
        expect(b.vx).toBe(-100);
    });

    it('does not reflect a ball that is touching but moving away', () => {
        const b = ball(6, 300, 100, 0);
        const w = WALLS[0];
        collideSegment(b, w[0], w[1], w[2], w[3], 0, 0.6);
        expect(b.vx).toBe(100);
        expect(b.x).toBeCloseTo(7, 9);
    });
});

describe('collideSegment with a moving flipper', () => {
    // Left flipper at -10 degrees rising at -18 rad/s; a resting ball touches it 29 px from the root.
    const raised = (omega: number): { f: Flipper; seg: [number, number, number, number] } => {
        const f: Flipper = { px: 95, py: 560, s: 1, a: deg(-10), omega };
        const [tx, ty] = flipperTip(f);
        return { f, seg: [f.px, f.py, tx, ty] };
    };
    const contactBall = (): Ball => {
        // Contact point 29 px along the flipper, ball centre FLIPPER_R + BALL_R (minus a hair) along the up normal.
        const a = deg(-10);
        const cx = 95 + Math.cos(a) * 29;
        const cy = 560 + Math.sin(a) * 29;
        const n = [Math.sin(a), -Math.cos(a)];
        const d = FLIPPER_R + BALL_R - 0.001;
        return ball(cx + n[0] * d, cy + n[1] * d);
    };

    it('kicks a resting ball with the flipper surface speed: v = (-122.37, -693.99)', () => {
        const { f, seg } = raised(-18);
        const b = contactBall();
        const t = collideSegment(b, seg[0], seg[1], seg[2], seg[3], FLIPPER_R, 0.35, f);
        expect(t).toBeCloseTo(0.5, 3);
        expect(b.vx).toBeCloseTo(-122.37, 0);
        expect(b.vy).toBeCloseTo(-693.99, 0);
    });

    it('kicks the same way from the right flipper (mirror image): v = (+122.37, -693.99)', () => {
        // The left example mirrored about x = 165 (a right flipper at (235, 560), s = -1, direction (-cos a, sin a)).
        const f: Flipper = { px: 235, py: 560, s: -1, a: deg(-10), omega: -18 };
        const [tx, ty] = flipperTip(f);
        const a = deg(-10);
        const d = FLIPPER_R + BALL_R - 0.001;
        const b = ball(235 - Math.cos(a) * 29 - Math.sin(a) * d, 560 + Math.sin(a) * 29 - Math.cos(a) * d);
        const t = collideSegment(b, f.px, f.py, tx, ty, FLIPPER_R, 0.35, f);
        expect(t).toBeCloseTo(0.5, 3);
        expect(b.vx).toBeCloseTo(122.37, 0);
        expect(b.vy).toBeCloseTo(-693.99, 0);
    });

    it('lets stepWorld kick a ball up with the right flipper when only the right command is given', () => {
        // A ball resting on the right flipper's middle, the flipper pressed: the ball must leave upward.
        const w = emptyWorld(ball(235 - 0.883 * 29 - 0.469 * 14, 560 + 0.469 * 29 - 0.883 * 14, 0, 0));
        for (let i = 0; i < 12; i++) stepWorld(w, false, true, PHYSICS_DT);
        expect(w.ball.vy).toBeLessThan(-100);
    });

    it('leaves a resting ball alone when the flipper is not moving (omega 0)', () => {
        const { f, seg } = raised(0);
        const b = contactBall();
        collideSegment(b, seg[0], seg[1], seg[2], seg[3], FLIPPER_R, 0.35, f);
        expect(b.vx).toBe(0);
        expect(b.vy).toBe(0);
    });

    it('does not change a ball that is already moving away from the surface', () => {
        const { f, seg } = raised(0);
        const b = contactBall();
        b.vy = -300;
        collideSegment(b, seg[0], seg[1], seg[2], seg[3], FLIPPER_R, 0.35, f);
        expect(b.vy).toBe(-300);
    });

    it('pushes a ball whose centre is exactly on the segment straight up', () => {
        const b = ball(100, 560);
        collideSegment(b, 0, 560, 200, 560, 7, 0.5);
        expect(b.y).toBeCloseTo(560 - 14, 9);
    });
});

describe('collideBumper', () => {
    const bu = { x: 100, y: 300 };

    it('bounces a slow ball (200 px/s) off at BUMPER_MIN_OUT', () => {
        const b = ball(100, 300 - 22, 0, 200);
        expect(collideBumper(b, bu)).toBe(true);
        expect(b.vx).toBeCloseTo(0, 9);
        expect(b.vy).toBeCloseTo(-BUMPER_MIN_OUT, 9);
    });

    it('lifts a ball between half and full BUMPER_MIN_OUT (400 px/s) to 480 too', () => {
        const b = ball(100, 300 - 22, 0, 400);
        collideBumper(b, bu);
        expect(b.vy).toBeCloseTo(-BUMPER_MIN_OUT, 9);
    });

    it('keeps a fast ball (600 px/s) at 600', () => {
        const b = ball(100, 300 - 22, 0, 600);
        collideBumper(b, bu);
        expect(b.vy).toBeCloseTo(-600, 9);
    });

    it('sends a motionless overlapping ball out along the centre-to-ball direction at BUMPER_MIN_OUT', () => {
        const b = ball(101, 300);
        collideBumper(b, bu);
        expect(b.vx).toBeCloseTo(BUMPER_MIN_OUT, 9);
        expect(b.vy).toBeCloseTo(0, 9);
    });

    it('sends a ball sitting exactly on the centre straight up', () => {
        const b = ball(100, 300);
        collideBumper(b, bu);
        expect(b.vy).toBeCloseTo(-BUMPER_MIN_OUT, 9);
        expect(b.y).toBeCloseTo(300 - (BALL_R + BUMPER_R), 9);
    });

    it('does not hit at exactly BALL_R + BUMPER_R (23) apart', () => {
        const b = ball(100, 300 - (BALL_R + BUMPER_R), 0, 100);
        expect(collideBumper(b, bu)).toBe(false);
        expect(b.vy).toBe(100);
    });

    it('rescales a ball that is still slow after reflecting (moving away at 100 px/s)', () => {
        const b = ball(100, 300 - 22, 0, -100);
        collideBumper(b, bu);
        expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(BUMPER_MIN_OUT, 9);
    });
});

describe('blockRect / collideBlock', () => {
    const block = { col: 0, row: 0, alive: true };

    it('is the grid cell one px smaller on every side: (22, 61) 34 x 16 for the top-left cell', () => {
        expect(blockRect(block)).toEqual({ x: 22, y: 61, w: 34, h: 16 });
        expect(blockRect({ col: 7, row: 2, alive: true })).toEqual({ x: 21 + 7 * 36 + 1, y: 60 + 2 * 18 + 1, w: 34, h: 16 });
    });

    it('reflects a ball hitting from below: vy -300 -> +300, vx unchanged', () => {
        const b = ball(40, 83.9, 50, -300);
        expect(collideBlock(b, block)).toBe(true);
        expect(b.vy).toBeCloseTo(300, 9);
        expect(b.vx).toBe(50);
        expect(b.y).toBeCloseTo(84, 9);
    });

    it('reflects a ball hitting from the left side: vx 100 -> -100', () => {
        const b = ball(22 - 6.9, 69, 100, 0);
        expect(collideBlock(b, block)).toBe(true);
        expect(b.vx).toBeCloseTo(-100, 9);
        expect(b.vy).toBe(0);
    });

    it('uses the corner-to-centre direction at a corner: (100, 100) -> (-100, -100)', () => {
        const b = ball(18, 57, 100, 100);
        expect(collideBlock(b, block)).toBe(true);
        expect(b.vx).toBeCloseTo(-100, 9);
        expect(b.vy).toBeCloseTo(-100, 9);
    });

    it('breaks on overlap even when the ball is moving away: no reflection, but still a hit', () => {
        const b = ball(40, 77 + 6, 0, 100); // overlapping the bottom face, already moving down and away
        expect(collideBlock(b, block)).toBe(true);
        expect(b.vy).toBe(100);
        const w: World = { ball: ball(40, 83, 0, 100), extras: [], flippers: makeFlippers(), bumpers: [], blocks: [{ col: 0, row: 0, alive: true }] };
        const ev = stepWorld(w, false, false, PHYSICS_DT);
        expect(ev.blocks).toBe(1);
        expect(w.blocks[0].alive).toBe(false);
    });

    it('does not overlap at exactly BALL_R from the bottom face', () => {
        const b = ball(40, 77 + BALL_R, 0, -100);
        expect(collideBlock(b, block)).toBe(false);
        expect(b.vy).toBe(-100);
    });

    it('pushes a ball whose centre is inside the block out through the nearest face (top wins a tie with bottom)', () => {
        const b = ball(40, 69, 0, 100);
        expect(collideBlock(b, block)).toBe(true);
        expect(b.y).toBeCloseTo(69 - (8 + BALL_R), 9);
        expect(b.vy).toBeCloseTo(-100, 9);
    });

    it('pushes a ball inside the block out through the left face when that is nearest', () => {
        const b = ball(25, 69, 100, 0);
        collideBlock(b, block);
        expect(b.x).toBeCloseTo(22 - BALL_R, 9);
        expect(b.vx).toBeCloseTo(-100, 9);
    });

    it('pushes a ball inside the block out through the right face when that is nearest', () => {
        const b = ball(54, 69, -100, 0);
        collideBlock(b, block);
        expect(b.x).toBeCloseTo(56 + BALL_R, 9);
        expect(b.vx).toBeCloseTo(100, 9);
    });

    it('pushes a ball inside the block out through the bottom face when that is nearest', () => {
        const b = ball(40, 75, 0, -100);
        collideBlock(b, block);
        expect(b.y).toBeCloseTo(77 + BALL_R, 9);
        expect(b.vy).toBeCloseTo(100, 9);
    });
});

describe('stepWorld', () => {
    it('lets a free ball fall: vy grows by GRAVITY * dt and y by vy * dt', () => {
        const w = emptyWorld(ball(165, 300));
        stepWorld(w, false, false, PHYSICS_DT);
        expect(w.ball.vy).toBeCloseTo(GRAVITY * PHYSICS_DT, 9);
        expect(w.ball.y).toBeCloseTo(300 + GRAVITY * PHYSICS_DT * PHYSICS_DT, 9);
    });

    it('caps the ball speed at MAX_SPEED while keeping its direction', () => {
        const w = emptyWorld(ball(165, 300, 3000, 0));
        stepWorld(w, false, false, PHYSICS_DT);
        expect(ballSpeed(w.ball)).toBeCloseTo(MAX_SPEED, 6);
        expect(w.ball.vx).toBeGreaterThan(0);
    });

    it('breaks both blocks a ball overlaps in one step and counts 2', () => {
        const w: World = { ball: ball(57, 69), extras: [], flippers: makeFlippers(), bumpers: [], blocks: loadBlocks(1) };
        const ev = stepWorld(w, false, false, PHYSICS_DT);
        expect(ev.blocks).toBe(2);
        expect(w.blocks.filter((b) => !b.alive)).toHaveLength(2);
    });

    it('counts a bumper hit once per step', () => {
        const w: World = { ball: ball(95, 280), extras: [], flippers: makeFlippers(), bumpers: loadBumpers(1), blocks: [] };
        const ev = stepWorld(w, false, false, PHYSICS_DT);
        expect(ev.bumpers).toBe(1);
        expect(ev.blocks).toBe(0);
    });

    it('tells the sink which blocks were hit (by index), without changing the result', () => {
        const make = (): World => ({ ball: ball(57, 69), extras: [], flippers: makeFlippers(), bumpers: [], blocks: loadBlocks(1) });
        const withSink = make();
        const without = make();
        const blocks: number[] = [];
        const bumpers: number[] = [];
        stepWorld(withSink, false, false, PHYSICS_DT, { block: (i) => blocks.push(i), bumper: (i) => bumpers.push(i) });
        stepWorld(without, false, false, PHYSICS_DT);
        expect(blocks).toEqual([0, 1]);
        expect(bumpers).toEqual([]);
        expect(withSink).toEqual(without);
    });

    it('tells the sink which bumper was hit (by index), without changing the result', () => {
        const make = (): World => ({ ball: ball(95, 280), extras: [], flippers: makeFlippers(), bumpers: loadBumpers(1), blocks: [] });
        const withSink = make();
        const without = make();
        const bumpers: number[] = [];
        stepWorld(withSink, false, false, PHYSICS_DT, { block: () => undefined, bumper: (i) => bumpers.push(i) });
        stepWorld(without, false, false, PHYSICS_DT);
        expect(bumpers).toEqual([0]);
        expect(withSink).toEqual(without);
    });

    it('reports a drain once the ball is below the table', () => {
        const w = emptyWorld(ball(165, H + 40));
        expect(stepWorld(w, false, false, PHYSICS_DT).drained).toBe(true);
        expect(stepWorld(emptyWorld(ball(165, 300)), false, false, PHYSICS_DT).drained).toBe(false);
    });

    it('swings the left flipper with the left command only', () => {
        const w = emptyWorld(ball(165, 300));
        stepWorld(w, true, false, PHYSICS_DT);
        expect(w.flippers[0].omega).toBeLessThan(0);
        expect(w.flippers[1].omega).toBe(0);
    });

    it('swings the right flipper with the right command only', () => {
        const w = emptyWorld(ball(165, 300));
        stepWorld(w, false, true, PHYSICS_DT);
        expect(w.flippers[0].omega).toBe(0);
        expect(w.flippers[1].omega).toBeLessThan(0);
    });

    it('caps a ball a rising flipper would send past MAX_SPEED (a 1000 px/s ball hit by the flipper surface)', () => {
        // Left flipper at rest, pressed: it starts rising at -18 rad/s. A fast ball falls onto its middle.
        const rest = deg(FLIPPER_REST_DEG);
        const d = 29;
        const n = [Math.sin(rest), -Math.cos(rest)]; // up normal of the resting left flipper
        const cx = 95 + Math.cos(rest) * d;
        const cy = 560 + Math.sin(rest) * d;
        const w = emptyWorld(ball(cx + n[0] * 12, cy + n[1] * 12, 0, 1000));
        const before = ball(w.ball.x, w.ball.y, 0, 1000);
        stepWorld(w, true, false, PHYSICS_DT);
        // It really was hit: sent upward, far from where free flight would put it (vy 1000 -> about 1003).
        expect(w.ball.vy).toBeLessThan(0);
        expect(before.vy).toBe(1000);
        expect(ballSpeed(w.ball)).toBeCloseTo(MAX_SPEED, 6);
    });

    it('keeps the speed at or below MAX_SPEED even right after a flipper kick', () => {
        const f = makeFlippers();
        for (let i = 0; i < 6; i++) stepFlipper(f[0], true, PHYSICS_DT);
        const [tx, ty] = flipperTip(f[0]);
        const w: World = { ball: ball(tx - 10, ty - 14, 0, 0), extras: [], flippers: f, bumpers: [], blocks: [] };
        for (let i = 0; i < 4; i++) {
            stepWorld(w, true, false, PHYSICS_DT);
            expect(ballSpeed(w.ball)).toBeLessThanOrEqual(MAX_SPEED + 1e-9);
        }
    });
});

describe('slow balls on the slants (the flipper-root stall regression)', () => {
    const starts: Array<[number, number, number]> = [
        [30, 480, 0],
        [60, 470, 30],
        [300, 480, 0],
        [270, 470, -30],
        [150, 300, 0],
        [180, 300, 0],
    ];

    it.each(starts)('a ball dropped at (%d, %d) with vx %d rolls down and drains within 15 s', (x, y, vx) => {
        const w = emptyWorld(ball(x, y, vx, 0));
        let drainedAt = -1;
        for (let i = 0; i < 240 * 15; i++) {
            if (stepWorld(w, false, false, PHYSICS_DT).drained) {
                drainedAt = i;
                break;
            }
        }
        expect(drainedAt).toBeGreaterThanOrEqual(0);
    });
});

describe('launching from the lane', () => {
    /** Launch with `charge` and fly until the ball is back in the lane (ready again), or `seconds` pass. */
    const fly = (charge: number, seconds: number): { minY: number; returned: boolean; w: World } => {
        const w = emptyWorld(makeBall());
        w.ball.vy = -launchSpeed(charge);
        let minY = Infinity;
        let returned = false;
        for (let i = 0; i < 240 * seconds; i++) {
            if (stepWorld(w, false, false, PHYSICS_DT).drained) break;
            minY = Math.min(minY, w.ball.y);
            if (i > 60 && isReady(w.ball)) {
                returned = true;
                break;
            }
        }
        return { minY, returned, w };
    };

    it('a charge of 0 rises about 145 px and falls back into the lane', () => {
        const { minY, returned } = fly(0, 10);
        expect(LANE_FLOOR_Y - BALL_R - minY).toBeGreaterThan(140);
        expect(LANE_FLOOR_Y - BALL_R - minY).toBeLessThan(150);
        expect(returned).toBe(true);
    });

    it('a charge of 0.5 stays in the lane (its peak is below the lane wall top) and returns', () => {
        const { minY, returned, w } = fly(0.5, 10);
        expect(minY).toBeGreaterThan(120);
        expect(w.ball.x).toBeGreaterThan(330);
        expect(returned).toBe(true);
    });

    it('a full charge gets out of the lane onto the table', () => {
        const w = emptyWorld(makeBall());
        w.ball.vy = -launchSpeed(1);
        let reachedTable = false;
        for (let i = 0; i < 240 * 3; i++) {
            stepWorld(w, false, false, PHYSICS_DT);
            if (w.ball.x < 330) {
                reachedTable = true;
                break;
            }
        }
        expect(reachedTable).toBe(true);
    });
});

describe('collideSegment properties (independent oracle)', () => {
    // A seeded LCG, so the cases are the same on every run.
    let seed = 12345;
    const rand = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);

    /** Distance from a point to a segment, written separately from the implementation. */
    const distToSegment = (px: number, py: number, s: number[]): number => {
        const [ax, ay, bx, by] = s;
        const abx = bx - ax;
        const aby = by - ay;
        let t = ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby);
        t = Math.min(1, Math.max(0, t));
        return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
    };

    it('always leaves the ball outside the capsule, never speeds it up, and reports a hit exactly when they overlapped', () => {
        let overlaps = 0;
        for (let i = 0; i < 4000; i++) {
            const seg = [rand() * 300, rand() * 300, rand() * 300, rand() * 300];
            if (Math.hypot(seg[2] - seg[0], seg[3] - seg[1]) < 5) continue;
            const radius = rand() * 8;
            const e = rand();
            const b = ball(rand() * 300, rand() * 300, (rand() - 0.5) * 800, (rand() - 0.5) * 800);
            const before = distToSegment(b.x, b.y, seg);
            const speedBefore = ballSpeed(b);
            const hit = collideSegment(b, seg[0], seg[1], seg[2], seg[3], radius, e);
            const after = distToSegment(b.x, b.y, seg);
            if (after < BALL_R + radius - 1e-6) expect.fail(`ball left inside the capsule: ${JSON.stringify({ seg, radius, b })}`);
            if (ballSpeed(b) > speedBefore + 1e-6) expect.fail(`ball sped up: ${JSON.stringify({ seg, radius, e })}`);
            if (before >= BALL_R + radius) {
                if (hit !== -1) expect.fail('hit reported without an overlap');
            } else {
                overlaps += 1;
                if (hit < 0 || hit > 1) expect.fail('overlap without a contact t in 0..1');
            }
        }
        // Guard against a vacuous run: a good share of the random cases must really overlap (about 190 of 4000).
        expect(overlaps).toBeGreaterThan(100);
    });
});
