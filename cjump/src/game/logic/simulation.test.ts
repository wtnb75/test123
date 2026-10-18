import { describe, it, expect } from 'vitest';
import { simulateRun, type Bot } from './simulation';
import { idleBot, reflexBot } from './bots';
import { GAME_WIDTH, GAME_HEIGHT, MEASURE_TIMEOUT_MS } from './constants';

// Straight route (0,0) -> (130,0): 130 px at 130 px/s takes 1000 ms.
const ROUTE = [
    { x: 0, y: 0 },
    { x: 130, y: 0 }
];

// First circle is centered at (65, 0); every later circle is far from the route.
function rngWithCircleAtMiddle(centerX = 65): () => number {
    const values = [centerX / GAME_WIDTH, 0];
    let calls = 0;
    return () => {
        const call = calls++;
        if (call < values.length) {
            return values[call];
        }
        return call % 2 === 0 ? 900 / GAME_WIDTH : 500 / GAME_HEIGHT;
    };
}

function rngAllFar(): () => number {
    let calls = 0;
    return () => (calls++ % 2 === 0 ? 900 / GAME_WIDTH : 500 / GAME_HEIGHT);
}

// Hand-worked: with growth 300 px/s the edge of the middle circle (active ~700 ms after t=0,
// plus up to one spawn-interval of delay) reaches the character at roughly t = 0.85-0.9 s,
// i.e. before the route ends at 1.0 s.
const baseConfig = {
    route: ROUTE,
    spawnIntervalMs: 200,
    growthSpeedPxPerSec: 300,
    timeoutMs: MEASURE_TIMEOUT_MS
};

describe('simulateRun', () => {
    it('fails an idle run when a circle edge crosses the character', () => {
        expect(simulateRun({ ...baseConfig, rng: rngWithCircleAtMiddle(), bot: idleBot })).toBe(false);
    });

    it('does not touch while jumping: the edge crosses the airborne character and the reflex bot still clears', () => {
        expect(simulateRun({ ...baseConfig, rng: rngWithCircleAtMiddle(), bot: reflexBot })).toBe(true);
    });

    it('clears an idle run when every circle stays far from the route', () => {
        expect(simulateRun({ ...baseConfig, rng: rngAllFar(), bot: idleBot })).toBe(true);
    });

    it('fails when the route cannot be finished before the timeout', () => {
        expect(simulateRun({ ...baseConfig, rng: rngAllFar(), bot: idleBot, timeoutMs: 500 })).toBe(false);
    });

    it('clears when the timeout leaves enough time to finish the route', () => {
        expect(simulateRun({ ...baseConfig, rng: rngAllFar(), bot: idleBot, timeoutMs: 1500 })).toBe(true);
    });

    it('never finishes with a bot that jumps every time it lands, and asks the bot only when not jumping', () => {
        let calls = 0;
        const alwaysJump: Bot = () => {
            calls++;
            return true;
        };
        const cleared = simulateRun({
            ...baseConfig,
            rng: rngAllFar(),
            bot: alwaysJump,
            timeoutMs: 2000
        });
        expect(cleared).toBe(false);
        // 2000 ms is 120 frames; a jump lasts about 24 frames, so only a handful of calls are possible.
        expect(calls).toBeGreaterThan(2);
        expect(calls).toBeLessThan(10);
    });

    it('gives the bot a willTouch view that is false while no circle is active', () => {
        const seen: boolean[] = [];
        const probe: Bot = (view) => {
            seen.push(view.willTouch());
            return false;
        };
        simulateRun({ ...baseConfig, rng: rngAllFar(), bot: probe });
        expect(seen.length).toBeGreaterThan(10);
        expect(seen.every((touch) => !touch)).toBe(true);
    });

    // Slow edge (100 px/s) against a circle centered ahead of the character: the edge enters the 3 px
    // tolerance band between two frames, so a prediction that uses the previous frame's position is one frame late.
    it.each([
        { growth: 100, centerX: 95 },
        { growth: 100, centerX: 100 },
        { growth: 300, centerX: 65 }
    ])(
        'predicts a touch exactly on the frame it happens: willTouch is true on the last frame of a failed idle run (growth $growth, center $centerX)',
        ({ growth, centerX }) => {
            const seen: boolean[] = [];
            const probe: Bot = (view) => {
                seen.push(view.willTouch());
                return false;
            };
            const cleared = simulateRun({
                ...baseConfig,
                growthSpeedPxPerSec: growth,
                rng: rngWithCircleAtMiddle(centerX),
                bot: probe
            });
            expect(cleared).toBe(false);
            // The run ends on the frame of the touch, so the last view is that frame's prediction.
            expect(seen[seen.length - 1]).toBe(true);
            // No earlier frame touched (otherwise the run would have ended there).
            expect(seen.slice(0, -1).every((touch) => !touch)).toBe(true);
        }
    );

    it('gives the bot a willTouch view that becomes true when the edge is about to hit', () => {
        const seen: boolean[] = [];
        const probe: Bot = (view) => {
            seen.push(view.willTouch());
            return false;
        };
        simulateRun({ ...baseConfig, rng: rngWithCircleAtMiddle(), bot: probe });
        expect(seen.some((touch) => touch)).toBe(true);
    });
});

describe('bots', () => {
    it('idle never requests a jump even when a touch is imminent', () => {
        expect(idleBot({ willTouch: () => true })).toBe(false);
    });

    it('reflex requests a jump only when the character would touch on this frame', () => {
        expect(reflexBot({ willTouch: () => true })).toBe(true);
        expect(reflexBot({ willTouch: () => false })).toBe(false);
    });
});
