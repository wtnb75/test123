import {
    STAGE_COUNT,
    PATTERN_COUNT,
    PATTERN_SEED_STRIDE,
    FORWARD_RATIO_START,
    FORWARD_RATIO_END,
    FORWARD_MIN_MS,
    FORWARD_MAX_MS,
    OFFSET_MIN_PX,
    OFFSET_MAX_PX
} from './constants';
import type { ScreenBounds } from './circle';
import type { Point } from './waypoints';

// Where circles appear (docs/spec.md, "円の位置の決め方"): part of them near the route ahead of the character,
// the rest uniformly over the screen. Shared by the Game scene and the measurement simulator.

/** Share of circles aimed at the route ahead; grows linearly from stage 1 to STAGE_COUNT. */
export function forwardRatio(stage: number): number {
    const s = Math.min(Math.max(stage, 1), STAGE_COUNT);
    return FORWARD_RATIO_START + ((FORWARD_RATIO_END - FORWARD_RATIO_START) * (s - 1)) / (STAGE_COUNT - 1);
}

/** Picks a pattern number (0..PATTERN_COUNT - 1) from a random() value in [0, 1). */
export function pickPatternIndex(random: () => number): number {
    return Math.min(Math.floor(random() * PATTERN_COUNT), PATTERN_COUNT - 1);
}

/** Seed of the circle random stream of one pattern of a stage. */
export function patternSeed(stage: number, patternIndex: number): number {
    return stage * PATTERN_SEED_STRIDE + patternIndex;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Center of the next circle. Always draws six values from rng (ux, uy, ug, ut, ua, ud), even when unused.
 * aheadPointAt(ms) returns the route point the character reaches `ms` milliseconds from now (the route end
 * when that is past the end).
 */
export function placeCircleCenter(
    rng: () => number,
    stage: number,
    aheadPointAt: (ms: number) => Point,
    bounds: ScreenBounds
): Point {
    const ux = rng();
    const uy = rng();
    const ug = rng();
    const ut = rng();
    const ua = rng();
    const ud = rng();

    if (ug >= forwardRatio(stage)) {
        return { x: ux * bounds.width, y: uy * bounds.height };
    }
    const base = aheadPointAt(FORWARD_MIN_MS + (FORWARD_MAX_MS - FORWARD_MIN_MS) * ut);
    const angle = 2 * Math.PI * ua;
    const distance = OFFSET_MIN_PX + (OFFSET_MAX_PX - OFFSET_MIN_PX) * ud;
    return {
        x: clamp(base.x + distance * Math.cos(angle), 0, bounds.width),
        y: clamp(base.y + distance * Math.sin(angle), 0, bounds.height)
    };
}
