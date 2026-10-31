import { describe, expect, it } from 'vitest';
import {
    CHARACTER_PIXEL_SPEED_PER_SEC,
    GAME_HEIGHT,
    GAME_WIDTH,
    ROUTE_MARGIN,
    ROUTE_TIME_END_S,
    ROUTE_TIME_START_S,
    ROUTE_TIME_TOLERANCE_S,
    STAGE_COUNT
} from './constants';
import { ROUTE_SEEDS, getDifficultyParams, routeSeed } from './difficulty';
import { stageRoute } from './measure';
import { polylineLength } from './polyline';
import { generateWaypoints } from './waypoints';

const STAGES = Array.from({ length: STAGE_COUNT }, (_, i) => i + 1);
const BOUNDS = { width: GAME_WIDTH, height: GAME_HEIGHT, margin: ROUTE_MARGIN };

/** Travel time in seconds of the route a seed gives at a stage (computed here from the polyline, not via measure.ts). */
const travelSeconds = (stage: number, seed: number): number => {
    const d = getDifficultyParams(stage);
    return polylineLength(generateWaypoints(seed, d.waypointCount, d.thetaMaxDeg, BOUNDS)) / CHARACTER_PIXEL_SPEED_PER_SEC;
};

const target = (stage: number): number =>
    ROUTE_TIME_START_S + ((ROUTE_TIME_END_S - ROUTE_TIME_START_S) * (stage - 1)) / (STAGE_COUNT - 1);

const onScreen = (stage: number, seed: number): boolean => {
    const d = getDifficultyParams(stage);
    return generateWaypoints(seed, d.waypointCount, d.thetaMaxDeg, BOUNDS).every((p) => p.x >= 0 && p.x <= GAME_WIDTH);
};

/** A seed meets the rule of the spec: travel time within the tolerance and every waypoint on the screen. */
const inWindow = (stage: number, seed: number): boolean =>
    Math.abs(travelSeconds(stage, seed) - target(stage)) <= ROUTE_TIME_TOLERANCE_S && onScreen(stage, seed);

describe('the route time target', () => {
    it('goes linearly from 7 s at stage 1 to 9 s at stage 10 with a 0.1 s tolerance', () => {
        expect([ROUTE_TIME_START_S, ROUTE_TIME_END_S, ROUTE_TIME_TOLERANCE_S]).toEqual([7, 9, 0.1]);
        expect(target(1)).toBeCloseTo(7, 12);
        expect(target(10)).toBeCloseTo(9, 12);
        expect(target(2)).toBeCloseTo(7.2222, 4);
        expect(target(5)).toBeCloseTo(7.8889, 4);
    });
});

describe('ROUTE_SEEDS', () => {
    it('is the table of the spec, one seed per stage', () => {
        expect(ROUTE_SEEDS).toEqual([4, 1, 1, 36, 35, 19, 12, 94, 40, 68]);
        expect(ROUTE_SEEDS).toHaveLength(STAGE_COUNT);
    });

    it.each(STAGES)('gives stage %i a route whose travel time is within the tolerance of the target', (stage) => {
        expect(inWindow(stage, routeSeed(stage))).toBe(true);
    });

    it.each(STAGES)('has no smaller positive seed than the table one that meets the rule (stage %i)', (stage) => {
        for (let seed = 1; seed < routeSeed(stage); seed++) {
            if (inWindow(stage, seed)) expect.fail(`seed ${seed} is in the window for stage ${stage}`);
        }
    });

    it('has travel times near the hand-checked values of the spec table', () => {
        const spec = [7.09, 7.27, 7.43, 7.73, 7.92, 8.04, 8.26, 8.65, 8.73, 9.09];
        STAGES.forEach((stage) => {
            expect(travelSeconds(stage, routeSeed(stage))).toBeCloseTo(spec[stage - 1], 1);
        });
    });

    it('skips the stage 5 seed 9, whose travel time fits but whose route ends at x = 976 off the screen', () => {
        const d = getDifficultyParams(5);
        const last = generateWaypoints(9, d.waypointCount, d.thetaMaxDeg, BOUNDS).at(-1)!;
        expect(Math.abs(travelSeconds(5, 9) - target(5))).toBeLessThanOrEqual(ROUTE_TIME_TOLERANCE_S);
        expect(last.x).toBeGreaterThan(GAME_WIDTH);
        expect(routeSeed(5)).toBe(35);
    });

    it.each(STAGES)('keeps every waypoint of the stage %i route on the screen', (stage) => {
        expect(onScreen(stage, routeSeed(stage))).toBe(true);
    });
});

describe('routeSeed and stageRoute', () => {
    it('clamps stage numbers outside 1..10 like getDifficultyParams', () => {
        expect(routeSeed(0)).toBe(ROUTE_SEEDS[0]);
        expect(routeSeed(-3)).toBe(ROUTE_SEEDS[0]);
        expect(routeSeed(11)).toBe(ROUTE_SEEDS[STAGE_COUNT - 1]);
        expect(routeSeed(99)).toBe(ROUTE_SEEDS[STAGE_COUNT - 1]);
        expect(stageRoute(0)).toEqual(stageRoute(1));
        expect(stageRoute(11)).toEqual(stageRoute(STAGE_COUNT));
    });

    it.each(STAGES)('makes stageRoute(%i) the generateWaypoints route of its seed, and the same on a second call', (stage) => {
        const d = getDifficultyParams(stage);
        const expected = generateWaypoints(ROUTE_SEEDS[stage - 1], d.waypointCount, d.thetaMaxDeg, BOUNDS);
        expect(stageRoute(stage)).toEqual(expected);
        expect(stageRoute(stage)).toEqual(stageRoute(stage));
    });

    it.each(STAGES)('keeps the stage %i route spanning nearly the full width (left margin to the right)', (stage) => {
        const route = stageRoute(stage);
        expect(route[0].x).toBe(ROUTE_MARGIN);
        const last = route[route.length - 1].x;
        expect(last).toBeGreaterThan(GAME_WIDTH - ROUTE_MARGIN - 80);
        expect(last).toBeLessThan(GAME_WIDTH);
    });
});
