import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { demoBot } from './demoBot';
import { Round } from './round';

// The 200-seed bot comparison of docs/spec.md 完了条件 の 躊躇（追加）: crushed runs with the hesitating drop must be
// at most 46 (the measured value, with the sway); the baseline without it (the switch off) is measured here too, as 51.

const seeded = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const DT = 1 / 60;
const SEEDS = 200;

/** One demo run of the bot; returns how it ended (`lost` with `crushed` is a crushed run). */
const play = (seed: number, hesitate: boolean): { status: string; loseReason: string | null } => {
    const round = new Round(seeded(seed), { hesitate });
    const frames = Math.round((P.DEMO_RUN_MS / 1000) / DT);
    for (let f = 0; f < frames && round.status === 'playing'; f++) {
        const move = demoBot({ grid: round.grid, player: round.player, flow: round.flow }, f * DT);
        round.step(DT, move);
    }
    return { status: round.status, loseReason: round.loseReason };
};

const crushedCount = (hesitate: boolean): number => {
    let crushed = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
        const r = play(seed, hesitate);
        if (r.status === 'lost' && r.loseReason === 'crushed') crushed++;
    }
    return crushed;
};

describe('the hesitating drop over 200 seeded demo runs (docs/spec.md 躊躇の節)', () => {
    it('crushes at most 46 of the 200 runs with the hesitating drop (the measured value)', () => {
        expect(crushedCount(true)).toBeLessThanOrEqual(46);
    });

    it('the baseline without the pause crushes 51 of the same 200 runs (characterization of the pre-pause measurement)', () => {
        expect(crushedCount(false)).toBe(51);
    });
});
