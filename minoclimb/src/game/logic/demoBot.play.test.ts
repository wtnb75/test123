import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { demoBot } from './demoBot';
import { Round } from './round';

/** Deterministic PRNG (mulberry32). */
const seeded = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

interface RunStats {
    survived: boolean;
    status: string;
    maxHeight: number;
    jumps: number;
    columns: number;
    endedAt: number;
}

const DT = 1 / 60;

const play = (seed: number): RunStats => {
    const round = new Round(seeded(seed));
    const frames = Math.round((P.DEMO_RUN_MS / 1000) / DT);
    let jumps = 0;
    const columns = new Set<number>();
    let endedAt = -1;
    let prevJump = false;
    for (let f = 0; f < frames && round.status === 'playing'; f++) {
        const move = demoBot({ grid: round.grid, player: round.player, flow: round.flow }, f * DT);
        // Count only what the bot itself pressed, and only when it can actually take off.
        if (move.jump && !prevJump && round.player.onGround) jumps++;
        prevJump = move.jump;
        round.step(DT, move);
        if (round.player.onGround) columns.add(Math.floor(round.player.x + P.PLAYER_W / 2));
        if (round.status !== 'playing') endedAt = f * DT;
    }
    // Clearing the goal counts as surviving; only a crush or a top-out is a loss.
    return {
        survived: round.status !== 'lost',
        status: round.status,
        maxHeight: round.maxHeight,
        jumps,
        columns: columns.size,
        endedAt,
    };
};

const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
};

describe('demo bot over seeded runs (seeds 1-40, one demo run each)', () => {
    const runs = Array.from({ length: 40 }, (_, i) => play(i + 1));
    const survivors = runs.filter((r) => r.survived).length;

    it('survives the run length in at least 70% of the runs (a clear counts as surviving)', () => {
        expect(survivors).toBeGreaterThanOrEqual(28);
    });

    it('is not vacuous: some runs are lost and some are survived', () => {
        expect(survivors).toBeGreaterThan(0);
        expect(survivors).toBeLessThan(40);
        // Losses are real losses (a crush or a top-out ended them early), not runs that merely stopped.
        const lost = runs.filter((r) => !r.survived);
        expect(lost.length).toBeGreaterThan(0);
        expect(lost.every((r) => r.status === 'lost' && r.endedAt >= 0 && r.endedAt < P.DEMO_RUN_MS / 1000)).toBe(true);
        expect(runs.filter((r) => r.survived).every((r) => r.status === 'playing' || r.status === 'cleared')).toBe(true);
    });

    it('climbs: the median of the highest height reached is at least 6', () => {
        expect(median(runs.map((r) => r.maxHeight))).toBeGreaterThanOrEqual(6);
    });

    it('jumps: on average at least 8 jumps pressed by the bot per run', () => {
        const mean = runs.reduce((sum, r) => sum + r.jumps, 0) / runs.length;
        expect(mean).toBeGreaterThanOrEqual(8);
    });

    it('covers the field: the median run stands on at least 5 different columns', () => {
        expect(median(runs.map((r) => r.columns))).toBeGreaterThanOrEqual(5);
    });
});
