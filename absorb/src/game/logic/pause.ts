import { MAX_DT } from './constants';
import { RETRY_KEY_CODES } from './retry';

/**
 * Auto-pause of the game scene. The page going hidden or losing focus pauses from the next frame on;
 * only a fresh press of a release key or a click/tap made while paused resumes. `frame` gives the
 * seconds to advance the game by each frame: 0 while paused, otherwise the capped delta.
 */
export class PauseState {
    private paused = false;
    private triggered = false;
    private resumePressed = false;
    private started = false;

    get isPaused(): boolean {
        return this.paused;
    }

    /** True for the one frame in which the pause began, so the caller drops the input in flight. */
    get pausedThisFrame(): boolean {
        return this.started;
    }

    /** The page went hidden or the window lost focus. */
    trigger(): void {
        this.triggered = true;
    }

    /**
     * A keydown of a release key; returns true when it should release. While paused (or after a trigger
     * not yet applied) the pause takes the key, and only a fresh press resumes. Auto-repeat never releases:
     * Phaser forgets held keys on blur, so a key held through a pause comes back as repeats.
     */
    releaseKeyDown(keyCode: number, repeat: boolean): boolean {
        if (!this.takesInput()) return !repeat;
        if (this.paused && !repeat && RETRY_KEY_CODES.includes(keyCode)) this.resumePressed = true;
        return false;
    }

    /** A click or touch start. Returns true when the pause takes it (it must not release or drag). */
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
        return Math.min(deltaMs / 1000, MAX_DT);
    }

    private takesInput(): boolean {
        return this.paused || this.triggered;
    }
}
