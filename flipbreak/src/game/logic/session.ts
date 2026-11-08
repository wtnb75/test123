// The Game Scene's rules as one pure object: phases, plunger, lives, score, stall rescue (docs/spec.md "Game").
import {
    CHARGE_TIME,
    BUMPER_SCORE,
    CLEAR_PAUSE,
    FRAME_DT_MAX,
    LIVES,
    PHYSICS_DT,
    RESULT_DELAY,
    SCORE_BLOCK,
    STAGE_COUNT,
    STALL_SPEED,
    STALL_TIME,
} from '../params';
import { ballSpeed, isReady, launchSpeed, makeBall, makeFlippers, stepWorld, type StepSink, type World } from './physics';
import { loadBlocks, loadBumpers, stageCleared } from './stages';

export type Phase = 'playing' | 'stageClear' | 'ending';

export interface FrameInput {
    left: boolean;
    right: boolean;
    /** The plunger is being charged this frame (already requires the ball to be ready). */
    charge: boolean;
}

/** What the Result Scene needs. */
export interface ResultData {
    score: number;
    /** The stage the play reached (the one it ended on; STAGE_COUNT after an all-clear). */
    stage: number;
    cleared: boolean;
}

/**
 * What happened in one `frame()` call. The same object (and arrays) is reused by every call, emptied at the
 * start of each: read it right away and don't keep it for the next frame.
 */
export interface FrameEvents {
    /** The ball was launched from the lane this frame. */
    launched: boolean;
    /** Set when the Scene should move on to Result. */
    result: ResultData | null;
    /** Indices (in `world.blocks`) of the blocks broken this frame, in the order they broke. */
    brokenBlocks: number[];
    /** Indices (in `world.bumpers`) of the bumpers hit this frame, each once, in ascending order. */
    hitBumpers: number[];
    /** Balls lost this frame (0 or 1). */
    ballsLost: number;
}

export class GameSession {
    stage = 1;
    lives = LIVES;
    score = 0;
    phase: Phase = 'playing';
    /** Plunger charge, 0..1. */
    charge = 0;
    /** Bumped whenever the set of blocks drawn changes (a block broke, a stage started). */
    blocksVersion = 0;
    world!: World;

    private charging = false;
    private phaseTimer = 0;
    private acc = 0;
    private stall = 0;
    private readonly events: FrameEvents = { launched: false, result: null, brokenBlocks: [], hitBumpers: [], ballsLost: 0 };
    private readonly sink: StepSink = {
        block: (i) => void this.events.brokenBlocks.push(i),
        bumper: (i) => {
            if (!this.events.hitBumpers.includes(i)) this.events.hitBumpers.push(i);
        },
    };

    constructor() {
        this.startStage(1);
    }

    /** The ball sits in the lane. */
    get ready(): boolean {
        return isReady(this.world.ball);
    }

    /** The centre message ("STAGE n CLEAR" / "ALL CLEAR"), or null when there is none. */
    get message(): string | null {
        if (this.phase !== 'stageClear') return null;
        return this.stage === STAGE_COUNT ? 'ALL CLEAR' : `STAGE ${this.stage} CLEAR`;
    }

    /** Drop any charge (the screen is covered, for instance). */
    cancelCharge(): void {
        this.charge = 0;
        this.charging = false;
    }

    frame(input: FrameInput, deltaMs: number): FrameEvents {
        const ev = this.events;
        ev.launched = false;
        ev.result = null;
        ev.brokenBlocks.length = 0;
        ev.hitBumpers.length = 0;
        ev.ballsLost = 0;
        const dt = Math.min(deltaMs / 1000, FRAME_DT_MAX);
        if (this.phase !== 'playing') {
            this.waitPhase(dt, ev);
            return ev;
        }
        ev.launched = this.updatePlunger(input.charge, dt);
        this.runPhysics(input, dt);
        if (ev.hitBumpers.length > 1) ev.hitBumpers.sort((a, b) => a - b);
        if (this.phase === 'playing') this.updateStall(input, dt);
        return ev;
    }

    private waitPhase(dt: number, ev: FrameEvents): void {
        this.phaseTimer -= dt;
        if (this.phaseTimer > 0) return;
        if (this.phase === 'ending') {
            ev.result = { score: this.score, stage: this.stage, cleared: false };
        } else if (this.stage === STAGE_COUNT) {
            ev.result = { score: this.score, stage: this.stage, cleared: true };
        } else {
            this.startStage(this.stage + 1);
        }
    }

    /** Charge while held; launch when everything is released. Returns whether the ball was launched. */
    private updatePlunger(held: boolean, dt: number): boolean {
        if (held) {
            this.charge = Math.min(1, this.charge + dt / CHARGE_TIME);
            this.charging = true;
            return false;
        }
        const launch = this.charging && this.ready;
        if (launch) {
            this.world.ball.vx = 0;
            this.world.ball.vy = -launchSpeed(this.charge);
        }
        this.cancelCharge();
        return launch;
    }

    private runPhysics(input: FrameInput, dt: number): void {
        this.acc += dt;
        while (this.acc >= PHYSICS_DT) {
            this.acc -= PHYSICS_DT;
            const ev = stepWorld(this.world, input.left, input.right, PHYSICS_DT, this.sink);
            this.score += ev.blocks * SCORE_BLOCK + ev.bumpers * BUMPER_SCORE;
            if (ev.blocks > 0) this.blocksVersion += 1;
            if (ev.drained) {
                this.loseBall();
                return;
            }
            if (stageCleared(this.world.blocks)) {
                this.enterPhase('stageClear', CLEAR_PAUSE);
                return;
            }
        }
    }

    private loseBall(): void {
        this.lives -= 1;
        this.events.ballsLost += 1;
        this.acc = 0;
        this.stall = 0;
        this.cancelCharge();
        if (this.lives <= 0) {
            this.enterPhase('ending', RESULT_DELAY);
            return;
        }
        this.world.ball = makeBall();
    }

    private enterPhase(phase: Phase, seconds: number): void {
        this.phase = phase;
        this.phaseTimer = seconds;
        this.acc = 0;
        this.cancelCharge();
    }

    /** Rescue a ball that sat still on the table: back to the lane, nothing lost. */
    private updateStall(input: FrameInput, dt: number): void {
        const ball = this.world.ball;
        const still = !this.ready && !input.left && !input.right && ballSpeed(ball) < STALL_SPEED;
        this.stall = still ? this.stall + dt : 0;
        if (this.stall < STALL_TIME) return;
        this.stall = 0;
        this.world.ball = makeBall();
        this.cancelCharge();
    }

    private startStage(stage: number): void {
        this.stage = stage;
        this.phase = 'playing';
        this.phaseTimer = 0;
        this.acc = 0;
        this.stall = 0;
        this.cancelCharge();
        this.blocksVersion += 1;
        this.world = {
            ball: makeBall(),
            flippers: makeFlippers(),
            bumpers: loadBumpers(stage),
            blocks: loadBlocks(stage),
        };
    }
}
