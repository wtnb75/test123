import {
    BOSS_BAR_HEIGHT, HUD_HEIGHT, MULTIKILL_BOSS_OFFSET_Y, MULTIKILL_EDGE_MARGIN, MULTIKILL_FONT_BASE, MULTIKILL_FONT_MAX,
    MULTIKILL_FONT_STEP, MULTIKILL_OFFSET_Y, MULTIKILL_POP_DURATION, MULTIKILL_POP_SCALE, MULTIKILL_RESULT_DURATION,
    MULTIKILL_RESULT_RISE, MULTIKILL_RESULT_SCALE, MULTIKILL_TIER_ORANGE, MULTIKILL_TIER_YELLOW, RELEASE_BONUS_STEP
} from './constants';
import { effectProgress } from './effects';
import { removeWhere } from './geometry';
import type { ScreenSize } from './screen';
import type { MultiKillUpdate, Settlement } from './world';

const WHITE = 0xffffff;
/** Same yellow as the boss, same orange as the shooter. */
const YELLOW = 0xffd54f;
const ORANGE = 0xffa726;

/** The live "k HIT ×multiplier" counter of one release, anchored on its latest kill. */
export interface KillCounter {
    id: number;
    kills: number;
    x: number;
    y: number;
    /** Seconds since the counter last changed (drives the pop). */
    age: number;
}

/** A settled release's "+points", rising from where its counter was. */
export interface KillResult {
    /** The release it scores, matching its counter's id. */
    id: number;
    kills: number;
    score: number;
    /** The release's latest kill. */
    x: number;
    y: number;
    lastIsBoss: boolean;
    age: number;
}

const isResultOver = (r: KillResult): boolean => r.age >= MULTIKILL_RESULT_DURATION;

/**
 * Multi-kill counters and results in play. Drawing only: the rules never read this. It plays on
 * whatever the phase, including while ending.
 */
export class MultiKillEffects {
    readonly counters: KillCounter[] = [];
    readonly results: KillResult[] = [];

    /**
     * Ages everything by dt, then applies this frame's kill-count changes, then this frame's
     * settlements, so a release that scores its last kill and settles in the same frame shows only
     * its result.
     */
    update(dt: number, updates: readonly MultiKillUpdate[], settlements: readonly Settlement[]): void {
        for (const c of this.counters) c.age += dt;
        for (const r of this.results) r.age += dt;
        removeWhere(this.results, isResultOver);
        for (const u of updates) this.applyUpdate(u);
        for (const s of settlements) this.applySettlement(s);
    }

    private applyUpdate(u: MultiKillUpdate): void {
        if (u.kills < 2) return;
        const c = this.counters.find((k) => k.id === u.id);
        if (c) {
            c.kills = u.kills;
            c.x = u.x;
            c.y = u.y;
            c.age = 0;
        } else {
            this.counters.push({ id: u.id, kills: u.kills, x: u.x, y: u.y, age: 0 });
        }
    }

    private applySettlement(s: Settlement): void {
        removeWhere(this.counters, (c) => c.id === s.id);
        if (s.kills < 2) return;
        this.results.push({ id: s.id, kills: s.kills, score: s.score, x: s.x, y: s.y, lastIsBoss: s.lastIsBoss, age: 0 });
    }

    clear(): void {
        this.counters.length = 0;
        this.results.length = 0;
    }
}

/** The bonus multiplier for k kills in one release, written with one decimal: "×2.0". */
export function multiplierLabel(kills: number): string {
    return `×${(1 + (kills - 1) * RELEASE_BONUS_STEP).toFixed(1)}`;
}

export function counterLabel(kills: number): string {
    return `${kills} HIT ${multiplierLabel(kills)}`;
}

export function resultLabel(score: number): string {
    return `+${score}`;
}

/** Counter text size in px for k kills. */
export function counterFontSize(kills: number): number {
    return Math.min(MULTIKILL_FONT_BASE + MULTIKILL_FONT_STEP * (kills - 2), MULTIKILL_FONT_MAX);
}

/** Result ("+points") text size in px for k kills: the counter's size scaled up. */
export function resultFontSize(kills: number): number {
    return counterFontSize(kills) * MULTIKILL_RESULT_SCALE;
}

export function multiKillColor(kills: number): number {
    if (kills >= MULTIKILL_TIER_ORANGE) return ORANGE;
    if (kills >= MULTIKILL_TIER_YELLOW) return YELLOW;
    return WHITE;
}

/** Counter scale `age` seconds after its latest change: pops from MULTIKILL_POP_SCALE back to 1. */
export function popScale(age: number): number {
    const p = effectProgress(age, MULTIKILL_POP_DURATION);
    return p < 0 ? 1 : MULTIKILL_POP_SCALE + (1 - MULTIKILL_POP_SCALE) * p;
}

/**
 * Whether a settling release's result may start from its counter's last drawn spot. `shownKills` is
 * the count the counter showed when last drawn (undefined if it never was).
 */
export function reusesCounterSpot(shownKills: number | undefined, resultKills: number): boolean {
    // A kill in the settling frame moved the counter after it was drawn; its old spot is stale then.
    return shownKills === resultKills;
}

/** Highest a multi-kill text may reach: under the HUD band, and under the boss HP bar while a boss is out. */
export function topLimit(bossPresent: boolean): number {
    return bossPresent ? HUD_HEIGHT + BOSS_BAR_HEIGHT : HUD_HEIGHT;
}

/** Keeps v within [min, max]; an empty range (text wider than the screen) centres it on `centre`. */
function clampOrCentre(v: number, min: number, max: number, centre: number): number {
    if (min > max) return centre;
    return Math.min(Math.max(v, min), max);
}

/** Horizontal centre for text `w` wide, kept off the left and right edges. */
function clampX(x: number, w: number, screen: ScreenSize): number {
    const half = MULTIKILL_EDGE_MARGIN + w / 2;
    return clampOrCentre(x, half, screen.width - half, screen.width / 2);
}

/**
 * Where the counter (text w × h at scale 1, stroke included) is centred for a kill at (x, y), kept
 * below `top` (see topLimit); written into `out`. Each axis whose range is empty is centred on its own.
 */
export function counterCenter(
    x: number, y: number, w: number, h: number, screen: ScreenSize, top: number, out = { x: 0, y: 0 }
): { x: number; y: number } {
    out.x = clampX(x, w, screen);
    out.y = clampOrCentre(y - MULTIKILL_OFFSET_Y, top + h / 2, screen.height - h / 2, screen.height / 2);
    return out;
}

/**
 * Where a result (text w × h at scale 1) starts: at its counter's centre, lifted clear of the boss's
 * own popup when the last kill was the boss, and low enough that its rise stays below the HUD.
 */
export function resultStart(
    counter: { x: number; y: number }, lastIsBoss: boolean, w: number, h: number, screen: ScreenSize, top: number
): { x: number; y: number } {
    const y = counter.y - (lastIsBoss ? MULTIKILL_BOSS_OFFSET_Y : 0);
    return {
        x: clampX(counter.x, w, screen),
        y: clampOrCentre(y, top + MULTIKILL_RESULT_RISE + h / 2, screen.height - h / 2, screen.height / 2)
    };
}

/** Progress of a result t seconds after it settled; -1 when not showing. */
export function resultProgress(t: number): number {
    return effectProgress(t, MULTIKILL_RESULT_DURATION);
}

export function resultRise(progress: number): number {
    return MULTIKILL_RESULT_RISE * progress;
}
