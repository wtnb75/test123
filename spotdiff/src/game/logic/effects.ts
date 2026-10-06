import { PARAMS } from '../params';
import type { Phase } from './run';

// Pure time functions of the presentation effects (see docs/spec.md "演出・UI").
// `ms` is the time since the triggering frame (t = 0); every effect is gone at exactly its duration.

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);

/** Radius factor of a hit ring: grows from `hitPopFrom` to 1 with ease-out. */
export const hitPopScale = (ms: number): number => {
    const p = clamp01(ms / PARAMS.hitPopMs);
    return PARAMS.hitPopFrom + (1 - PARAMS.hitPopFrom) * (1 - (1 - p) ** 3);
};

export const missMarkAlpha = (ms: number): number => 1 - clamp01(ms / PARAMS.missMarkMs);

export const missPopupAlpha = (ms: number): number => 1 - clamp01(ms / PARAMS.missPopupMs);

export const missPopupRise = (ms: number): number => PARAMS.missPopupRise * clamp01(ms / PARAMS.missPopupMs);

/** The warning starts at `lowTimeSec` seconds (inclusive) shown on the HUD. */
export const isLowTime = (displaySeconds: number): boolean => displaySeconds <= PARAMS.lowTimeSec;

/** HUD scale while the low-time warning pulses: 1 .. 1 + lowTimePulse, 1 at t = 0. */
export const lowTimeScale = (ms: number): number =>
    1 + (PARAMS.lowTimePulse * (1 - Math.cos((2 * Math.PI * ms) / PARAMS.lowTimePulseMs))) / 2;

/** Pop of the CLEAR!/ALL CLEAR!/TIME UP message: from -> peak at 60% of the time, then back to 1. */
export const msgPopScale = (ms: number): number => {
    const d = PARAMS.msgPopMs;
    if (ms >= d) return 1;
    const peakAt = 0.6 * d;
    if (ms <= peakAt) return PARAMS.msgPopFrom + (PARAMS.msgPopPeak - PARAMS.msgPopFrom) * (Math.max(ms, 0) / peakAt);
    return PARAMS.msgPopPeak - (PARAMS.msgPopPeak - 1) * ((ms - peakAt) / (d - peakAt));
};

/** Opacity of the pulsing "TAP ..." prompts: 1 at t = 0, the minimum at half a period. */
export const promptAlpha = (ms: number): number =>
    PARAMS.promptPulseMin + ((1 - PARAMS.promptPulseMin) * (1 + Math.cos((2 * Math.PI * ms) / PARAMS.promptPulseMs))) / 2;

/** Fade-in factor of the Result texts. */
export const fadeAlpha = (ms: number): number => clamp01(ms / PARAMS.resultFadeMs);

/** Keeps the centre of the "-5" popup at least `popupEdgeMargin` from the left and right canvas edges. */
export const clampPopupX = (x: number, canvasWidth: number): number =>
    Math.min(Math.max(x, PARAMS.popupEdgeMargin), canvasWidth - PARAMS.popupEdgeMargin);

/** The first-run hint: stage 1 of set 1 while playing, until the first difference is found. */
export const showFirstHint = (run: { setNo: number; stageNo: number; phase: Phase; found: { size: number } }): boolean =>
    run.setNo === 1 && run.stageNo === 1 && run.phase === 'play' && run.found.size === 0;

export interface MissEffect {
    panel: number;
    /** Panel-local position of the tap (kept in panel coordinates so it follows layout changes). */
    x: number;
    y: number;
    ms: number;
    /** Created this frame: it skips the first tick so that its first drawn frame is t = 0. */
    fresh: boolean;
}

/** Active miss marks and "-5" popups: at most `missMarkMax`, the oldest is replaced; expired ones are dropped. */
export class MissEffects {
    readonly items: MissEffect[] = [];

    add(panel: number, x: number, y: number): void {
        if (this.items.length >= PARAMS.missMarkMax) this.items.shift();
        this.items.push({ panel, x, y, ms: 0, fresh: true });
    }

    tick(dtMs: number): void {
        const life = Math.max(PARAMS.missMarkMs, PARAMS.missPopupMs);
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            if (item.fresh) item.fresh = false;
            else item.ms += dtMs;
        }
        for (let i = this.items.length - 1; i >= 0; i--) if (this.items[i].ms >= life) this.items.splice(i, 1);
    }

    clear(): void {
        this.items.length = 0;
    }
}
