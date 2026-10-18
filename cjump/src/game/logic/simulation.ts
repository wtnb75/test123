import {
    GAME_WIDTH,
    GAME_HEIGHT,
    COLLISION_TOLERANCE,
    JUMP_DURATION_MS,
    CHARACTER_PIXEL_SPEED_PER_SEC,
    CIRCLE_WARNING_MS,
    MEASURE_STEP_MS
} from './constants';
import { createCircle, getRadius, isOffScreen, isWarning, type CircleObstacle } from './circle';
import { isTouchingEdge } from './collision';
import {
    createCharacterState,
    requestJump,
    updateCharacter,
    hasFinished,
    isCollisionActive
} from './character';
import { advanceSpawnTimer } from './spawn';
import { polylineLength, polylinePointAt } from './polyline';
import type { Point } from './waypoints';

export interface BotView {
    // True when, without a jump, the character touches a circle edge on this frame.
    willTouch: () => boolean;
}

// Returns whether to request a jump at the start of a frame. Not asked while jumping.
export type Bot = (view: BotView) => boolean;

export interface RunConfig {
    route: Point[];
    spawnIntervalMs: number;
    growthSpeedPxPerSec: number;
    rng: () => number;
    bot: Bot;
    timeoutMs: number;
}

const BOUNDS = { width: GAME_WIDTH, height: GAME_HEIGHT };

// Returns true when the route end is reached without touching a circle edge.
// Frame n (0-based) runs entirely at time (n + 1) * MEASURE_STEP_MS, in the same order as the Game scene.
export function simulateRun(config: RunConfig): boolean {
    const { route, spawnIntervalMs, growthSpeedPxPerSec, rng, bot, timeoutMs } = config;
    const speedPerMs = CHARACTER_PIXEL_SPEED_PER_SEC / 1000 / polylineLength(route);
    let character = createCharacterState();
    let circles: CircleObstacle[] = [];
    let nextId = 0;
    let msSinceLastSpawn = 0;

    const touchesAt = (t: number, nowMs: number): boolean => {
        const point = polylinePointAt(route, Math.min(t, 1));
        return circles.some(
            (circle) =>
                !isWarning(circle, nowMs, CIRCLE_WARNING_MS) &&
                isTouchingEdge(
                    point.x,
                    point.y,
                    circle.x,
                    circle.y,
                    getRadius(circle, nowMs, growthSpeedPxPerSec, CIRCLE_WARNING_MS),
                    COLLISION_TOLERANCE
                )
        );
    };

    for (let frame = 0; (frame + 1) * MEASURE_STEP_MS <= timeoutMs; frame++) {
        const nowMs = (frame + 1) * MEASURE_STEP_MS;

        if (!character.isJumping) {
            const nextT = character.t + MEASURE_STEP_MS * speedPerMs;
            if (bot({ willTouch: () => touchesAt(nextT, nowMs) })) {
                character = requestJump(character);
            }
        }

        character = updateCharacter(character, MEASURE_STEP_MS, speedPerMs, JUMP_DURATION_MS);

        const tick = advanceSpawnTimer(msSinceLastSpawn, MEASURE_STEP_MS, spawnIntervalMs);
        msSinceLastSpawn = tick.msSinceLastSpawn;
        if (tick.shouldSpawn) {
            circles.push(createCircle(nextId++, rng, BOUNDS, nowMs));
        }

        circles = circles.filter(
            (circle) =>
                !isOffScreen(circle, getRadius(circle, nowMs, growthSpeedPxPerSec, CIRCLE_WARNING_MS), BOUNDS)
        );

        if (isCollisionActive(character) && touchesAt(character.t, nowMs)) {
            return false;
        }

        if (hasFinished(character)) {
            return true;
        }
    }
    return false;
}
