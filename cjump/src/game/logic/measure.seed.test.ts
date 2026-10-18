import { describe, it, expect, vi } from 'vitest';

const seeds: number[] = [];

vi.mock('./prng', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./prng')>();
    return {
        ...actual,
        createPrng: (seed: number) => {
            seeds.push(seed);
            return actual.createPrng(seed);
        }
    };
});

const { measureStage } = await import('./measure');

describe('measureStage seeding', () => {
    it('seeds run r of stage s with s * 1000 + r, so every run gets its own circle positions', () => {
        seeds.length = 0;
        measureStage(3, 3);
        // Once per run for the idle bot, then once per run for the reflex bot (waypoint generation seeds with the stage).
        const runSeeds = seeds.filter((seed) => seed >= 3000);
        expect(runSeeds).toEqual([3000, 3001, 3002, 3000, 3001, 3002]);
    });
});
