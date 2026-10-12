import { describe, expect, it } from 'vitest';
import { DEMO_RUN_SECONDS } from './constants';
import { decideDemoInput } from './demoBot';
import type { ScreenSize } from './screen';
import { World, type Input } from './world';

const DT = 1 / 60;
const SEEDS = 60;

/** A small seeded generator (mulberry32), so a run is reproducible. */
function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

interface RunResult {
    survived: boolean;
    releases: number;
    kills: number;
    absorbed: number;
    /** Widest x the player covered, in screen widths. */
    spread: number;
}

/** One demo run of DEMO_RUN_SECONDS driven by the bot alone. */
function playDemo(screen: ScreenSize, seed: number): RunResult {
    const world = new World(screen, seeded(seed));
    world.beginPlay();
    const input: Input = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };
    let releases = 0;
    let absorbed = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    const steps = Math.round(DEMO_RUN_SECONDS / DT);
    for (let i = 0; i < steps && world.phase === 'playing'; i++) {
        decideDemoInput(world, input);
        // A press by the bot with something stocked (the automatic release at a full stock is not the bot's).
        if (input.release && world.stock > 0) releases++;
        world.step(DT, input);
        absorbed += world.absorbed.length;
        minX = Math.min(minX, world.player.x);
        maxX = Math.max(maxX, world.player.x);
    }
    const kills = Object.values(world.breakdown).reduce((n, tally) => n + tally.count, 0);
    return { survived: world.phase === 'playing', releases, kills, absorbed, spread: (maxX - minX) / screen.width };
}

const SCREENS: { name: string; screen: ScreenSize }[] = [
    { name: 'portrait 768 x 1126', screen: { width: 768, height: 1126 } },
    { name: 'landscape 1024 x 768', screen: { width: 1024, height: 768 } },
    { name: 'wide 1536 x 768', screen: { width: 1536, height: 768 } }
];

describe.each(SCREENS)('the demo bot playing alone on $name', ({ screen }) => {
    const runs = Array.from({ length: SEEDS }, (_, seed) => playDemo(screen, seed + 1));

    it('survives all 40 seconds in at least 80% of the seeded runs', () => {
        const alive = runs.filter((r) => r.survived).length;
        expect(alive / SEEDS).toBeGreaterThanOrEqual(0.8);
    });

    it('releases at least once in at least 90% of the runs, and the releases defeat enemies', () => {
        const released = runs.filter((r) => r.releases >= 1).length;
        expect(released / SEEDS).toBeGreaterThanOrEqual(0.9);
        const withKills = runs.filter((r) => r.kills >= 1).length;
        expect(withKills / SEEDS).toBeGreaterThanOrEqual(0.9);
    });

    it('absorbs bullets in every run (the demo shows the core move)', () => {
        expect(runs.every((r) => r.absorbed > 0)).toBe(true);
    });

    it('roams: the player covers at least 40% of the screen width in 90% of the runs', () => {
        const wide = runs.filter((r) => r.spread >= 0.4).length;
        expect(wide / SEEDS).toBeGreaterThanOrEqual(0.9);
    });
});
