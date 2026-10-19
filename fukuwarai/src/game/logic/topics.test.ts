import { describe, expect, it } from 'vitest';
import { PART_IDS, PART_SHAPES, PART_ANSWERS } from './parts';
import { TOPICS, TOPIC_MAX_RADIUS_PX, pickTopic, type TopicAnswers } from './topics';
import type { DraggablePartId, PartTransform } from './types';

const mulberry32 = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

type Pt = { x: number; y: number };

/** Local (unrotated) boundary points of a part: ellipse outline, or the three edges of the apex-up triangle. */
function localBoundary(id: DraggablePartId, samples: number): Pt[] {
    const { kind, size } = PART_SHAPES[id];
    const { w, h } = size;
    const pts: Pt[] = [];
    if (kind === 'triangle') {
        const v: Pt[] = [{ x: 0, y: -h / 2 }, { x: -w / 2, y: h / 2 }, { x: w / 2, y: h / 2 }];
        for (let i = 0; i < 3; i++) {
            const p = v[i];
            const q = v[(i + 1) % 3];
            for (let k = 0; k < samples; k++) {
                const s = k / samples;
                pts.push({ x: p.x + (q.x - p.x) * s, y: p.y + (q.y - p.y) * s });
            }
        }
    } else {
        for (let i = 0; i < samples * 3; i++) {
            const a = (2 * Math.PI * i) / (samples * 3);
            pts.push({ x: (w / 2) * Math.cos(a), y: (h / 2) * Math.sin(a) });
        }
    }
    return pts;
}

const SAMPLES = 100; // per triangle edge; 300 points on each ellipse

/** Boundary of a part placed at `t` (rotation, then translation, relative to the outline centre). */
function placedBoundary(id: DraggablePartId, t: PartTransform): Pt[] {
    const c = Math.cos(t.rotation);
    const s = Math.sin(t.rotation);
    return localBoundary(id, SAMPLES).map((p) => ({ x: t.x + p.x * c - p.y * s, y: t.y + p.x * s + p.y * c }));
}

/** Whether `p` lies inside the part placed at `t`. */
function inside(id: DraggablePartId, t: PartTransform, p: Pt): boolean {
    const { kind, size } = PART_SHAPES[id];
    const c = Math.cos(-t.rotation);
    const s = Math.sin(-t.rotation);
    const dx = p.x - t.x;
    const dy = p.y - t.y;
    const u = dx * c - dy * s;
    const v = dx * s + dy * c;
    if (kind !== 'triangle') return (u / (size.w / 2)) ** 2 + (v / (size.h / 2)) ** 2 <= 1;
    const a = { x: 0, y: -size.h / 2 };
    const b = { x: -size.w / 2, y: size.h / 2 };
    const d = { x: size.w / 2, y: size.h / 2 };
    const sign = (p1: Pt, p2: Pt, p3: Pt) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const q = { x: u, y: v };
    const d1 = sign(q, a, b);
    const d2 = sign(q, b, d);
    const d3 = sign(q, d, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

const maxRadius = (topic: TopicAnswers): number =>
    Math.max(...PART_IDS.flatMap((id) => placedBoundary(id, topic[id]).map((p) => Math.hypot(p.x, p.y))));

const MEASURED_MAX_RADIUS = [65.9, 66.7, 65.3, 57.8, 65.8]; // spec "お題の表"

describe('TOPICS', () => {
    it('has five topics, and topic 0 is the original face (PART_ANSWERS)', () => {
        expect(TOPICS).toHaveLength(5);
        expect(TOPICS[0]).toBe(PART_ANSWERS);
        expect(PART_ANSWERS.eyebrowL).toEqual({ x: -35, y: -35, rotation: -0.12 });
        expect(PART_ANSWERS.mouth).toEqual({ x: 0, y: 40, rotation: 0 });
    });

    it('has exactly the values of the spec table for every part of every topic', () => {
        // [eyebrowL, eyebrowR, eyeL, eyeR, nose, mouth], each [x, y, rotation]
        const table: number[][][] = [
            [[-35, -35, -0.12], [35, -35, 0.12], [-32, -12, 0], [32, -12, 0], [0, 12, 0], [0, 40, 0]],
            [[-30, -45, -0.2], [30, -45, 0.2], [-30, -20, 0], [30, -20, 0], [0, 10, 0], [0, 46, 0]],
            [[-30, -33, 0.4], [30, -33, -0.4], [-30, -4, 0], [30, -4, 0], [0, 14, 0], [0, 40, 0]],
            [[-27, -32, -0.1], [27, -32, 0.1], [-27, -10, 0], [27, -10, 0], [0, 8, 0], [0, 32, 0]],
            [[-38, -34, -0.3], [30, -42, 0.2], [-34, -10, 0.15], [28, -18, -0.1], [6, 14, 0.2], [12, 42, 0.18]],
        ];
        table.forEach((row, i) => {
            PART_IDS.forEach((id, k) => {
                expect(TOPICS[i][id]).toEqual({ x: row[k][0], y: row[k][1], rotation: row[k][2] });
            });
        });
    });

    it('shares the outline of every topic (centre, no rotation)', () => {
        for (const topic of TOPICS) expect(topic.outline).toEqual({ x: 0, y: 0, rotation: 0 });
    });

    it.each([0, 1, 2, 3, 4])('keeps every part of topic %i inside the outline circle (edge at most TOPIC_MAX_RADIUS_PX from the centre)', (i) => {
        const r = maxRadius(TOPICS[i]);
        expect(r).toBeLessThanOrEqual(TOPIC_MAX_RADIUS_PX);
        expect(r).toBeCloseTo(MEASURED_MAX_RADIUS[i], 1);
    });

    it.each([0, 1, 2, 3, 4])('has no two overlapping parts in topic %i', (i) => {
        const topic = TOPICS[i];
        for (let a = 0; a < PART_IDS.length; a++) {
            for (let b = a + 1; b < PART_IDS.length; b++) {
                const A = PART_IDS[a];
                const B = PART_IDS[b];
                const hit =
                    placedBoundary(A, topic[A]).some((p) => inside(B, topic[B], p)) ||
                    placedBoundary(B, topic[B]).some((p) => inside(A, topic[A], p));
                if (hit) expect.fail(`${A} overlaps ${B} in topic ${i}`);
            }
        }
    });

    it('tells inside from outside for the triangle nose (centroid in, beyond the apex and the base out)', () => {
        const nose = { x: 0, y: 12, rotation: 0 };
        expect(inside('nose', nose, { x: 0, y: 14 })).toBe(true); // near the centroid of a 22 x 26 apex-up triangle
        expect(inside('nose', nose, { x: 0, y: 12 - 14 })).toBe(false); // above the apex (apex at y = 12 - 13)
        expect(inside('nose', nose, { x: 0, y: 12 + 14 })).toBe(false); // below the base
        expect(inside('nose', nose, { x: 10, y: 12 - 10 })).toBe(false); // beside the upper part, outside the slanted edge
        const onNose: TopicAnswers = { ...TOPICS[0], eyeL: { x: 0, y: 14, rotation: 0 } };
        expect(placedBoundary('eyeL', onNose.eyeL).some((p) => inside('nose', onNose.nose, p))).toBe(true);
    });

    it('detects an overlap and an overflow (the checks above are not vacuous)', () => {
        const overlapping: TopicAnswers = { ...TOPICS[0], eyeL: { x: -35, y: -35, rotation: 0 } }; // on top of eyebrowL
        expect(
            placedBoundary('eyeL', overlapping.eyeL).some((p) => inside('eyebrowL', overlapping.eyebrowL, p)),
        ).toBe(true);
        const outside: TopicAnswers = { ...TOPICS[0], mouth: { x: 0, y: 60, rotation: 0 } };
        expect(maxRadius(outside)).toBeGreaterThan(TOPIC_MAX_RADIUS_PX);
    });

    it('makes every pair of topics differ in at least one part by 5 px or 0.1 rad', () => {
        for (let a = 0; a < TOPICS.length; a++) {
            for (let b = a + 1; b < TOPICS.length; b++) {
                const differs = PART_IDS.some((id) => {
                    const p = TOPICS[a][id];
                    const q = TOPICS[b][id];
                    return Math.hypot(p.x - q.x, p.y - q.y) >= 5 || Math.abs(p.rotation - q.rotation) >= 0.1;
                });
                if (!differs) expect.fail(`topics ${a} and ${b} are too similar`);
            }
        }
    });
});

describe('pickTopic', () => {
    it.each([
        [2, 0, 0],
        [2, 0.25, 1],
        [2, 0.5, 3],
        [2, 0.99, 4],
        [0, 0, 1],
        [0, 0.99, 4],
        [null, 0.5, 2],
        [null, 0, 0],
        [null, 0.999999, 4],
    ] as const)('with previous %s and rng %s picks topic %i (n = 5)', (previous, r, expected) => {
        expect(pickTopic(5, previous, () => r)).toBe(expected);
    });

    it('takes the last candidate for an rng just below 1, whatever the previous topic', () => {
        expect(pickTopic(5, 4, () => 0.999999)).toBe(3);
        expect(pickTopic(5, 1, () => 0.999999)).toBe(4);
    });

    it('never returns the previous topic, for every previous topic and a fine sweep of rng in [0, 1)', () => {
        for (let previous = 0; previous < 5; previous++) {
            const seen = new Set<number>();
            for (let k = 0; k < 1000; k++) {
                const picked = pickTopic(5, previous, () => k / 1000);
                if (picked === previous || picked < 0 || picked > 4) expect.fail(`previous ${previous} picked ${picked}`);
                seen.add(picked);
            }
            expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4].filter((i) => i !== previous));
        }
    });

    it('treats a previous topic out of range as no previous topic (every topic is a candidate)', () => {
        expect(pickTopic(5, 7, () => 0.9)).toBe(4);
        expect(pickTopic(5, -1, () => 0)).toBe(0);
    });

    it('stays inside the candidates even if the injected rng returns 1 (the last candidate)', () => {
        expect(pickTopic(5, 2, () => 1)).toBe(4);
        expect(pickTopic(5, null, () => 1)).toBe(4);
    });

    it('returns the only topic when there is just one', () => {
        expect(pickTopic(1, null, () => 0.5)).toBe(0);
        expect(pickTopic(1, 0, () => 0.5)).toBe(0);
    });

    it('is deterministic for the same random numbers', () => {
        const a = mulberry32(3);
        const b = mulberry32(3);
        expect([1, 2, 3].map((p) => pickTopic(5, p, a))).toEqual([1, 2, 3].map((p) => pickTopic(5, p, b)));
    });

    it('never repeats the previous topic over 1000 picks in a row, and uses all five topics', () => {
        const rng = mulberry32(2024);
        let previous: number | null = null;
        const counts = [0, 0, 0, 0, 0];
        for (let i = 0; i < 1000; i++) {
            const picked: number = pickTopic(TOPICS.length, previous, rng);
            if (picked === previous) expect.fail(`repeated topic ${picked} at pick ${i}`);
            counts[picked]++;
            previous = picked;
        }
        for (const c of counts) expect(c).toBeGreaterThan(100); // roughly 200 each
    });
});
