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
        waypointCount: 5 + s,
        circleSpawnIntervalMs: Math.max(1500 - 120 * (s - 1), 400),
        circleGrowthSpeedPxPerSec: 35 + 9 * (s - 1)
    };
}

/**
 * The route seed of each stage (index = stage - 1): the smallest positive integer seed whose route travel time
 * is within ROUTE_TIME_TOLERANCE_S of the stage's target and whose waypoints all stay on the screen
 * (docs/spec.md, route generation).
 */
export const ROUTE_SEEDS: readonly number[] = [4, 1, 1, 36, 35, 19, 12, 94, 40, 68];

/** Out-of-range stage numbers are clamped to 1..STAGE_COUNT, like getDifficultyParams. */
export function routeSeed(stage: number): number {
    const s = Math.min(Math.max(stage, 1), STAGE_COUNT);
    return ROUTE_SEEDS[s - 1];
}
