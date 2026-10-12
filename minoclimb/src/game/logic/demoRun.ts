// The clock of the demo behind the Title (docs/spec/title-demo.md "デモの流れ"): when the curtain closes,
// when the run is rebuilt and when the curtain opens again. Pure logic: time is passed in by the Scene.
import { P } from '../params';

export type DemoRunPhase = 'waiting' | 'fading-out' | 'fading-in';

/** What the Scene has to do: `fade-out` drop running effects; `fade-in` (screen is black) rebuild the run. */
export type DemoRunEvent = { kind: 'fade-out' } | { kind: 'fade-in' };

export class DemoRunClock {
    phase: DemoRunPhase = 'waiting';
    /** How many times the run has been rebuilt. */
    rebuilds = 0;

    private now = 0;
    private phaseStart = 0;
    private closeAt: number;
    private endSeen = false;
    private started = false;

    constructor(
        private readonly runMs: number = P.DEMO_RUN_MS,
        private readonly fadeMs: number = P.DEMO_FADE_MS,
        private readonly holdMs: number = P.DEMO_END_HOLD_MS,
    ) {
        this.closeAt = runMs;
    }

    /** The curtain's clock in ms (frozen once a start was accepted). */
    get clock(): number {
        return this.now;
    }

    /** True once a start was accepted: the Scene is on its way to the game. */
    get leaving(): boolean {
        return this.started;
    }

    /** A start request. True only for the first one. */
    requestStart(): boolean {
        if (this.started) return false;
        this.started = true;
        return true;
    }

    /**
     * Advances the clock. `roundEnded` is whether the demo's round is over (cleared, crushed or topped out);
     * the curtain then closes DEMO_END_HOLD_MS after it was first seen, if that is sooner than the run length.
     * At most one event per call; none once a start was accepted.
     */
    update(deltaMs: number, roundEnded: boolean): DemoRunEvent | null {
        if (this.started) return null;
        this.now += Math.max(0, deltaMs);

        if (this.phase === 'waiting') {
            if (roundEnded && !this.endSeen) {
                this.endSeen = true;
                this.closeAt = Math.min(this.closeAt, this.now + this.holdMs);
            }
            if (this.now >= this.closeAt) {
                this.phase = 'fading-out';
                this.phaseStart = this.now;
                return { kind: 'fade-out' };
            }
        } else if (this.phase === 'fading-out') {
            if (this.now - this.phaseStart >= this.fadeMs) {
                this.phase = 'fading-in';
                this.phaseStart = this.now;
                this.rebuilds++;
                this.endSeen = false;
                return { kind: 'fade-in' };
            }
        } else if (this.now - this.phaseStart >= this.fadeMs) {
            this.phase = 'waiting';
            this.closeAt = this.now + this.runMs;
        }
        return null;
    }

    /** Opacity of the demo: 1 except while the curtain closes (1 → 0) or opens (0 → 1). */
    opacity(): number {
        if (this.phase === 'waiting') return 1;
        const t = Math.min(1, Math.max(0, (this.now - this.phaseStart) / this.fadeMs));
        return this.phase === 'fading-out' ? 1 - t : t;
    }
}
