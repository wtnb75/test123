import { PARAMS } from '../params';
import { holeCenter, type Pt } from './board';
import { LANDSCAPE, type Layout } from './layout';
import type { Kind } from './spawn';

/** One mole, cat, clock or golden mole in a hole (it takes a slot of the pop cap). `spawnedAt` is in game milliseconds. */
export interface Pop {
    hole: number;
    kind: Kind;
    spawnedAt: number;
    /** A cat that also gets a direction arrow; decided once at spawn. Absent means not a decoy. */
    decoy?: boolean;
}

export type PopState = 'telegraph' | 'up' | 'gone';

/** How long a pop stays up (hittable): a golden mole's is short (docs/spec/golden-mole.md), everyone else's is `popLifetimeMs`. */
const upLifetimeMs = (kind: Kind): number => (kind === 'golden' ? PARAMS.goldenLifetimeMs : PARAMS.popLifetimeMs);

export const popState = (pop: Pop, now: number): PopState => {
    const upAt = pop.spawnedAt + PARAMS.telegraphMs;
    if (now < upAt) return 'telegraph';
    return now < upAt + upLifetimeMs(pop.kind) ? 'up' : 'gone';
};

/**
 * Whether a pop is a candidate for a direction arrow: moles, golden moles and decoy cats, while telegraphing or up.
 * (The arrow is only drawn while the hole is off screen; that part is `arrowFor`.) Ordinary cats and clocks never.
 */
export const showsArrow = (pop: Pop, now: number): boolean =>
    popState(pop, now) !== 'gone' && (pop.kind === 'mole' || pop.kind === 'golden' || pop.decoy === true);

/** How a pop's arrow looks: only a golden mole's is gold with a white outline; moles and decoys share the yellow one. */
export interface ArrowStyle {
    readonly color: number;
    /** Outline width in px; 0 means none. */
    readonly outlinePx: number;
}

export const YELLOW_ARROW_COLOR = 0xffeb3b;

const GOLDEN_ARROW: ArrowStyle = Object.freeze({ color: PARAMS.goldenArrowColor, outlinePx: PARAMS.goldenArrowOutlinePx });
const YELLOW_ARROW: ArrowStyle = Object.freeze({ color: YELLOW_ARROW_COLOR, outlinePx: 0 });

/** Shared constants (no allocation per call): the arrows are restyled every frame. */
export const arrowStyle = (pop: Pop): ArrowStyle => (pop.kind === 'golden' ? GOLDEN_ARROW : YELLOW_ARROW);

/**
 * The pop a strike at `at` (board coordinates) hits: among pops that are up and whose hole center is
 * within `hitRadius`, the nearest; on equal distance the lower hole index. null means a miss.
 */
export const judgeStrike = (at: Pt, pops: readonly Pop[], now: number, layout: Layout = LANDSCAPE): Pop | null => {
    let best: Pop | null = null;
    let bestDist = Infinity;
    for (const pop of pops) {
        if (popState(pop, now) !== 'up') continue;
        const c = holeCenter(pop.hole, layout);
        const dist = Math.hypot(c.x - at.x, c.y - at.y);
        if (dist > PARAMS.hitRadius) continue;
        if (dist < bestDist || (dist === bestDist && best !== null && pop.hole < best.hole)) {
            best = pop;
            bestDist = dist;
        }
    }
    return best;
};

/** The pops whose hit changes the score (a clock adds time, a miss hits nothing). */
export type ScoringKind = 'mole' | 'cat' | 'golden';

/** The score change for one hit, before the floor at 0. A `never` check makes a new scoring kind a compile error here. */
const strikeChange = (kind: ScoringKind, multiplier: number): number => {
    switch (kind) {
        case 'mole':
            return PARAMS.scoreMole * multiplier;
        case 'golden':
            return PARAMS.scoreGolden;
        case 'cat':
            return PARAMS.scoreFriend;
        default: {
            const unreachable: never = kind;
            return unreachable;
        }
    }
};

/**
 * Score after hitting a `kind`; the total never drops below 0. `applied` is the actual change.
 * A mole is worth `scoreMole` times the streak `multiplier`; a golden mole's `scoreGolden` and a cat's penalty
 * are never multiplied.
 */
export const applyStrike = (
    score: number,
    kind: ScoringKind,
    multiplier = 1,
): { score: number; applied: number } => {
    const next = Math.max(0, score + strikeChange(kind, multiplier));
    return { score: next, applied: next - score };
};

/** Floating text for a score change: "+10", "-20", or "0" when nothing changed. */
export const changeLabel = (applied: number): string => (applied > 0 ? `+${applied}` : `${applied}`);
