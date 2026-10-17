// Stuck-crumble statistics (docs/spec/stuck-crumble.md "統計（模擬）"): seeded play of the demo bot with the
// crumble off and on. Measured values are in the spec; the checks below are relative, so they do not drift.
import { describe, expect, it } from 'vitest';
import { isSealed } from './crumble';
import { demoBot } from './demoBot';
import { Round } from './round';

const DT = 1 / 60;
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);

const seeded = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

interface Run {
    status: string;
    frames: number;
    height: number;
    sealedFrames: number;
    episodes: number;
    removed: number;
}

/** One round of the demo bot (up to 300 s); sealing is judged on the board at the end of each frame. */
const play = (seed: number, crumble: boolean): Run => {
    const round = new Round(seeded(seed), { crumble });
    let prev = false;
    const run: Run = { status: '', frames: 0, height: 0, sealedFrames: 0, episodes: 0, removed: 0 };
    let f = 0;
    for (; f < 300 * 60 && round.status === 'playing'; f++) {
        round.step(DT, demoBot({ grid: round.grid, player: round.player, flow: round.flow }, f * DT));
        const sealed = isSealed(round.grid, round.player);
        if (sealed) run.sealedFrames++;
        if (sealed && !prev) run.episodes++;
        prev = sealed;
    }
    run.status = round.status;
    run.frames = f;
    run.height = round.maxHeight;
    run.removed = round.crumble.removed;
    return run;
};

const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

describe('stuck-crumble statistics (60 seeds, 1/60 s steps, up to 300 s, demo bot)', () => {
    const off = SEEDS.map((s) => play(s, false));
    const on = SEEDS.map((s) => play(s, true));
    const share = (runs: Run[]): number => mean(runs.map((r) => r.sealedFrames / Math.max(1, r.frames)));

    it('is not vacuous: some runs get sealed in without the crumble, and the crumble removes cells', () => {
        expect(off.filter((r) => r.episodes > 0).length).toBeGreaterThanOrEqual(1); // measured 7
        expect(on.reduce((s, r) => s + r.removed, 0)).toBeGreaterThanOrEqual(1); // measured 41
        expect(off.every((r) => r.removed === 0)).toBe(true);
    });

    it('lowers the share of time spent sealed in (measured 4.73% -> 2.65%)', () => {
        expect(share(on)).toBeLessThan(share(off));
    });

    it('does not lower the number of cleared runs (measured 11 -> 11)', () => {
        const cleared = (runs: Run[]): number => runs.filter((r) => r.status === 'cleared').length;
        expect(cleared(on)).toBeGreaterThanOrEqual(cleared(off));
    });

    it('leaves runs that never get sealed in exactly as they were: same end frame, status and height', () => {
        const unsealed = SEEDS.map((_, i) => i).filter((i) => off[i].episodes === 0);
        expect(unsealed.length).toBeGreaterThanOrEqual(30); // measured 53
        for (const i of unsealed) {
            if (on[i].status !== off[i].status || on[i].frames !== off[i].frames || on[i].height !== off[i].height) {
                expect.fail(`seed ${SEEDS[i]} differs with the crumble on: ${JSON.stringify([off[i], on[i]])}`);
            }
        }
    });
});
