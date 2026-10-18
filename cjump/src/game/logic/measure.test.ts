import { describe, it, expect } from 'vitest';
import { encounteredCircles, measureAllStages, measureStage, stageRoute, travelTimeMs } from './measure';
import { getDifficultyParams } from './difficulty';
import { STAGE_COUNT, MEASURE_RUNS } from './constants';

const STAGES = Array.from({ length: STAGE_COUNT }, (_, i) => i + 1);

describe('travelTimeMs / encounteredCircles', () => {
    it('takes 1000 ms to walk a 130 px route at 130 px/s', () => {
        expect(
            travelTimeMs([
                { x: 0, y: 0 },
                { x: 130, y: 0 }
            ])
        ).toBeCloseTo(1000, 9);
    });

    it('divides the travel time by the spawn interval without rounding', () => {
        expect(encounteredCircles(10000, 1500)).toBeCloseTo(6.6667, 4);
    });
});

describe('stageRoute', () => {
    it('has the waypoint count of the stage difficulty', () => {
        for (const stage of STAGES) {
            expect(stageRoute(stage)).toHaveLength(getDifficultyParams(stage).waypointCount);
        }
    });
});

describe('measureStage', () => {
    it('reports the stage values, with travel time and encountered circles consistent with them', () => {
        const m = measureStage(3, 5);
        expect(m.stage).toBe(3);
        expect(m.spawnIntervalMs).toBe(getDifficultyParams(3).circleSpawnIntervalMs);
        expect(m.travelTimeMs).toBeCloseTo(travelTimeMs(stageRoute(3)), 9);
        expect(m.encounteredCircles).toBeCloseTo(m.travelTimeMs / m.spawnIntervalMs, 9);
    });

    it('returns identical results when measured twice with the same input', () => {
        expect(measureStage(5, 20)).toEqual(measureStage(5, 20));
    });

    it('returns clear rates that are multiples of 1 / runs within 0-1', () => {
        const m = measureStage(4, 8);
        for (const rate of [m.idleClearRate, m.reflexClearRate]) {
            expect(rate).toBeGreaterThanOrEqual(0);
            expect(rate).toBeLessThanOrEqual(1);
            expect(Math.abs(rate * 8 - Math.round(rate * 8))).toBeLessThan(1e-9);
        }
    });

    it('uses 200 runs by default', () => {
        expect(MEASURE_RUNS).toBe(200);
        const m = measureStage(2);
        expect(Math.abs(m.reflexClearRate * 200 - Math.round(m.reflexClearRate * 200))).toBeLessThan(1e-9);
    });

    it.each(STAGES)('has idle clear rate <= reflex clear rate at stage %i (fixed seeds, 200 runs)', (stage) => {
        const m = measureStage(stage);
        expect(m.idleClearRate).toBeLessThanOrEqual(m.reflexClearRate);
        // Guard against a vacuous run (a bot that never clears makes the comparison meaningless).
        // If a deliberate retune pushes a stage to 0%, revisit this guard rather than the comparison above.
        expect(m.reflexClearRate).toBeGreaterThan(0);
    });

});

describe('measureAllStages', () => {
    it('returns one measurement per stage in order', () => {
        const all = measureAllStages(1);
        expect(all.map((m) => m.stage)).toEqual(STAGES);
    });
});

describe('difficulty curve', () => {
    it('shortens the spawn interval strictly from stage 1 to 10', () => {
        for (const stage of STAGES.slice(1)) {
            expect(getDifficultyParams(stage).circleSpawnIntervalMs).toBeLessThan(
                getDifficultyParams(stage - 1).circleSpawnIntervalMs
            );
        }
    });

    it('speeds up circle growth strictly from stage 1 to 10', () => {
        for (const stage of STAGES.slice(1)) {
            expect(getDifficultyParams(stage).circleGrowthSpeedPxPerSec).toBeGreaterThan(
                getDifficultyParams(stage - 1).circleGrowthSpeedPxPerSec
            );
        }
    });

    // Enabled by the route-time-fixed extension: today the route length does not follow the stage number,
    // so the number of circles met (4.8, 4.7, 5.1, 7.7, 10.2, 8.4, ...) is not monotone.
    it.skip('meets more circles at every later stage (route lengths are not ordered by stage yet; see route-time-fixed)', () => {
        for (const stage of STAGES.slice(1)) {
            const prev = measureStage(stage - 1, 1).encounteredCircles;
            expect(measureStage(stage, 1).encounteredCircles).toBeGreaterThan(prev);
        }
    });

    // The allowed drop is decided by route-time-fixed from measurements; 0.2 is a placeholder.
    it.skip('does not let the reflex clear rate fall sharply between neighbouring stages (threshold decided by route-time-fixed)', () => {
        const MAX_DROP = 0.2;
        for (const stage of STAGES.slice(1)) {
            const prev = measureStage(stage - 1).reflexClearRate;
            expect(measureStage(stage).reflexClearRate).toBeGreaterThanOrEqual(prev - MAX_DROP);
        }
    });
});
