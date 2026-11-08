import { describe, expect, it } from 'vitest';
import {
    BALL_R,
    BUMPER_SCORE,
    FLIPPER_REST_DEG,
    LANE_BALL_X,
    LANE_FLOOR_Y,
    LIVES,
    SCORE_BLOCK,
    STAGE_COUNT,
    W,
} from '../params';
import { InputRouter, type PointerState } from './input';
import { GameSession, type FrameInput, type FrameEvents } from './session';

const idle: FrameInput = { left: false, right: false, charge: false };
const hold: FrameInput = { ...idle, charge: true };
const FRAME_MS = 50; // the longest frame the session steps (FRAME_DT_MAX)

/** Run `n` frames of `input` and return the last frame's events. */
function run(s: GameSession, input: FrameInput, n: number, ms = FRAME_MS): FrameEvents {
    let ev: FrameEvents | null = null;
    for (let i = 0; i < n; i++) ev = s.frame(input, ms);
    return ev!;
}

/** Reach the private stage setup (the Scene never calls it directly). */
const startStage = (s: GameSession, stage: number) => (s as unknown as { startStage(n: number): void }).startStage(stage);

/** Leave exactly one block alive and put the ball on it, so the next step breaks the last block. */
function setUpLastBlock(s: GameSession): void {
    s.world.blocks.forEach((b, i) => (b.alive = i === 0));
    s.world.ball.x = 40;
    s.world.ball.y = 83.9;
    s.world.ball.vx = 0;
    s.world.ball.vy = -300;
}

describe('a new session', () => {
    it('starts on stage 1 with LIVES balls, score 0, playing, the ball in the lane and the flippers down', () => {
        const s = new GameSession();
        expect([s.stage, s.lives, s.score, s.phase]).toEqual([1, LIVES, 0, 'playing']);
        expect(s.world.ball).toEqual({ x: LANE_BALL_X, y: LANE_FLOOR_Y - BALL_R, vx: 0, vy: 0 });
        expect(s.ready).toBe(true);
        expect(s.world.blocks).toHaveLength(24);
        expect(s.world.flippers[0].a).toBeCloseTo((FLIPPER_REST_DEG * Math.PI) / 180, 12);
        expect(s.message).toBeNull();
    });
});

describe('plunger', () => {
    it('charges 0.5 per 0.5 s held (CHARGE_TIME 1 s) and stops at 1', () => {
        const s = new GameSession();
        run(s, hold, 10);
        expect(s.charge).toBeCloseTo(0.5, 9);
        run(s, hold, 30);
        expect(s.charge).toBe(1);
    });

    it('launches straight up at launchSpeed(charge) on release and clears the charge', () => {
        const s = new GameSession();
        run(s, hold, 10);
        const charge = s.charge;
        expect(charge).toBeCloseTo(0.5, 9);
        const ev = s.frame(idle, 0); // no time passes, so the launch speed shows unchanged
        expect(ev.launched).toBe(true);
        expect(s.world.ball.vx).toBe(0);
        expect(s.world.ball.vy).toBeCloseTo(-775, 6);
        expect(s.charge).toBe(0);
    });

    it('with two fingers (down at t = 0 and t = 0.3), lifting the first does not launch; lifting the last launches with the charge counted from the first press', () => {
        const s = new GameSession();
        const router = new InputRouter();
        const pointers = (frame: number): PointerState[] => {
            const list: PointerState[] = [];
            if (frame < 8) list.push({ id: 1, x: 100 }); // finger A: t = 0 .. 0.4
            if (frame >= 6 && frame < 12) list.push({ id: 2, x: 250 }); // finger B: t = 0.3 .. 0.6
            return list;
        };
        let launchedAt = -1;
        let launchVy = 0;
        for (let frame = 0; frame < 14; frame++) {
            const routed = router.route({ pointers: pointers(frame), keys: new Set(), ready: s.ready });
            // The release frame takes no time, so the launch speed shows unchanged.
            const ev = s.frame(routed, frame === 12 ? 0 : FRAME_MS);
            if (ev.launched && launchedAt < 0) {
                launchedAt = frame;
                launchVy = s.world.ball.vy;
            }
            if (frame === 8) {
                expect(ev.launched).toBe(false); // A is up, B is still down
                expect(s.charge).toBeGreaterThan(0.4); // still charging
            }
        }
        expect(launchedAt).toBe(12);
        expect(launchVy).toBeCloseTo(-840, 6); // charge 0.6 after 12 frames of 0.05 s: 450 + 650 * 0.6
    });

    it('launches at LAUNCH_MIN when released without any charge time (held for a zero-length frame)', () => {
        const s = new GameSession();
        s.frame(hold, 0);
        const ev = s.frame(idle, 0);
        expect(ev.launched).toBe(true);
        expect(s.world.ball.vy).toBe(-450);
    });

    it('does not launch without a charge held first', () => {
        const s = new GameSession();
        expect(s.frame(idle, 0).launched).toBe(false);
        expect(s.world.ball.vy).toBe(0);
    });

    it('does not launch when the ball has left the lane before the release', () => {
        const s = new GameSession();
        s.frame(hold, 0);
        s.world.ball.x = 165;
        s.world.ball.y = 300;
        const ev = s.frame(idle, 0);
        expect(ev.launched).toBe(false);
        expect(s.world.ball.vy).toBe(0);
        expect(s.charge).toBe(0);
    });

    it('cancelCharge drops the charge, and a later release does not launch', () => {
        const s = new GameSession();
        run(s, hold, 5);
        s.cancelCharge();
        expect(s.charge).toBe(0);
        expect(s.frame(idle, 0).launched).toBe(false);
    });

    it('a charge of 0.4 sends the ball up the lane (it really leaves the floor) and it comes back to rest there, no lives lost', () => {
        const s = new GameSession();
        run(s, hold, 8); // charge 0.4: 450 + 650 * 0.4 = 710 px/s
        expect(s.charge).toBeCloseTo(0.4, 9);
        let minY = Infinity;
        let backAt = -1;
        s.frame(idle, FRAME_MS);
        for (let i = 0; i < 400 && backAt < 0; i++) {
            s.frame(idle, FRAME_MS);
            minY = Math.min(minY, s.world.ball.y);
            if (i > 10 && s.ready) backAt = i;
        }
        // 710 px/s with gravity 700 rises about 360 px, still below the lane wall top (y = 120).
        expect(minY).toBeLessThan(300);
        expect(minY).toBeGreaterThan(120);
        expect(backAt).toBeGreaterThan(0);
        expect(s.world.ball.x).toBe(LANE_BALL_X);
        expect(s.lives).toBe(LIVES);
        expect(s.phase).toBe('playing');
    });
});

describe('the frame result used by the effects', () => {
    it('lists the block that broke by its index in world.blocks (column 0 of row 2 is index 16 in stage 1)', () => {
        const s = new GameSession();
        s.world.ball.x = 40;
        s.world.ball.y = 119.9;
        s.world.ball.vy = -300;
        const ev = s.frame(idle, 5);
        expect(ev.brokenBlocks).toEqual([16]);
        expect(ev.hitBumpers).toEqual([]);
        expect(ev.ballsLost).toBe(0);
    });

    it('lists two blocks broken in one step, in the order they broke', () => {
        const s = new GameSession();
        s.world.ball.x = 57;
        s.world.ball.y = 69;
        expect(s.frame(idle, 5).brokenBlocks).toEqual([0, 1]);
    });

    it('lists a bumper it hit', () => {
        const s = new GameSession();
        s.world.ball.x = 95;
        s.world.ball.y = 280;
        expect(s.frame(idle, 5).hitBumpers).toEqual([0]);
    });

    it('lists a bumper hit over many steps of one frame only once, and lists several in ascending order', () => {
        const s = new GameSession();
        // Two bumpers close together; the ball bounces between them for the whole 50 ms frame, meeting #1 first.
        s.world.bumpers = [
            { x: 100, y: 300 },
            { x: 140, y: 300 },
        ];
        s.world.ball.x = 125;
        s.world.ball.y = 300;
        const ev = s.frame(idle, 50);
        expect(ev.hitBumpers).toEqual([0, 1]);
    });

    it('reports a lost ball once (0 or 1), on the frame it was lost', () => {
        const s = new GameSession();
        s.world.ball.y = 700;
        expect(s.frame(idle, 5).ballsLost).toBe(1);
        expect(s.frame(idle, 5).ballsLost).toBe(0);
    });

    it('reports the last ball lost too (the frame that goes to ending)', () => {
        const s = new GameSession();
        s.lives = 1;
        s.world.ball.y = 700;
        expect(s.frame(idle, 5).ballsLost).toBe(1);
        expect(s.phase).toBe('ending');
    });

    it('reports a block broken and then a ball lost in the same frame, both', () => {
        const s = new GameSession();
        // A block low on the table (row 31, x 22..56, y 619..635) and another one so the stage is not cleared. The
        // ball falls past its right side, touching the side face (it keeps falling), and drops out of the table.
        s.world.blocks = [
            { col: 0, row: 31, alive: true },
            { col: 0, row: 0, alive: true },
        ];
        s.world.ball.x = 62;
        s.world.ball.y = 630;
        s.world.ball.vx = -50;
        s.world.ball.vy = 1000;
        const ev = s.frame(idle, 50);
        expect(ev.brokenBlocks).toEqual([0]);
        expect(ev.ballsLost).toBe(1);
        expect(s.lives).toBe(LIVES - 1);
    });

    it('empties every list at the start of the next frame, and reuses the same arrays', () => {
        const s = new GameSession();
        s.world.ball.x = 57;
        s.world.ball.y = 69;
        const first = s.frame(idle, 5);
        const blocks = first.brokenBlocks;
        expect(blocks).toHaveLength(2);
        const second = s.frame(idle, 5);
        expect(second).toBe(first); // the same result object ...
        expect(second.brokenBlocks).toBe(blocks); // ... and the same arrays are reused
        expect(second.hitBumpers).toBe(first.hitBumpers);
        expect(second.brokenBlocks).toEqual([]);
        expect(second.hitBumpers).toEqual([]);
        expect(second.ballsLost).toBe(0);
    });

    it('empties the bumper list at the start of the next frame as well', () => {
        const s = new GameSession();
        s.world.ball.x = 95;
        s.world.ball.y = 280;
        const first = s.frame(idle, 5);
        expect(first.hitBumpers).toEqual([0]);
        // The ball flies away from the bumper; the next frame hits nothing.
        const second = s.frame(idle, 5);
        expect(second.hitBumpers).toEqual([]);
    });

    it('returns empty lists during stageClear and ending', () => {
        const s = new GameSession();
        setUpLastBlock(s);
        s.frame(idle, 5);
        expect(s.phase).toBe('stageClear');
        const ev = s.frame(idle, 50);
        expect([ev.brokenBlocks, ev.hitBumpers, ev.ballsLost]).toEqual([[], [], 0]);
    });
});

describe('losing a ball', () => {
    it('costs one life, puts the ball back in the lane with no charge, and keeps the score and the flipper angle', () => {
        const s = new GameSession();
        s.score = 700;
        run(s, { ...idle, left: true }, 5); // raise the left flipper
        const raised = s.world.flippers[0].a;
        s.world.ball.x = 165;
        s.world.ball.y = 700;
        s.frame({ ...idle, left: true }, FRAME_MS);
        expect(s.lives).toBe(LIVES - 1);
        expect(s.phase).toBe('playing');
        expect(s.world.ball).toEqual({ x: LANE_BALL_X, y: LANE_FLOOR_Y - BALL_R, vx: 0, vy: 0 });
        expect(s.charge).toBe(0);
        expect(s.score).toBe(700);
        expect(s.world.flippers[0].a).toBe(raised);
    });

    it('goes to ending when the last ball is lost, and hands over the result after RESULT_DELAY (0.8 s)', () => {
        const s = new GameSession();
        s.lives = 1;
        s.score = 900;
        s.world.ball.x = 165;
        s.world.ball.y = 700;
        s.frame(idle, FRAME_MS);
        expect(s.lives).toBe(0);
        expect(s.phase).toBe('ending');
        expect(s.message).toBeNull();
        // 15 frames = 0.75 s: still waiting.
        expect(run(s, idle, 15).result).toBeNull();
        const ev = run(s, idle, 2);
        expect(ev.result).toEqual({ score: 900, stage: 1, cleared: false });
    });

    it('ignores input and freezes the table during ending', () => {
        const s = new GameSession();
        s.lives = 1;
        s.world.ball.y = 700;
        s.frame(idle, FRAME_MS);
        const before = JSON.stringify(s.world);
        run(s, { left: true, right: true, charge: true }, 5);
        expect(JSON.stringify(s.world)).toBe(before);
        expect(s.charge).toBe(0);
    });

    it('reports the stage the ball was lost on', () => {
        const s = new GameSession();
        startStage(s, 3);
        s.lives = 1;
        s.world.ball.y = 700;
        s.frame(idle, FRAME_MS);
        expect(run(s, idle, 17).result).toEqual({ score: 0, stage: 3, cleared: false });
    });
});

describe('scoring', () => {
    it('gives BUMPER_SCORE (10) for a bumper hit', () => {
        const s = new GameSession();
        s.world.ball.x = 95;
        s.world.ball.y = 280;
        s.frame(idle, 5);
        expect(s.score).toBe(BUMPER_SCORE);
    });

    it('gives SCORE_BLOCK (100) per block and bumps blocksVersion so the Scene redraws', () => {
        const s = new GameSession();
        // Just below the bottom of the row-2 block in column 0 (its bottom edge is y = 113), moving up.
        s.world.ball.x = 40;
        s.world.ball.y = 119.9;
        s.world.ball.vy = -300;
        const version = s.blocksVersion;
        s.frame(idle, 5);
        expect(s.score).toBe(SCORE_BLOCK);
        expect(s.blocksVersion).toBe(version + 1);
        expect(s.world.blocks.filter((b) => !b.alive)).toHaveLength(1);
    });

    it('gives 200 when one step breaks two blocks', () => {
        const s = new GameSession();
        s.world.ball.x = 57;
        s.world.ball.y = 69;
        s.frame(idle, 5);
        expect(s.score).toBe(2 * SCORE_BLOCK);
    });
});

describe('stage clear', () => {
    it('shows "STAGE 1 CLEAR" the moment the last block breaks, with no bonus', () => {
        const s = new GameSession();
        setUpLastBlock(s);
        s.frame(idle, 5);
        expect(s.phase).toBe('stageClear');
        expect(s.message).toBe('STAGE 1 CLEAR');
        expect(s.score).toBe(SCORE_BLOCK);
    });

    it('starts stage 2 after CLEAR_PAUSE (1 s): 16 blocks, the ball in the lane, the flippers down, lives and score kept', () => {
        const s = new GameSession();
        run(s, { ...idle, left: true }, 5);
        setUpLastBlock(s);
        s.frame(idle, 5);
        // 19 frames = 0.95 s: still showing the message.
        run(s, idle, 19);
        expect(s.phase).toBe('stageClear');
        run(s, idle, 2);
        expect(s.phase).toBe('playing');
        expect(s.stage).toBe(2);
        expect(s.message).toBeNull();
        expect(s.world.blocks).toHaveLength(16);
        expect(s.world.bumpers).toHaveLength(3);
        // Resting in the lane (it may settle by a hair on the floor after the first steps).
        expect(s.world.ball.x).toBe(LANE_BALL_X);
        expect(s.world.ball.y).toBeCloseTo(LANE_FLOOR_Y - BALL_R, 0);
        expect(s.ready).toBe(true);
        expect(s.world.flippers[0].a).toBeCloseTo((FLIPPER_REST_DEG * Math.PI) / 180, 12);
        expect(s.world.flippers[0].omega).toBe(0);
        expect(s.lives).toBe(LIVES);
        expect(s.score).toBe(SCORE_BLOCK);
    });

    it('freezes physics, input and the charge during the pause', () => {
        const s = new GameSession();
        setUpLastBlock(s);
        s.frame(idle, 5);
        const before = JSON.stringify(s.world);
        run(s, { left: true, right: true, charge: true }, 5);
        expect(JSON.stringify(s.world)).toBe(before);
        expect(s.charge).toBe(0);
    });

    it('bumps blocksVersion when the next stage starts', () => {
        const s = new GameSession();
        setUpLastBlock(s);
        s.frame(idle, 5);
        const version = s.blocksVersion;
        run(s, idle, 21);
        expect(s.blocksVersion).toBeGreaterThan(version);
    });

    it('shows ALL CLEAR on the last stage and hands over a cleared result after CLEAR_PAUSE', () => {
        const s = new GameSession();
        startStage(s, STAGE_COUNT);
        s.score = 12000;
        setUpLastBlock(s);
        s.frame(idle, 5);
        expect(s.message).toBe('ALL CLEAR');
        expect(run(s, idle, 19).result).toBeNull();
        expect(run(s, idle, 2).result).toEqual({ score: 12100, stage: STAGE_COUNT, cleared: true });
    });
});

describe('stall rescue', () => {
    // Frames of exactly 2^-10 s, so the stall timer adds up exactly: 5 s = 5120 frames.
    const TICK_MS = 1000 / 1024;
    /** A ball floating mid-table at no speed, as if it had stopped. */
    const park = (s: GameSession) => {
        s.world.ball.x = 165;
        s.world.ball.y = 300;
        s.world.ball.vx = 0;
        s.world.ball.vy = 0;
    };
    const parkedFrames = (s: GameSession, n: number, input: FrameInput = idle) => {
        for (let i = 0; i < n; i++) {
            park(s);
            s.frame(input, TICK_MS);
        }
    };
    const inLane = (s: GameSession) => s.world.ball.x === LANE_BALL_X && s.world.ball.y === LANE_FLOOR_Y - BALL_R;

    it('returns a ball that sat still for STALL_TIME (5 s) to the lane, costing nothing', () => {
        const s = new GameSession();
        s.score = 400;
        parkedFrames(s, 5119);
        expect(inLane(s)).toBe(false);
        parkedFrames(s, 1);
        expect(inLane(s)).toBe(true);
        expect(s.lives).toBe(LIVES);
        expect(s.score).toBe(400);
        expect(s.world.blocks).toHaveLength(24);
        expect(s.phase).toBe('playing');
    });

    it('starts counting again after a flipper is pressed', () => {
        const s = new GameSession();
        parkedFrames(s, 4000);
        parkedFrames(s, 1, { ...idle, left: true });
        parkedFrames(s, 5119);
        expect(inLane(s)).toBe(false);
        parkedFrames(s, 1);
        expect(inLane(s)).toBe(true);
    });

    it('starts counting again after the right flipper is pressed', () => {
        const s = new GameSession();
        parkedFrames(s, 4000);
        parkedFrames(s, 1, { ...idle, right: true });
        parkedFrames(s, 5119);
        expect(inLane(s)).toBe(false);
        parkedFrames(s, 1);
        expect(inLane(s)).toBe(true);
    });

    /** One zero-length frame with the ball parked at the given speed (no time passes, nothing steps, so the speed is what is judged). */
    const speedFrame = (s: GameSession, speed: number) => {
        park(s);
        s.world.ball.vy = speed;
        s.frame(idle, 0);
    };

    it('counts a ball at 14.9 px/s as stuck (below STALL_SPEED): the 5 s are not reset by it', () => {
        const s = new GameSession();
        parkedFrames(s, 4000);
        speedFrame(s, 14.9);
        parkedFrames(s, 1120); // 4000 + 1120 = 5120 frames = 5 s
        expect(inLane(s)).toBe(true);
    });

    it('starts counting again when the ball is at 15.1 px/s (STALL_SPEED or more)', () => {
        const s = new GameSession();
        parkedFrames(s, 4000);
        speedFrame(s, 15.1);
        parkedFrames(s, 1119);
        expect(inLane(s)).toBe(false); // the original 5 s mark has passed without a rescue
        parkedFrames(s, 4000); // 5119 frames since the reset
        expect(inLane(s)).toBe(false);
        parkedFrames(s, 1); // 5120 frames since the reset: now exactly STALL_TIME
        expect(inLane(s)).toBe(true);
    });

    it('starts counting again when the ball is exactly at STALL_SPEED (15 px/s)', () => {
        const s = new GameSession();
        parkedFrames(s, 4000);
        speedFrame(s, 15);
        parkedFrames(s, 1119);
        expect(inLane(s)).toBe(false);
    });

    it('does not count time spent in the lane: a ball stuck 4 s, then back in the lane, then stuck again needs a full 5 s more', () => {
        const s = new GameSession();
        parkedFrames(s, 4000);
        // The ball comes back to the lane for one frame (ready), then is stuck on the table again.
        s.world.ball.x = LANE_BALL_X;
        s.world.ball.y = LANE_FLOOR_Y - BALL_R;
        s.world.ball.vx = 0;
        s.world.ball.vy = 0;
        s.frame(idle, 0);
        expect(s.ready).toBe(true);
        parkedFrames(s, 5119);
        expect(inLane(s)).toBe(false);
        parkedFrames(s, 1);
        expect(inLane(s)).toBe(true);
    });
});

describe('a bot playing whole games (seeded)', () => {
    /** A simple bot: charge to about 0.9, launch; press the flipper on the ball's side when it is low. */
    function play(seed: number) {
        let rng = seed;
        const rand = () => ((rng = (rng * 1664525 + 1013904223) >>> 0) / 0x100000000);
        const s = new GameSession();
        let held = 0;
        const holdFor = 0.9;
        let aliveBlocks = s.world.blocks.length;
        let stage = s.stage;
        let result: FrameEvents['result'] = null;
        let frames = 0;
        let maxStall = 0;
        let still = 0;
        for (; frames < 60 * 60 * 60 && !result; frames++) {
            const ball = s.world.ball;
            let left = false;
            let right = false;
            let charge = false;
            if (s.ready) {
                held += 1 / 60;
                charge = held < holdFor;
                if (!charge && held > holdFor + 0.1) held = 0;
            } else {
                held = 0;
                if (ball.y > 500) {
                    if (ball.x < W / 2) left = rand() < 0.9;
                    else right = rand() < 0.9;
                }
            }
            result = s.frame({ left, right, charge }, 1000 / 60).result;
            // Invariants of every frame.
            if (s.world.ball.x < -1 || s.world.ball.x > W + 1 || s.world.ball.y < -1) {
                expect.fail(`ball escaped the table at frame ${frames}: ${JSON.stringify(s.world.ball)}`);
            }
            const alive = s.world.blocks.filter((b) => b.alive).length;
            if (s.stage === stage && alive > aliveBlocks) expect.fail('a block came back to life');
            if (s.stage !== stage) stage = s.stage;
            aliveBlocks = alive;
            const speed = Math.hypot(s.world.ball.vx, s.world.ball.vy);
            still = !s.ready && speed < 15 && !left && !right ? still + 1 / 60 : 0;
            maxStall = Math.max(maxStall, still);
        }
        return { s, result, maxStall };
    }

    it.each([1, 2, 3])('seed %i plays to a result with a consistent score and never stalls past STALL_TIME', (seed) => {
        const { s, result, maxStall } = play(seed);
        expect(result).not.toBeNull();
        expect(result!.score).toBe(s.score);
        expect(result!.score % BUMPER_SCORE).toBe(0);
        expect(result!.stage).toBeGreaterThanOrEqual(1);
        expect(result!.stage).toBeLessThanOrEqual(STAGE_COUNT);
        expect(maxStall).toBeLessThan(5.1);
        // Blocks broken so far account for the block part of the score.
        expect(s.score).toBeGreaterThanOrEqual(SCORE_BLOCK);
    });
});
