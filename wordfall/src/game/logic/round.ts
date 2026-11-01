import { START_TIME_SEC } from '../params';
import { fallSpeed, bonusFor, scoreFor } from './scoring';
import { initialTargets } from './targets';
import { addLetter, removeAt, resolveCompletions } from './tray';
import type { Rng, Word } from './words';

export type Phase = 'playing' | 'ending';

/** What a pick did: the tray was full, nothing happened, or the letter went in (with any completions). */
export type PickResult =
    | { kind: 'full' }
    | { kind: 'ignored' }
    /** `rows[i]` is the row `completed[i]` was in. */
    | { kind: 'picked'; completed: Word[]; rows: number[] };

/**
 * One play's rules and state, without Phaser. Inputs (pick / discard) are applied as they arrive; `tick`
 * advances the clock afterwards, so a tap that reaches the frame where time runs out still counts
 * (docs/spec.md "同じフレームの順序").
 */
export class Round {
    phase: Phase = 'playing';
    tray: string[] = [];
    targets: Word[];
    timeLeft = START_TIME_SEC;
    score = 0;
    completedCount = 0;
    /** Seconds of play so far (drives the fall speed). */
    elapsed = 0;
    /** Every target that appeared, in order (repeats included). */
    readonly appeared: Word[];
    /** English text of every completion, in order. */
    readonly completedWords: string[] = [];

    constructor(private readonly rng: Rng) {
        this.targets = initialTargets(rng);
        this.appeared = [...this.targets];
    }

    /** True once time has run out (the play is in its `ending` phase). */
    get isOver(): boolean {
        return this.phase === 'ending';
    }

    get fallSpeed(): number {
        return fallSpeed(this.elapsed);
    }

    /** TIME shown in the HUD: remaining seconds, rounded up. */
    get timeShown(): number {
        return Math.ceil(this.timeLeft);
    }

    /** Takes a letter into the tray and completes whatever it now spells. */
    pick(ch: string): PickResult {
        if (this.phase !== 'playing') return { kind: 'ignored' };
        const next = addLetter(this.tray, ch);
        if (next === null) return { kind: 'full' };
        const res = resolveCompletions(next, this.targets, this.rng);
        this.tray = res.tray;
        this.targets = res.targets;
        for (const w of res.completed) {
            this.score += scoreFor(w.en.length);
            this.timeLeft += bonusFor(w.en.length);
            this.completedCount += 1;
            this.completedWords.push(w.en);
        }
        this.appeared.push(...res.drawn);
        return { kind: 'picked', completed: res.completed, rows: res.rows };
    }

    /** Throws away the tray letter at `index`; false when nothing was there (or the play is over). */
    discardAt(index: number): boolean {
        if (this.phase !== 'playing' || index < 0 || index >= this.tray.length) return false;
        this.tray = removeAt(this.tray, index);
        return true;
    }

    discardLast(): boolean {
        return this.discardAt(this.tray.length - 1);
    }

    /** Advances the clock by `dt` seconds; time at or below zero ends the play. */
    tick(dt: number): void {
        if (this.phase !== 'playing') return;
        this.elapsed += dt;
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
            this.timeLeft = 0;
            this.phase = 'ending';
        }
    }
}
