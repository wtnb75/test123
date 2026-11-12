import { describe, it, expect } from 'vitest';
import { forwardRatio, patternSeed, pickPatternIndex, placeCircleCenter } from './placement';
import {
    GAME_HEIGHT,
    GAME_WIDTH,
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
import { createPrng } from './prng';

const BOUNDS = { width: GAME_WIDTH, height: GAME_HEIGHT };

// Hand-worked setup from the spec: straight route (0,300) -> (800,300) (length 800), 130 px/s,
// so the character reaches a point `ms` milliseconds ahead at x = t * 800 + 0.13 * ms (at most the route end).
function aheadOnLine(t: number): (ms: number) => { x: number; y: number } {
    return (ms) => ({ x: Math.min(800, t * 800 + 0.13 * ms), y: 300 });
}

// Returns the given values in order and counts the calls.
function sequence(values: number[]): { rng: () => number; calls: () => number } {
    let n = 0;
    return { rng: () => values[n++], calls: () => n };
}

describe('placement parameters', () => {
    it('keeps the spec values', () => {
        expect(PATTERN_COUNT).toBe(3);
        expect(PATTERN_SEED_STRIDE).toBe(100);
        expect(FORWARD_RATIO_START).toBe(0.6);
        expect(FORWARD_RATIO_END).toBe(0.8);
        expect(FORWARD_MIN_MS).toBe(1000);
        expect(FORWARD_MAX_MS).toBe(3000);
        expect(OFFSET_MIN_PX).toBe(40);
        expect(OFFSET_MAX_PX).toBe(240);
    });
});

describe('forwardRatio', () => {
    it('is 0.60 at stage 1 and 0.80 at stage 10', () => {
        expect(forwardRatio(1)).toBeCloseTo(0.6, 12);
        expect(forwardRatio(10)).toBeCloseTo(0.8, 12);
    });

    it('is 0.6 + 0.2 * 4 / 9 at stage 5', () => {
        expect(forwardRatio(5)).toBeCloseTo(0.68889, 5);
    });

    it('treats stages below 1 as stage 1 and above 10 as stage 10', () => {
        expect(forwardRatio(0)).toBe(forwardRatio(1));
        expect(forwardRatio(-3)).toBe(forwardRatio(1));
        expect(forwardRatio(11)).toBe(forwardRatio(10));
    });

    it('grows strictly from stage 1 to 10', () => {
        for (let stage = 2; stage <= STAGE_COUNT; stage++) {
            expect(forwardRatio(stage)).toBeGreaterThan(forwardRatio(stage - 1));
        }
    });
});

describe('pickPatternIndex', () => {
    it.each([
        { value: 0, expected: 0 },
        { value: 0.33, expected: 0 },
        { value: 1 / 3, expected: 1 },
        { value: 0.34, expected: 1 },
        { value: 0.67, expected: 2 },
        { value: 0.999, expected: 2 },
        { value: 1, expected: 2 }
    ])('maps the random value $value to pattern $expected', ({ value, expected }) => {
        expect(pickPatternIndex(() => value)).toBe(expected);
    });
});

describe('patternSeed', () => {
    it('is stage * 100 + pattern number', () => {
        expect(patternSeed(1, 0)).toBe(100);
        expect(patternSeed(1, 2)).toBe(102);
        expect(patternSeed(10, 1)).toBe(1001);
    });

    it('gives the patterns of one stage different random streams, and the same pattern the same stream', () => {
        const first = (seed: number) => createPrng(seed)();
        expect(first(patternSeed(1, 0))).not.toBe(first(patternSeed(1, 1)));
        expect(first(patternSeed(1, 1))).not.toBe(first(patternSeed(1, 2)));
        expect(first(patternSeed(1, 0))).not.toBe(first(patternSeed(1, 2)));
        expect(first(patternSeed(4, 1))).toBe(first(patternSeed(4, 1)));
    });
});

describe('placeCircleCenter (hand-worked, stage 1: forward ratio 0.6)', () => {
    // Draw order: ux, uy, ug, ut, ua, ud.
    it('puts a forward circle 140 px from the point 2000 ms ahead (260 px ahead of the start)', () => {
        const { rng } = sequence([0.9, 0.9, 0.1, 0.5, 0, 0.5]);
        const center = placeCircleCenter(rng, 1, aheadOnLine(0), BOUNDS);
        expect(center.x).toBeCloseTo(400, 9);
        expect(center.y).toBeCloseTo(300, 9);
    });

    it('asks for the point 1000 ms ahead at ut = 0, 2000 ms at ut = 0.5 and 3000 ms at ut = 1', () => {
        const asked: number[] = [];
        const ahead = (ms: number) => {
            asked.push(ms);
            return { x: 100, y: 100 };
        };
        for (const ut of [0, 0.5, 1]) {
            placeCircleCenter(sequence([0, 0, 0, ut, 0, 0]).rng, 1, ahead, BOUNDS);
        }
        expect(asked).toEqual([1000, 2000, 3000]);
    });

    it('places a uniform circle at (ux * width, uy * height) when ug is above the ratio', () => {
        const { rng } = sequence([0.25, 0.5, 0.9, 0.5, 0, 0.5]);
        expect(placeCircleCenter(rng, 1, aheadOnLine(0), BOUNDS)).toEqual({ x: 240, y: 300 });
    });

    it('treats ug exactly equal to the ratio as uniform and just below it as forward', () => {
        const uniform = placeCircleCenter(sequence([0.25, 0.5, 0.6, 0.5, 0, 0.5]).rng, 1, aheadOnLine(0), BOUNDS);
        expect(uniform).toEqual({ x: 240, y: 300 });
        const forward = placeCircleCenter(sequence([0.25, 0.5, 0.5999, 0.5, 0, 0.5]).rng, 1, aheadOnLine(0), BOUNDS);
        expect(forward.x).toBeCloseTo(400, 9);
    });

    it('uses the ratio of the stage: ug = 0.7 is uniform at stage 1 and forward at stage 10', () => {
        const draws = [0.25, 0.5, 0.7, 0.5, 0, 0.5];
        expect(placeCircleCenter(sequence(draws).rng, 1, aheadOnLine(0), BOUNDS)).toEqual({ x: 240, y: 300 });
        expect(placeCircleCenter(sequence(draws).rng, 10, aheadOnLine(0), BOUNDS).x).toBeCloseTo(400, 9);
    });

    it('keeps the offset between 40 and 240 px from the ahead point', () => {
        const near = placeCircleCenter(sequence([0, 0, 0.1, 0.5, 0, 0]).rng, 1, aheadOnLine(0), BOUNDS);
        expect(near.x).toBeCloseTo(260 + 40, 9);
        const far = placeCircleCenter(sequence([0, 0, 0.1, 0.5, 0, 1]).rng, 1, aheadOnLine(0), BOUNDS);
        expect(far.x).toBeCloseTo(260 + 240, 9);
    });

    it('points the offset down the screen for a quarter turn and left for a half turn', () => {
        const down = placeCircleCenter(sequence([0, 0, 0.1, 0.5, 0.25, 0.5]).rng, 1, aheadOnLine(0), BOUNDS);
        expect(down.x).toBeCloseTo(260, 9);
        expect(down.y).toBeCloseTo(440, 9);
        const left = placeCircleCenter(sequence([0, 0, 0.1, 0.5, 0.5, 0.5]).rng, 1, aheadOnLine(0), BOUNDS);
        expect(left.x).toBeCloseTo(120, 9);
        expect(left.y).toBeCloseTo(300, 6);
    });

    it('clamps a forward center that falls off the left edge to x = 0', () => {
        // Ahead point (130,300), offset 190 px at a half turn: x = -60.
        const { rng } = sequence([0, 0, 0.1, 0, 0.5, 0.75]);
        const center = placeCircleCenter(rng, 1, aheadOnLine(0), BOUNDS);
        expect(center.x).toBe(0);
        expect(center.y).toBeCloseTo(300, 6);
    });

    it('clamps to every screen edge', () => {
        const at = (x: number, y: number, ua: number) =>
            placeCircleCenter(sequence([0, 0, 0.1, 0.5, ua, 1]).rng, 1, () => ({ x, y }), BOUNDS);
        expect(at(900, 300, 0).x).toBe(GAME_WIDTH);
        expect(at(400, 590, 0.25).y).toBe(GAME_HEIGHT);
        expect(at(400, 10, 0.75).y).toBe(0);
        expect(at(400, 300, 0.5).x).toBeCloseTo(160, 9);
    });

    it('draws exactly six values for a forward circle and for a uniform one, and the next circle uses draws 7-12', () => {
        const forwardFirst = sequence([0.9, 0.9, 0.1, 0.5, 0, 0.5, 0.25, 0.5, 0.9, 0.5, 0, 0.5]);
        placeCircleCenter(forwardFirst.rng, 1, aheadOnLine(0), BOUNDS);
        expect(forwardFirst.calls()).toBe(6);
        expect(placeCircleCenter(forwardFirst.rng, 1, aheadOnLine(0), BOUNDS)).toEqual({ x: 240, y: 300 });
        expect(forwardFirst.calls()).toBe(12);

        const uniformFirst = sequence([0.25, 0.5, 0.9, 0.5, 0, 0.5, 0.9, 0.9, 0.1, 0.5, 0, 0.5]);
        placeCircleCenter(uniformFirst.rng, 1, aheadOnLine(0), BOUNDS);
        expect(uniformFirst.calls()).toBe(6);
        const second = placeCircleCenter(uniformFirst.rng, 1, aheadOnLine(0), BOUNDS);
        expect(second.x).toBeCloseTo(400, 9);
        expect(uniformFirst.calls()).toBe(12);
    });

    it('measures the ahead point from the character position it is given (same draws, later t, later center)', () => {
        const draws = [0, 0, 0.1, 0.5, 0, 0.5];
        const start = placeCircleCenter(sequence(draws).rng, 1, aheadOnLine(0), BOUNDS);
        const later = placeCircleCenter(sequence(draws).rng, 1, aheadOnLine(0.25), BOUNDS);
        expect(later.x - start.x).toBeCloseTo(200, 9);
    });
});

describe('placeCircleCenter over seeded patterns', () => {
    const route = aheadOnLine(0.1);

    it('keeps every center inside the screen for every stage and pattern', () => {
        let checked = 0;
        for (let stage = 1; stage <= STAGE_COUNT; stage++) {
            for (let pattern = 0; pattern < PATTERN_COUNT; pattern++) {
                const rng = createPrng(patternSeed(stage, pattern));
                for (let i = 0; i < 300; i++) {
                    const c = placeCircleCenter(rng, stage, route, BOUNDS);
                    if (c.x < 0 || c.x > GAME_WIDTH || c.y < 0 || c.y > GAME_HEIGHT) {
                        expect.fail(`stage ${stage} pattern ${pattern} circle ${i} at (${c.x}, ${c.y})`);
                    }
                    checked++;
                }
            }
        }
        expect(checked).toBe(STAGE_COUNT * PATTERN_COUNT * 300);
    });

    it('aims about 80% of 1000 circles ahead at stage 10, and both kinds occur', () => {
        const rng = createPrng(patternSeed(10, 0));
        // The ahead point is asked for only by forward circles.
        let forward = 0;
        const countingRoute = (ms: number) => {
            forward++;
            return route(ms);
        };
        for (let i = 0; i < 1000; i++) {
            placeCircleCenter(rng, 10, countingRoute, BOUNDS);
        }
        expect(forward).toBeGreaterThan(720);
        expect(forward).toBeLessThan(880);
    });

    it('gives the same circle sequence for the same pattern and a different one for another pattern', () => {
        const run = (pattern: number) => {
            const rng = createPrng(patternSeed(3, pattern));
            return Array.from({ length: 5 }, () => placeCircleCenter(rng, 3, route, BOUNDS));
        };
        expect(run(1)).toEqual(run(1));
        expect(run(0)).not.toEqual(run(1));
        expect(run(1)).not.toEqual(run(2));
    });
});
