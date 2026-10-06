import { PARAMS } from '../params';
import type { Stage } from './generate';
import { judgeClick } from './judge';

export type Phase = 'play' | 'clear' | 'won' | 'over' | 'paused';
export type ClickOutcome = 'ignored' | 'hit' | 'miss';
/** What `tick` asks the Scene to do: draw the next stage, or leave for the Result Scene. */
export type TickEvent = 'none' | 'stage' | 'result';

export interface RunOptions {
    date: number;
    setNo: number;
    makeStage: (stage: number) => Stage;
    /** The page is already hidden when the run starts: begin in `paused`. */
    startHidden?: boolean;
}

export interface RunSummary {
    date: number;
    setNo: number;
    won: boolean;
    stage: number;
    score: number;
}

type ActivePhase = Exclude<Phase, 'paused'>;

/**
 * Progress of one set (5 stages): stage timer, discovery, score, and the auto-pause state machine.
 * All time comes in through `tick(dtMs)`, so it is deterministic and Phaser-free.
 */
export class Run {
    readonly date: number;
    readonly setNo: number;
    stageNo = 1;
    stage: Stage;
    found = new Set<number>();
    timeLeft: number;
    score = 0;
    phase: Phase = 'play';
    /** Index of the difference found by the latest hit, or -1 (used to start its pop-in effect). */
    lastHit = -1;

    private readonly makeStage: (stage: number) => Stage;
    private resumeTo: ActivePhase = 'play';
    private waitMs = 0;
    private visible = true;
    private lockMs = 0;
    private finished = false;

    constructor(opts: RunOptions) {
        this.date = opts.date;
        this.setNo = opts.setNo;
        this.makeStage = opts.makeStage;
        this.stage = this.makeStage(1);
        this.timeLeft = PARAMS.timeLimits[0];
        if (opts.startHidden) this.hide();
    }

    /** Whole seconds shown in the HUD. */
    get displaySeconds(): number {
        return Math.ceil(this.timeLeft);
    }

    get won(): boolean {
        return this.phase === 'paused' ? this.resumeTo === 'won' : this.phase === 'won';
    }

    summary(): RunSummary {
        return { date: this.date, setNo: this.setNo, won: this.won, stage: this.stageNo, score: this.score };
    }

    /** A pointer press at panel-local coordinates. */
    click(x: number, y: number): ClickOutcome {
        if (this.phase !== 'play') return 'ignored';
        const hit = judgeClick(this.stage.diffs, this.found, x, y);
        if (hit < 0) {
            this.timeLeft = Math.max(0, this.timeLeft - PARAMS.missPenalty);
            if (this.timeLeft <= 0) this.timeUp();
            return 'miss';
        }
        this.found.add(hit);
        this.lastHit = hit;
        if (this.found.size >= this.stage.diffs.length) this.stageCleared();
        return 'hit';
    }

    /** Advances time by `dtMs`; `paused` never consumes any. */
    tick(dtMs: number): TickEvent {
        if (this.finished) return 'none';
        if (this.phase === 'paused') {
            if (this.visible) this.lockMs = Math.max(0, this.lockMs - dtMs);
            return 'none';
        }
        if (this.phase === 'play') {
            this.timeLeft -= dtMs / 1000;
            if (this.timeLeft <= 0) this.timeUp();
            return 'none';
        }
        this.waitMs -= dtMs;
        if (this.waitMs > 0) return 'none';
        if (this.phase === 'clear') {
            this.nextStage();
            return 'stage';
        }
        this.finished = true;
        return 'result';
    }

    /** The page became hidden. Returns true when this entered `paused` (the Scene stops its effects). */
    hide(): boolean {
        this.visible = false;
        if (this.phase === 'paused') return false;
        this.resumeTo = this.phase;
        this.phase = 'paused';
        return true;
    }

    /** The page became visible again; the resume tap is ignored for `resumeInputLockMs`. */
    show(): void {
        this.visible = true;
        this.lockMs = PARAMS.resumeInputLockMs;
    }

    /** A tap while paused. Returns true when it resumed the run (the tap is then consumed). */
    resume(): boolean {
        if (this.phase !== 'paused' || !this.visible || this.lockMs > 0) return false;
        this.phase = this.resumeTo;
        return true;
    }

    private stageCleared(): void {
        this.score += Math.ceil(this.timeLeft);
        this.phase = this.stageNo >= PARAMS.stageCount ? 'won' : 'clear';
        this.waitMs = PARAMS.stageClearPauseMs;
    }

    private timeUp(): void {
        this.timeLeft = 0;
        this.phase = 'over';
        this.waitMs = PARAMS.resultRevealMs;
    }

    private nextStage(): void {
        this.stageNo += 1;
        this.stage = this.makeStage(this.stageNo);
        this.found = new Set();
        this.lastHit = -1;
        this.timeLeft = PARAMS.timeLimits[this.stageNo - 1];
        this.phase = 'play';
    }
}
