import { describe, it, expect } from 'vitest';
import { getDifficultyParams } from './difficulty';
import { STAGE_COUNT } from './constants';

describe('getDifficultyParams', () => {
    it('returns the baseline values for stage 1', () => {
        expect(getDifficultyParams(1)).toEqual({
            thetaMaxDeg: 30,
            waypointCount: 6,
            circleSpawnIntervalMs: 1500,
            circleGrowthSpeedPxPerSec: 35
        });
    });

    it('returns the hardest values for the final stage', () => {
        expect(getDifficultyParams(STAGE_COUNT)).toEqual({
            thetaMaxDeg: 90,
            waypointCount: 15,
            circleSpawnIntervalMs: 420,
            circleGrowthSpeedPxPerSec: 116
        });
    });

    it('clamps out-of-range stage numbers', () => {
        expect(getDifficultyParams(999).thetaMaxDeg).toBe(90);
        expect(getDifficultyParams(0).thetaMaxDeg).toBe(30);
    });

    it('increases waypointCount and growth speed as the stage advances', () => {
        for (let stage = 1; stage < STAGE_COUNT; stage++) {
            const current = getDifficultyParams(stage);
            const next = getDifficultyParams(stage + 1);
            expect(next.waypointCount).toBeGreaterThan(current.waypointCount);
            expect(next.circleGrowthSpeedPxPerSec).toBeGreaterThan(current.circleGrowthSpeedPxPerSec);
        }
    });

    it('decreases circleSpawnIntervalMs as the stage advances, floored at 400', () => {
        for (let stage = 1; stage < STAGE_COUNT; stage++) {
            const current = getDifficultyParams(stage);
            const next = getDifficultyParams(stage + 1);
            expect(next.circleSpawnIntervalMs).toBeLessThanOrEqual(current.circleSpawnIntervalMs);
            expect(next.circleSpawnIntervalMs).toBeGreaterThanOrEqual(400);
        }
    });
});
