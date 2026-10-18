import { describe, it, expect } from 'vitest';
import { advanceSpawnTimer } from './spawn';
import { createPrng } from './prng';

describe('advanceSpawnTimer', () => {
    it('spawns on exactly the frame where the elapsed time reaches the interval, then resets to 0', () => {
        let state = { msSinceLastSpawn: 0, shouldSpawn: false };
        const spawns: boolean[] = [];
        for (let frame = 0; frame < 3; frame++) {
            state = advanceSpawnTimer(state.msSinceLastSpawn, 500, 1500);
            spawns.push(state.shouldSpawn);
        }
        expect(spawns).toEqual([false, false, true]);
        expect(state.msSinceLastSpawn).toBe(0);
    });

    it('does not spawn when the elapsed time is 1 ms short of the interval', () => {
        const tick = advanceSpawnTimer(1000, 499, 1500);
        expect(tick).toEqual({ msSinceLastSpawn: 1499, shouldSpawn: false });
    });

    it('does not carry the remainder over after a spawn', () => {
        const tick = advanceSpawnTimer(1400, 400, 1500);
        expect(tick).toEqual({ msSinceLastSpawn: 0, shouldSpawn: true });
    });

    it('matches the previous inline Game logic on every frame of a 1000-frame varying-delta sequence', () => {
        const rng = createPrng(42);
        const interval = 1500;
        let reference = 0;
        let state = { msSinceLastSpawn: 0, shouldSpawn: false };
        let spawnCount = 0;
        for (let frame = 0; frame < 1000; frame++) {
            const delta = 5 + rng() * 35;

            // Reference: the code that lived in Game.update before the extraction.
            reference += delta;
            let referenceSpawn = false;
            if (reference >= interval) {
                reference = 0;
                referenceSpawn = true;
            }

            state = advanceSpawnTimer(state.msSinceLastSpawn, delta, interval);
            if (state.shouldSpawn !== referenceSpawn || state.msSinceLastSpawn !== reference) {
                expect.fail(`diverged at frame ${frame}`);
            }
            if (referenceSpawn) {
                spawnCount++;
            }
        }
        expect(spawnCount).toBeGreaterThan(5);
    });
});
