import { PARAMS } from '../params';
import { applyStrike } from './pop';

/**
 * What a strike did: hit a mole, hit a cat, hit nothing (including a tap on a telegraphing hole), or hit a clock.
 * A clock hit (docs/spec/items.md) changes neither the score nor the streak; it adds time, handled by the Scene.
 */
export type StrikeOutcome = 'mole' | 'cat' | 'clock' | 'miss';

/** The score multiplier for a mole hit, from the streak just before that hit. */
export const streakMultiplier = (
    streak: number,
    step: number = PARAMS.streakStep,
    max: number = PARAMS.streakMaxMultiplier,
): number => Math.min(1 + Math.floor(streak / step), max);

/** The streak after a strike: a mole hit adds one; a cat hit or a miss starts over. Nothing else changes it. */
export const nextStreak = (streak: number, outcome: StrikeOutcome): number => {
    if (outcome === 'clock') return streak;
    return outcome === 'mole' ? streak + 1 : 0;
};

/**
 * The multiplier to announce once the streak has become `streakAfter`: the new multiplier when this streak
 * value raised it (compared with the value just before), otherwise null.
 */
export const announcedMultiplier = (
    streakAfter: number,
    step: number = PARAMS.streakStep,
    max: number = PARAMS.streakMaxMultiplier,
): number | null => {
    if (streakAfter <= 0) return null;
    const multiplier = streakMultiplier(streakAfter, step, max);
    return multiplier > streakMultiplier(streakAfter - 1, step, max) ? multiplier : null;
};

/** The state after one strike: the new score and streak, the actual score change and the multiplier to announce. */
export interface StrikeResult {
    score: number;
    streak: number;
    applied: number;
    announce: number | null;
}

/**
 * One strike, in the order the rules give: the multiplier comes from the streak just before the hit, then the
 * streak is updated; only a mole hit can announce a new multiplier. A miss changes no score.
 */
export const resolveStrike = (score: number, streak: number, outcome: StrikeOutcome): StrikeResult => {
    const after = nextStreak(streak, outcome);
    // only a mole or a cat scores; a miss and a clock hit (which adds time in the Scene) leave the score alone
    if (outcome !== 'mole' && outcome !== 'cat') return { score, streak: after, applied: 0, announce: null };
    const result = applyStrike(score, outcome, streakMultiplier(streak));
    return {
        score: result.score,
        streak: after,
        applied: result.applied,
        announce: outcome === 'mole' ? announcedMultiplier(after) : null,
    };
};
