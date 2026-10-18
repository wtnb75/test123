import {
    GAME_WIDTH,
    GAME_HEIGHT,
    ROUTE_MARGIN,
    CHARACTER_PIXEL_SPEED_PER_SEC,
    STAGE_COUNT,
    MEASURE_RUNS,
    MEASURE_TIMEOUT_MS
} from './constants';
import { getDifficultyParams } from './difficulty';
import { generateWaypoints, type Point } from './waypoints';
import { polylineLength } from './polyline';
import { createPrng } from './prng';
import { simulateRun, type Bot } from './simulation';
import { idleBot, reflexBot } from './bots';

export interface StageMeasurement {
    stage: number;
    travelTimeMs: number;
    spawnIntervalMs: number;
    encounteredCircles: number;
    idleClearRate: number;
    reflexClearRate: number;
}

export function stageRoute(stage: number): Point[] {
    const difficulty = getDifficultyParams(stage);
    return generateWaypoints(stage, difficulty.waypointCount, difficulty.thetaMaxDeg, {
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        margin: ROUTE_MARGIN
    });
}

export function travelTimeMs(route: Point[]): number {
    return (polylineLength(route) / CHARACTER_PIXEL_SPEED_PER_SEC) * 1000;
}

export function encounteredCircles(travelMs: number, spawnIntervalMs: number): number {
    return travelMs / spawnIntervalMs;
}

function clearRate(stage: number, bot: Bot, runs: number): number {
    const difficulty = getDifficultyParams(stage);
    const route = stageRoute(stage);
    let cleared = 0;
    for (let run = 0; run < runs; run++) {
        const ok = simulateRun({
            route,
            spawnIntervalMs: difficulty.circleSpawnIntervalMs,
            growthSpeedPxPerSec: difficulty.circleGrowthSpeedPxPerSec,
            rng: createPrng(stage * 1000 + run),
            bot,
            timeoutMs: MEASURE_TIMEOUT_MS
        });
        if (ok) {
            cleared++;
        }
    }
    return cleared / runs;
}

export function measureStage(stage: number, runs = MEASURE_RUNS): StageMeasurement {
    const difficulty = getDifficultyParams(stage);
    const travelMs = travelTimeMs(stageRoute(stage));
    return {
        stage,
        travelTimeMs: travelMs,
        spawnIntervalMs: difficulty.circleSpawnIntervalMs,
        encounteredCircles: encounteredCircles(travelMs, difficulty.circleSpawnIntervalMs),
        idleClearRate: clearRate(stage, idleBot, runs),
        reflexClearRate: clearRate(stage, reflexBot, runs)
    };
}

export function measureAllStages(runs = MEASURE_RUNS): StageMeasurement[] {
    return Array.from({ length: STAGE_COUNT }, (_, i) => measureStage(i + 1, runs));
}
