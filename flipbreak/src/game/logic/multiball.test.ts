// Special blocks and the multiball (docs/spec/multiball.md). Expected values are worked out by hand from the spec:
// block cell centres from BLOCK_X0 21 / BLOCK_Y0 60 / BLOCK_W 36 / BLOCK_H 18, speeds from GRAVITY 700 and PHYSICS_DT 1/240.
import { describe, expect, it } from 'vitest';
import { BALL_R, H, LANE_BALL_X, LANE_FLOOR_Y, LIVES, MULTI_BALL_MAX, SCORE_BLOCK } from '../params';
import { stepFlipper, stepWorld, makeFlippers, removeBall, type Ball, type StepSink, type World } from './physics';
import { GameSession, type FrameInput } from './session';
import { loadBlocks, loadBumpers, STAGES } from './stages';
import { TrailSet } from './trail';

const DT = 1 / 240;
const ball = (x: number, y: number, vx = 0, vy = 0): Ball => ({ x, y, vx, vy });
const idle: FrameInput = { left: false, right: false, charge: false };

/** A table of the given stage (no bumpers unless asked) with the given balls; the first is the world's `ball`. */
function table(stage: number, balls: Ball[], bumpers = false): World {
    const [first, ...rest] = balls;
    return {
        ball: first,
        extras: rest,
        flippers: makeFlippers(),
        bumpers: bumpers ? loadBumpers(stage) : [],
        blocks: loadBlocks(stage),
    };
}

/** Keep only the listed blocks (by index) alive, so a ball under the top row meets just the block the test is about. */
function keepOnly(w: World, ...indices: number[]): World {
    w.blocks.forEach((b, i) => (b.alive = indices.includes(i)));
    return w;
}

/** A ball just under the special block (0, 0) of stage 1, moving up: it breaks it in the next step. */
const underTopLeft = (vx = 0) => ball(40, 83.9, vx, -300);
/** A ball far from everything, at rest (it only falls slowly in one step). */
const idleBall = (x = 165, y = 200) => ball(x, y);

describe('special blocks in the stage definitions', () => {
    const SPECIALS: Array<Array<[number, number]>> = [
        [[0, 0], [0, 7]],
        [[0, 0], [1, 7]],
        [[0, 0], [0, 7]],
        [[0, 3], [1, 5]],
        [[0, 0], [0, 7]],
    ];

    it.each([1, 2, 3, 4, 5])('marks exactly the two special blocks of stage %i (row, column from the spec table)', (stage) => {
        const found = loadBlocks(stage)
            .filter((b) => b.special)
            .map((b) => [b.row, b.col]);
        expect(found).toEqual(SPECIALS[stage - 1]);
    });

    it('keeps the block count per stage at 24 / 16 / 26 / 20 / 34 with the specials counted', () => {
        expect([1, 2, 3, 4, 5].map((s) => loadBlocks(s).length)).toEqual([24, 16, 26, 20, 34]);
    });

    it('leaves ordinary blocks without a special mark', () => {
        expect(loadBlocks(1)[1].special).toBeUndefined();
        expect(STAGES[0].rows[0]).toBe('*######*');
    });
});

describe('adding a ball when a special block breaks', () => {
    it('puts the new ball at the cell centre with the breaker\'s x speed reversed and its y speed kept', () => {
        const w = keepOnly(table(1, [underTopLeft(100)]), 0, 23);
        const ev = stepWorld(w, false, false, DT);
        expect(ev.blocks).toBe(1);
        expect(w.extras).toHaveLength(1);
        const extra = w.extras[0];
        expect(extra.x).toBe(39); // 21 + 0 * 36 + 18
        expect(extra.y).toBe(69); // 60 + 0 * 18 + 9
        expect(extra.vx).toBeCloseTo(-w.ball.vx, 12);
        expect(w.ball.vx).toBeCloseTo(100, 9);
        // vy after the step: -300 + 700 / 240 = -297.083, reflected off the block (BLOCK_E 1) to +297.083.
        expect(w.ball.vy).toBeCloseTo(297.0833, 3);
        expect(extra.vy).toBe(w.ball.vy);
    });

    it('does not move the added ball in the step it appears, and moves it from the next step', () => {
        const w = keepOnly(table(1, [underTopLeft(100)]), 0, 23);
        stepWorld(w, false, false, DT);
        expect(w.extras[0]).toMatchObject({ x: 39, y: 69 });
        stepWorld(w, false, false, DT);
        expect(w.extras[0].y).toBeGreaterThan(69);
        expect(w.extras[0].x).toBeLessThan(39);
    });

    it('gives +MULTI_SIDE_VX (120) to a ball added left of the table middle when the breaker has no x speed', () => {
        const w = keepOnly(table(1, [underTopLeft(0)]), 0, 23);
        stepWorld(w, false, false, DT);
        expect(w.extras[0].vx).toBe(120);
    });

    it('gives -MULTI_SIDE_VX to a ball added at the right of the middle (stage 1 top-right block, centre x 291)', () => {
        const w = keepOnly(table(1, [ball(290, 83.9, 0, -300)]), 7, 23);
        stepWorld(w, false, false, DT);
        expect(w.extras[0]).toMatchObject({ x: 291, y: 69, vx: -120 });
    });

    it('uses +120 for the stage 4 block at row 0, column 3 (centre 147, 69), hit from above', () => {
        const w = table(4, [ball(147, 53.9, 0, 300)]);
        const ev = stepWorld(w, false, false, DT);
        expect(ev.blocks).toBe(1);
        expect(w.extras[0]).toMatchObject({ x: 147, y: 69, vx: 120 });
    });

    it('treats a breaker x speed below 1e-6 as none, and one above it as a real speed to reverse', () => {
        const none = keepOnly(table(1, [underTopLeft(5e-7)]), 0, 23);
        stepWorld(none, false, false, DT);
        expect(none.extras[0].vx).toBe(120);
        const some = keepOnly(table(1, [underTopLeft(2e-6)]), 0, 23);
        stepWorld(some, false, false, DT);
        expect(some.extras[0].vx).toBeCloseTo(-2e-6, 12);
    });

    it('adds a ball at 1 and 2 balls, and none at MULTI_BALL_MAX (3), still breaking the block for its points', () => {
        expect(MULTI_BALL_MAX).toBe(3);
        const two = keepOnly(table(1, [underTopLeft(100), idleBall()]), 0, 23);
        stepWorld(two, false, false, DT);
        expect(two.extras).toHaveLength(2);
        const three = keepOnly(table(1, [underTopLeft(100), idleBall(), idleBall(200, 220)]), 0, 23);
        const ev = stepWorld(three, false, false, DT);
        expect(three.extras).toHaveLength(2);
        expect(ev.blocks).toBe(1);
        expect(three.blocks[0].alive).toBe(false);
    });

    it('adds only one ball when two special blocks break in one step with 2 balls (the cap is checked each time)', () => {
        const w = keepOnly(table(1, [underTopLeft(100), ball(290, 83.9, 100, -300)]), 0, 7, 23);
        const ev = stepWorld(w, false, false, DT);
        expect(ev.blocks).toBe(2);
        expect(w.extras).toHaveLength(2); // the second ball plus one added
        expect(w.extras[1]).toMatchObject({ x: 39, y: 69 }); // the first breaker's block came first
    });

    it('adds no ball for special blocks broken in one step when 3 balls are already on the table', () => {
        const w = keepOnly(table(1, [underTopLeft(100), ball(290, 83.9, 100, -300), idleBall()]), 0, 7, 23);
        stepWorld(w, false, false, DT);
        expect(w.extras).toHaveLength(2); // already 3 balls: nothing added
    });

    it('breaks a block only once when two balls overlap it in the same step, so one ball is added', () => {
        const w = keepOnly(table(1, [underTopLeft(100), ball(41, 83.9, 100, -300)]), 0, 23);
        const ev = stepWorld(w, false, false, DT);
        expect(ev.blocks).toBe(1);
        expect(w.extras).toHaveLength(2);
    });

    it('adds no ball when the special block was the last block of the stage (the stage is cleared)', () => {
        const w = table(1, [underTopLeft(100)]);
        w.blocks.forEach((b, i) => (b.alive = i === 0));
        const ev = stepWorld(w, false, false, DT);
        expect(ev.blocks).toBe(1);
        expect(w.extras).toHaveLength(0);
    });

    it('adds nothing for an ordinary block', () => {
        const w = keepOnly(table(1, [ball(57, 83.9, 100, -300)]), 1, 23); // under block (0, 1): an ordinary one
        const ev = stepWorld(w, false, false, DT);
        expect(ev.blocks).toBe(1);
        expect(w.extras).toHaveLength(0);
    });
});

describe('several balls in one physics step', () => {
    it('swings the flippers once per step, whatever the number of balls', () => {
        const one = table(1, [idleBall()]);
        const three = table(1, [idleBall(), idleBall(100, 220), idleBall(200, 240)]);
        const expected = makeFlippers();
        stepFlipper(expected[0], true, DT);
        stepWorld(one, true, false, DT);
        stepWorld(three, true, false, DT);
        expect(one.flippers[0].a).toBeCloseTo(expected[0].a, 12);
        expect(three.flippers[0].a).toBeCloseTo(expected[0].a, 12);
        expect(three.flippers[0].omega).toBeCloseTo(-18, 9);
    });

    it('lets every ball fall under gravity and does not make balls touch each other', () => {
        const w = table(1, [ball(165, 200), ball(165, 200)]);
        stepWorld(w, false, false, DT);
        expect(w.ball.vy).toBeCloseTo(700 * DT, 12);
        expect(w.extras[0].vy).toBeCloseTo(700 * DT, 12);
        expect(w.extras[0].x).toBe(165); // not pushed away by the ball at the same place
    });

    it('counts a bumper hit for each ball that touches it and tells the sink once per hit', () => {
        const w = table(1, [ball(95, 283), ball(95, 317)], true); // 17 px from the bumper (95, 300): within 7 + 16
        const hits: number[] = [];
        const sink: StepSink = { block: () => undefined, bumper: (i) => void hits.push(i) };
        const ev = stepWorld(w, false, false, DT, sink);
        expect(ev.bumpers).toBe(2);
        expect(hits).toEqual([0, 0]);
    });
});

describe('balls falling out and parking in the lane', () => {
    it('takes a fallen ball off the table without reporting a drain while another ball remains', () => {
        const w = table(1, [idleBall(), ball(165, 700)]);
        const ev = stepWorld(w, false, false, DT);
        expect(ev.drained).toBe(false);
        expect(w.extras).toHaveLength(0);
        expect(w.ball.y).toBeCloseTo(200, 1);
    });

    it('promotes the next ball when the first one falls out', () => {
        const w = table(1, [ball(165, 700), idleBall(120, 210)]);
        const ev = stepWorld(w, false, false, DT);
        expect(ev.drained).toBe(false);
        expect(w.extras).toHaveLength(0);
        expect(w.ball.x).toBe(120);
    });

    it('reports a drain only when every ball has fallen out in the same step', () => {
        const w = table(1, [ball(165, 700), ball(100, 700)]);
        expect(stepWorld(w, false, false, DT).drained).toBe(true);
    });

    it('reports no drain for balls just above H + 3 * BALL_R, and a drain just past it', () => {
        const edge = table(1, [ball(165, H + 3 * BALL_R - 0.1), ball(100, H + 3 * BALL_R - 0.1)]);
        expect(stepWorld(edge, false, false, DT).drained).toBe(false);
        const past = table(1, [ball(165, H + 3 * BALL_R + 0.5), ball(100, H + 3 * BALL_R + 0.5)]);
        expect(stepWorld(past, false, false, DT).drained).toBe(true);
    });

    it('adds the special block\'s ball even when another ball falls out in the same step, and reports no drain', () => {
        const w = keepOnly(table(1, [underTopLeft(100), ball(165, 700)]), 0, 23);
        const ev = stepWorld(w, false, false, DT);
        expect(ev.drained).toBe(false);
        expect(ev.blocks).toBe(1);
        expect(w.extras).toHaveLength(1); // the breaker stays as the first ball, the added ball follows
        expect(w.ball.y).toBeLessThan(100);
        expect(w.extras[0]).toMatchObject({ x: 39, y: 69 });
    });

    it('removes a ball that rests in the lane while another ball is in play', () => {
        const w = table(1, [idleBall(), ball(LANE_BALL_X, LANE_FLOOR_Y - BALL_R)]);
        stepWorld(w, false, false, DT);
        expect(w.extras).toHaveLength(0);
        expect(w.ball.x).toBe(165);
    });

    it('removes the first ball when only it rests in the lane and others are in play', () => {
        const w = table(1, [ball(LANE_BALL_X, LANE_FLOOR_Y - BALL_R), idleBall(120, 210)]);
        stepWorld(w, false, false, DT);
        expect(w.extras).toHaveLength(0);
        expect(w.ball.x).toBe(120);
    });

    it('keeps the first ball when all balls rest in the lane', () => {
        const first = ball(LANE_BALL_X, LANE_FLOOR_Y - BALL_R);
        const w = table(1, [first, ball(LANE_BALL_X, LANE_FLOOR_Y - BALL_R), ball(LANE_BALL_X, LANE_FLOOR_Y - BALL_R)]);
        stepWorld(w, false, false, DT);
        expect(w.ball).toBe(first);
        expect(w.extras).toHaveLength(0);
    });

    it('leaves a single ball resting in the lane alone (it waits for the plunger)', () => {
        const w = table(1, [ball(LANE_BALL_X, LANE_FLOOR_Y - BALL_R)]);
        stepWorld(w, false, false, DT);
        expect(w.extras).toHaveLength(0);
        expect(w.ball.x).toBe(LANE_BALL_X);
    });

    it('removeBall takes the i-th ball and keeps the order of the rest', () => {
        const a = ball(1, 1);
        const b = ball(2, 2);
        const c = ball(3, 3);
        const w = table(1, [a, b, c]);
        removeBall(w, 1);
        expect([w.ball, ...w.extras]).toEqual([a, c]);
        removeBall(w, 0);
        expect(w.ball).toBe(c);
        expect(w.extras).toHaveLength(0);
    });
});

/** Put a ball somewhere with a speed of its own. */
function addBall(s: GameSession, x: number, y: number, vx = 0, vy = 0): Ball {
    const b = ball(x, y, vx, vy);
    s.world.extras.push(b);
    return b;
}

describe('the session with several balls', () => {
    it('is ready for the plunger only with one ball on the table, resting in the lane', () => {
        const s = new GameSession();
        expect(s.ready).toBe(true);
        addBall(s, 165, 200);
        expect(s.ready).toBe(false);
    });

    it('is not ready with one ball that is not in the lane', () => {
        const s = new GameSession();
        s.world.ball.x = 165;
        s.world.ball.y = 300;
        expect(s.ready).toBe(false);
    });

    it('costs no life and shows no loss when one of two balls falls out', () => {
        const s = new GameSession();
        s.world.ball.x = 165;
        s.world.ball.y = 700;
        addBall(s, 165, 200);
        const ev = s.frame(idle, 50);
        expect(s.lives).toBe(LIVES);
        expect(ev.ballsLost).toBe(0);
        expect(s.phase).toBe('playing');
        expect(s.world.extras).toHaveLength(0);
        expect(s.world.ball.y).toBeGreaterThan(200.5); // the rest of the frame went on for the other ball
    });

    it('costs a life when the last ball falls out: it reports the loss and puts one ball in the lane', () => {
        const s = new GameSession();
        s.world.ball.x = 165;
        s.world.ball.y = 700;
        addBall(s, 165, 200);
        s.frame(idle, 50);
        s.world.ball.y = 700;
        const ev = s.frame(idle, 50);
        expect(s.lives).toBe(LIVES - 1);
        expect(ev.ballsLost).toBe(1);
        expect(s.world.extras).toHaveLength(0);
        expect(s.world.ball).toEqual({ x: LANE_BALL_X, y: LANE_FLOOR_Y - BALL_R, vx: 0, vy: 0 });
        expect(s.charge).toBe(0);
        expect(s.ready).toBe(true);
    });

    it('costs one life, not two, when two balls fall out in the same step', () => {
        const s = new GameSession();
        s.world.ball.x = 165;
        s.world.ball.y = 700;
        addBall(s, 100, 700);
        const ev = s.frame(idle, 50);
        expect(s.lives).toBe(LIVES - 1);
        expect(ev.ballsLost).toBe(1);
        expect(s.world.extras).toHaveLength(0);
    });

    it('ends the game when the last ball falls with one life left, and keeps no ball afterwards', () => {
        const s = new GameSession();
        s.lives = 1;
        s.world.ball.x = 165;
        s.world.ball.y = 700;
        addBall(s, 165, 200);
        s.frame(idle, 50);
        expect(s.phase).toBe('playing');
        expect(s.lives).toBe(1);
        s.world.ball.y = 700;
        const ev = s.frame(idle, 50);
        expect(s.lives).toBe(0);
        expect(ev.ballsLost).toBe(1);
        expect(s.phase).toBe('ending');
    });

    it('breaks a special block through frames: +100, one more ball, and the lives stay', () => {
        const s = new GameSession();
        s.world.blocks.forEach((b, i) => (b.alive = i === 0 || i === 23));
        s.world.ball.x = 40;
        s.world.ball.y = 83.9;
        s.world.ball.vx = 100;
        s.world.ball.vy = -300;
        const ev = s.frame(idle, 5);
        expect(ev.brokenBlocks).toEqual([0]);
        expect(s.score).toBe(SCORE_BLOCK);
        expect(s.world.extras).toHaveLength(1);
        expect(s.lives).toBe(LIVES);
    });

    it('counts a bumper hit by each ball for its points', () => {
        const s = new GameSession();
        s.world.ball.x = 95;
        s.world.ball.y = 283;
        addBall(s, 95, 317);
        const ev = s.frame(idle, 5);
        expect(ev.hitBumpers).toEqual([0]); // one entry per bumper, not per ball
        expect(s.score).toBe(20); // 2 balls x BUMPER_SCORE 10
    });

    it('keeps the balls frozen while the stage clear message shows, then starts the next stage with one ball in the lane', () => {
        const s = new GameSession();
        s.world.blocks.forEach((b, i) => (b.alive = i === 0));
        s.world.ball.x = 40;
        s.world.ball.y = 83.9;
        s.world.ball.vx = 100;
        s.world.ball.vy = -300;
        addBall(s, 200, 200);
        s.frame(idle, 5);
        expect(s.phase).toBe('stageClear');
        expect(s.world.extras).toHaveLength(1); // the last block was special, but no ball was added
        const frozen = { ...s.world.extras[0] };
        s.frame(idle, 50);
        expect(s.world.extras[0]).toEqual(frozen);
        for (let i = 0; i < 21; i++) s.frame(idle, 50);
        expect(s.stage).toBe(2);
        expect(s.world.extras).toHaveLength(0);
        expect(s.world.ball.x).toBe(LANE_BALL_X);
        expect(s.world.ball.y).toBeCloseTo(LANE_FLOOR_Y - BALL_R, 0);
    });
});

describe('stall rescue with several balls', () => {
    // Frames of exactly 2^-10 s, so a timer adds up exactly: 5 s = 5120 frames.
    const TICK_MS = 1000 / 1024;
    const setBall = (b: Ball, x: number, y: number, vx: number, vy: number) => Object.assign(b, { x, y, vx, vy });
    const parked = (b: Ball, x = 165, y = 300) => setBall(b, x, y, 0, 0);
    const moving = (b: Ball) => setBall(b, 165, 300, 0, -500);
    const frames = (s: GameSession, n: number, hold: (i: number) => void) => {
        for (let i = 0; i < n; i++) {
            hold(i);
            s.frame(idle, TICK_MS);
        }
    };

    it('removes the still ball (no life lost) after STALL_TIME when another ball keeps moving, and not before', () => {
        const s = new GameSession();
        const extra = addBall(s, 200, 200);
        const hold = () => {
            moving(s.world.ball);
            parked(extra, 200, 200);
        };
        frames(s, 5119, hold);
        expect(s.world.extras).toHaveLength(1);
        frames(s, 1, hold);
        expect(s.world.extras).toHaveLength(0);
        expect(s.lives).toBe(LIVES);
        expect(s.world.ball.x).toBeCloseTo(165, 0); // the moving ball was not sent to the lane
    });

    it('sends the only ball to the lane when two still balls reach STALL_TIME together: one is removed, one returns', () => {
        const s = new GameSession();
        const extra = addBall(s, 200, 200);
        const hold = () => {
            parked(s.world.ball);
            parked(extra, 200, 200);
        };
        frames(s, 5120, hold);
        expect(s.world.extras).toHaveLength(0);
        expect(s.world.ball).toEqual({ x: LANE_BALL_X, y: LANE_FLOOR_Y - BALL_R, vx: 0, vy: 0 });
        expect(s.lives).toBe(LIVES);
        expect(s.score).toBe(0);
    });

    it('counts an added ball from 0: after 4.99 s the old ball is removed alone and the added one stays', () => {
        const s = new GameSession();
        frames(s, 5119, () => parked(s.world.ball));
        expect(s.world.ball.x).toBe(165);
        const extra = addBall(s, 200, 200);
        frames(s, 1, () => {
            parked(s.world.ball);
            parked(extra, 200, 200);
        });
        // The first ball reached 5 s: it is removed (two balls were on the table); the added ball stays.
        expect(s.world.extras).toHaveLength(0);
        expect(s.world.ball.x).toBe(200);
    });

    it('restarts the count of every ball when a flipper is pressed', () => {
        const s = new GameSession();
        const extra = addBall(s, 200, 200);
        for (let i = 0; i < 5120; i++) {
            moving(s.world.ball);
            parked(extra, 200, 200);
            s.frame({ ...idle, left: i % 1000 === 0 }, TICK_MS);
        }
        // Presses at i = 0, 1000, ..., 5000 restart the count: only 119 frames since the last one.
        expect(s.world.extras).toHaveLength(1);
    });
});

describe('a trail for each ball', () => {
    const world = (...balls: Ball[]): World => table(1, balls);
    const moveAll = (w: World, dx: number) => {
        w.ball.x += dx;
        w.extras.forEach((b) => (b.x += dx));
    };

    it('records every ball in a buffer of its own', () => {
        const set = new TrailSet();
        const w = world(ball(100, 300, 0, 500), ball(200, 300, 0, 500));
        set.record(w);
        moveAll(w, 10);
        set.record(w);
        expect(set.buffers.map((b) => b.size)).toEqual([2, 2, 0]);
        expect(set.buffers[0].x(0)).toBe(110);
        expect(set.buffers[1].x(0)).toBe(210);
    });

    it('starts a ball that appears with an empty buffer while the others keep theirs', () => {
        const set = new TrailSet();
        const w = world(ball(100, 300, 0, 500));
        set.record(w);
        moveAll(w, 10);
        set.record(w);
        w.extras.push(ball(200, 300, 0, 500));
        moveAll(w, 10);
        set.record(w);
        expect(set.buffers.map((b) => b.size)).toEqual([3, 1, 0]);
    });

    it('empties the buffer of a ball that is gone and keeps the history of the ones left', () => {
        const set = new TrailSet();
        const w = world(ball(100, 300, 0, 500), ball(200, 300, 0, 500));
        set.record(w);
        moveAll(w, 10);
        set.record(w);
        removeBall(w, 0);
        moveAll(w, 10);
        set.record(w);
        expect(set.buffers.map((b) => b.size)).toEqual([0, 3, 0]);
        expect(set.buffers[1].x(2)).toBe(200);
    });

    it('treats a new ball object in the first place as a new ball (a ball put back in the lane)', () => {
        const set = new TrailSet();
        const w = world(ball(100, 300, 0, 500));
        set.record(w);
        set.record(w);
        w.ball = ball(100, 300, 0, 500);
        set.record(w);
        expect(set.buffers[0].size).toBe(1);
    });

    it('records nothing for a slow ball (below TRAIL_MIN_SPEED)', () => {
        const set = new TrailSet();
        set.record(world(ball(100, 300, 0, 299)));
        expect(set.buffers[0].size).toBe(0);
    });

    it('makes MULTI_BALL_MAX buffers', () => {
        expect(new TrailSet().buffers).toHaveLength(MULTI_BALL_MAX);
    });
});

describe('the stall speed boundary for an added ball', () => {
    // Like the one-ball tests: frames of 2^-10 s with the ball parked at rest, and one zero-length frame in which no
    // time passes and nothing steps, so the speed set there is exactly what gets judged.
    const TICK_MS = 1000 / 1024;
    const play = (boundarySpeed: number, framesAfter: number) => {
        const s = new GameSession();
        const extra = addBall(s, 200, 200);
        const hold = (speed: number, ms: number) => {
            Object.assign(s.world.ball, { x: 165, y: 300, vx: 0, vy: -500 });
            Object.assign(extra, { x: 200, y: 200, vx: 0, vy: speed });
            s.frame(idle, ms);
        };
        for (let i = 0; i < 4000; i++) hold(0, TICK_MS);
        hold(boundarySpeed, 0);
        for (let i = 0; i < framesAfter; i++) hold(0, TICK_MS);
        return s;
    };

    it('counts an added ball at 14 px/s (below STALL_SPEED) as still: 4000 + 1120 frames reach 5 s', () => {
        expect(play(14, 1119).world.extras).toHaveLength(1);
        expect(play(14, 1120).world.extras).toHaveLength(0);
    });

    it('starts an added ball counting again at 15 px/s (STALL_SPEED): it is still there at the old 5 s mark', () => {
        expect(play(15, 1120).world.extras).toHaveLength(1);
        expect(play(15, 5119).world.extras).toHaveLength(1);
        expect(play(15, 5120).world.extras).toHaveLength(0);
    });
});

describe('play without special blocks stays a one-ball game', () => {
    it('keeps one ball and exact accounting of points and lives over a scripted play of stage 1 with the marks removed', () => {
        const s = new GameSession();
        s.world.blocks.forEach((b) => delete b.special);
        let broken = 0;
        let bumperHits = 0;
        let lost = 0;
        for (let i = 0; i < 6000; i++) {
            // Charge to the full while the ball waits in the lane (one second), then release; flippers pulse.
            const input: FrameInput = { left: i % 40 < 6, right: i % 40 >= 20 && i % 40 < 26, charge: s.ready && i % 70 < 65 };
            const ev = s.frame(input, 1000 / 60);
            broken += ev.brokenBlocks.length;
            bumperHits += s.world.bumpers.length > 0 ? ev.hitBumpers.length : 0;
            lost += ev.ballsLost;
            if (s.world.extras.length !== 0) expect.fail(`an extra ball appeared at frame ${i}`);
            if (s.phase !== 'playing') break;
        }
        expect(broken).toBeGreaterThan(0); // the script really breaks blocks
        expect(lost).toBeGreaterThan(0); // ... and really loses balls
        expect(s.lives).toBe(LIVES - lost);
        // Each broken block is 100; each bumper hit is 10 (a frame can hit one bumper with a ball more than once, so >=).
        expect(s.score).toBeGreaterThanOrEqual(broken * SCORE_BLOCK + bumperHits * 10);
        expect(s.score - broken * SCORE_BLOCK).toBeGreaterThanOrEqual(0);
        expect((s.score - broken * SCORE_BLOCK) % 10).toBe(0);
    });
});

describe('the session when a ball is added and another falls out in the same frame', () => {
    it('keeps the lives, reports no loss and keeps playing', () => {
        const s = new GameSession();
        s.world.blocks.forEach((b, i) => (b.alive = i === 0 || i === 23));
        Object.assign(s.world.ball, { x: 40, y: 83.9, vx: 100, vy: -300 });
        addBall(s, 165, 700);
        const ev = s.frame(idle, 5);
        expect(ev.brokenBlocks).toEqual([0]);
        expect(ev.ballsLost).toBe(0);
        expect(s.lives).toBe(LIVES);
        expect(s.phase).toBe('playing');
        expect(s.world.extras).toHaveLength(1); // the breaker plus the added ball
    });
});
