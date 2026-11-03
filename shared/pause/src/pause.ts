/** DOM key codes of Space, X and Enter: the keys that resume by default. */
export const DEFAULT_RESUME_KEY_CODES: readonly number[] = [32, 88, 13];

/** Longest frame, in seconds, the game is advanced by (a long frame is cut to this). */
export const DEFAULT_MAX_DT = 0.05;

export interface PauseOptions {
    /** Cap on the seconds a frame advances the game by. */
    maxDt?: number;
    /** DOM key codes whose fresh press resumes (and, while running, is a normal key press). */
    resumeKeyCodes?: readonly number[];
}

/**
 * Auto-pause of a game scene. A trigger (the page going hidden or the window losing focus) pauses from
 * the next frame on; only a fresh press of a resume key or a click/tap made while paused resumes.
 * `frame` gives the seconds to advance the game by each frame: 0 while paused, otherwise the capped delta.
 */
export class PauseState {
    private paused = false;
    private triggered = false;
    private resumePressed = false;
    private started = false;
    private readonly maxDt: number;
    private readonly resumeKeyCodes: readonly number[];

    constructor(options: PauseOptions = {}) {
        this.maxDt = options.maxDt ?? DEFAULT_MAX_DT;
        this.resumeKeyCodes = options.resumeKeyCodes ?? DEFAULT_RESUME_KEY_CODES;
    }

    get isPaused(): boolean {
        return this.paused;
    }

    /** True for the one frame in which the pause began, so the caller drops the input in flight. */
    get pausedThisFrame(): boolean {
        return this.started;
    }

    /** The page went hidden or the window lost focus. Hidden and blur together are one pause. */
    trigger(): void {
        this.triggered = true;
    }

    /**
     * A keydown of a resume key; returns true when the game should treat it as a normal press. While paused
     * (or after a trigger not yet applied) the pause takes the key, and only a fresh press resumes.
     * Auto-repeat never counts: Phaser forgets held keys on blur, so a key held through a pause comes back
     * as repeats.
     */
    keyDown(keyCode: number, repeat: boolean): boolean {
        if (!this.takesInput()) return !repeat;
        if (this.paused && !repeat && this.resumeKeyCodes.includes(keyCode)) this.resumePressed = true;
        return false;
    }

    /** A click or touch start. Returns true when the pause takes it (it must not act or drag). */
    pointerDown(): boolean {
        if (!this.takesInput()) return false;
        if (this.paused) this.resumePressed = true;
        return true;
    }

    /** Seconds to advance the game this frame, given the frame's delta in milliseconds. */
    frame(deltaMs: number): number {
        this.started = false;
        if (this.triggered) {
            // Input from before the trigger or from its frame never resumes.
            this.triggered = false;
            this.resumePressed = false;
            this.started = !this.paused;
            this.paused = true;
            return 0;
        }
        if (this.paused) {
            if (!this.resumePressed) return 0;
            this.resumePressed = false;
            this.paused = false;
        }
        return Math.min(deltaMs / 1000, this.maxDt);
    }

    private takesInput(): boolean {
        return this.paused || this.triggered;
    }
}
