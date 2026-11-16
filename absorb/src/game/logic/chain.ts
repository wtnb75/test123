import {
    CHAIN_BAR_H, CHAIN_BAR_TOP, CHAIN_BOSS_OFFSET_Y, CHAIN_MAX_LEVEL, CHAIN_STEP, CHAIN_TEXT_TOP, CHAIN_TIER_ORANGE,
    CHAIN_TIER_YELLOW, CHAIN_WINDOW
} from './constants';

/** Slack for the seconds a float clock has accumulated, so exactly CHAIN_WINDOW still counts as inside. */
const WINDOW_EPSILON = 1e-9;

const WHITE = 0xffffff;
/** Same colors as the multi-kill counter (docs/spec/effects.md). */
const YELLOW = 0xffd54f;
const ORANGE = 0xffa726;

/** The level a release gets at its first kill: one above the running chain while it is inside the window, else 1. */
export function nextChainLevel(level: number, secondsSinceKill: number): number {
    return level >= 1 && secondsSinceKill <= CHAIN_WINDOW + WINDOW_EPSILON ? level + 1 : 1;
}

/** What the chain adds to a release's multiplier (0 at level 1, capped at CHAIN_MAX_LEVEL steps). */
export function chainBonus(level: number): number {
    return Math.min(Math.max(level - 1, 0), CHAIN_MAX_LEVEL) * CHAIN_STEP;
}

/** The chain HUD shows from level 2, until CHAIN_WINDOW seconds have passed since the latest kill. */
export function chainVisible(level: number, secondsSinceKill: number): boolean {
    return level >= 2 && secondsSinceKill < CHAIN_WINDOW;
}

export function chainLabel(level: number): string {
    return `CHAIN ×${level}`;
}

export function chainColor(level: number): number {
    if (level >= CHAIN_TIER_ORANGE) return ORANGE;
    if (level >= CHAIN_TIER_YELLOW) return YELLOW;
    return WHITE;
}

/** How much of the window is left, 0..1 (the bar's filled share). */
export function chainBarFraction(secondsSinceKill: number): number {
    return Math.min(Math.max((CHAIN_WINDOW - secondsSinceKill) / CHAIN_WINDOW, 0), 1);
}

interface ChainLayout {
    textTop: number;
    barTop: number;
    barHeight: number;
}

const LAYOUT: Readonly<ChainLayout> = { textTop: CHAIN_TEXT_TOP, barTop: CHAIN_BAR_TOP, barHeight: CHAIN_BAR_H };
const LAYOUT_BOSS: Readonly<ChainLayout> = {
    textTop: CHAIN_TEXT_TOP + CHAIN_BOSS_OFFSET_Y, barTop: CHAIN_BAR_TOP + CHAIN_BOSS_OFFSET_Y, barHeight: CHAIN_BAR_H
};

/** Where the chain HUD's text and bar sit; the whole block moves down while a boss (and its "BOSS" label) is out. Shared objects: read only. */
export function chainLayout(bossOut: boolean): Readonly<ChainLayout> {
    return bossOut ? LAYOUT_BOSS : LAYOUT;
}
