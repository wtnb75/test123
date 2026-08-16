import { STAGE_COUNT } from './constants';

export interface DifficultyParams {
    thetaMaxDeg: number;
    waypointCount: number;
    circleSpawnIntervalMs: number;
    circleGrowthSpeedPxPerSec: number;
}

export function getDifficultyParams(stage: number): DifficultyParams {
    const s = Math.min(Math.max(stage, 1), STAGE_COUNT);
    return {
        thetaMaxDeg: Math.min(30 + 10 * (s - 1), 90),
        waypointCount: 3 + s,
        circleSpawnIntervalMs: Math.max(1800 - 120 * (s - 1), 600),
        circleGrowthSpeedPxPerSec: 40 + 8 * (s - 1)
    };
}
