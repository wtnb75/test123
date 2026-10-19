import { PART_ANSWERS } from './parts';
import type { PartId, PartTransform } from './types';

/** Correct placement of every part (outline included), relative to PLACEMENT_CENTER. */
export type TopicAnswers = Record<PartId, PartTransform>;

/** Largest allowed distance (px) of any part's edge from the outline centre (outline radius 70, stroke 4). */
export const TOPIC_MAX_RADIUS_PX = 67;

/** Registry key of the previous topic's index (session memory only). */
export const LAST_TOPIC_KEY = 'lastTopicIndex';

const t = (x: number, y: number, rotation: number): PartTransform => ({ x, y, rotation });

const topic = (parts: Omit<TopicAnswers, 'outline'>): TopicAnswers => ({ outline: PART_ANSWERS.outline, ...parts });

/** The topics (docs/spec.md "お題の表"). Topic 0 is the original face, i.e. PART_ANSWERS. */
export const TOPICS: readonly TopicAnswers[] = [
    PART_ANSWERS,
    // surprised: high brows, mouth low
    topic({
        eyebrowL: t(-30, -45, -0.2), eyebrowR: t(30, -45, 0.2), eyeL: t(-30, -20, 0), eyeR: t(30, -20, 0),
        nose: t(0, 10, 0), mouth: t(0, 46, 0),
    }),
    // angry: brows pulled down towards the nose
    topic({
        eyebrowL: t(-30, -33, 0.4), eyebrowR: t(30, -33, -0.4), eyeL: t(-30, -4, 0), eyeR: t(30, -4, 0),
        nose: t(0, 14, 0), mouth: t(0, 40, 0),
    }),
    // small: parts close to the centre
    topic({
        eyebrowL: t(-27, -32, -0.1), eyebrowR: t(27, -32, 0.1), eyeL: t(-27, -10, 0), eyeR: t(27, -10, 0),
        nose: t(0, 8, 0), mouth: t(0, 32, 0),
    }),
    // slanted: asymmetric, tilted nose and mouth
    topic({
        eyebrowL: t(-38, -34, -0.3), eyebrowR: t(30, -42, 0.2), eyeL: t(-34, -10, 0.15), eyeR: t(28, -18, -0.1),
        nose: t(6, 14, 0.2), mouth: t(12, 42, 0.18),
    }),
];

/**
 * Picks a topic index uniformly among all topics except `previous` (any topic when `previous` is null or out of
 * range). `rng` returns a value in [0, 1) and is injected so the pick is reproducible.
 */
export function pickTopic(topicCount: number, previous: number | null, rng: () => number): number {
    const candidates: number[] = [];
    for (let i = 0; i < topicCount; i++) {
        if (i !== previous) candidates.push(i);
    }
    if (candidates.length === 0) return 0; // a single topic that is also the previous one
    return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
}
