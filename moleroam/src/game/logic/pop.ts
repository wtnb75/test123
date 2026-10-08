import { PARAMS } from '../params';
import { holeCenter, type Pt } from './board';
import { LANDSCAPE, type Layout } from './layout';
import type { Kind } from './spawn';

/** One mole or cat in a hole. `spawnedAt` is in game milliseconds. */
export interface Pop {
    hole: number;
    kind: Kind;
    spawnedAt: number;
    /** A cat that also gets a direction arrow; decided once at spawn. Absent means not a decoy. */
    decoy?: boolean;
}

export type PopState = 'telegraph' | 'up' | 'gone';

export const popState = (pop: Pop, now: number): PopState => {
    const upAt = pop.spawnedAt + PARAMS.telegraphMs;
    if (now < upAt) return 'telegraph';
    return now < upAt + PARAMS.popLifetimeMs ? 'up' : 'gone';
};

/**
 * Whether a pop is a candidate for a direction arrow: moles and decoy cats, while telegraphing or up.
 * (The arrow is only drawn while the hole is off screen; that part is `arrowFor`.) Ordinary cats never.
 */
export const showsArrow = (pop: Pop, now: number): boolean =>
    popState(pop, now) !== 'gone' && (pop.kind === 'mole' || pop.decoy === true);

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

/** Score after hitting a `kind`; the total never drops below 0. `applied` is the actual change. */
export const applyStrike = (score: number, kind: Kind): { score: number; applied: number } => {
    const next = Math.max(0, score + (kind === 'mole' ? PARAMS.scoreMole : PARAMS.scoreFriend));
    return { score: next, applied: next - score };
};

/** Floating text for a score change: "+10", "-20", or "0" when nothing changed. */
export const changeLabel = (applied: number): string => (applied > 0 ? `+${applied}` : `${applied}`);
