// Wall kick statistics (docs/spec.md "壁蹴りの統計（模擬）" and "壁蹴りの戻れない側"): seeded simulated play.
import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { createGrid, isSolid, type Grid } from './board';
import { columnHeights, demoBot } from './demoBot';
import { createPlayer, stepPlayer, type MoveInput, type Player } from './player';
import { Round } from './round';

const DT = 1 / 60;
const EPS = 1e-6;

const seeded = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const empty = (g: Grid, c: number, r: number): boolean => c >= 0 && c < P.COLS && r >= 0 && r < P.ROWS && !isSolid(g, c, r);
const fall = (g: Grid, c: number, r: number): number => {
    let rr = r;
    while (rr + 1 < P.ROWS && !isSolid(g, c, rr + 1)) rr++;
    return rr;
};

/** Standing cells reachable by walking and by climbing up to 2 rows and then moving sideways. */
const reachable = (g: Grid, c0: number, r0: number): Set<number> => {
    const seen = new Set<number>();
    if (!empty(g, c0, r0)) return seen;
    const start = fall(g, c0, r0);
    const queue: Array<[number, number]> = [[c0, start]];
    seen.add(start * P.COLS + c0);
    while (queue.length) {
        const [c, r] = queue.pop()!;
        const tryTo = (nc: number, nr: number): void => {
            if (!empty(g, nc, nr)) return;
            const lr = fall(g, nc, nr);
            const key = lr * P.COLS + nc;
            if (seen.has(key)) return;
            seen.add(key);
            queue.push([nc, lr]);
        };
        for (const d of [-1, 1]) {
            tryTo(c + d, r);
            for (let k = 1; k <= 2; k++) {
                if (!empty(g, c, r - k)) break;
                tryTo(c + d, r - k);
            }
        }
    }
    return seen;
};

/** Which wall the body touches within WALL_TOUCH_TOL: -1 left, 1 right, 0 none. */
const touch = (g: Grid, x: number, y: number): number => {
    const r0 = Math.floor(y);
    const r1 = Math.floor(y + P.PLAYER_H - EPS);
    const solidAt = (c: number): boolean => {
        for (let r = r0; r <= r1; r++) if (isSolid(g, c, r)) return true;
        return false;
    };
    if (x - Math.floor(x) <= P.WALL_TOUCH_TOL + 1e-9 && solidAt(Math.floor(x) - 1)) return -1;
    const right = Math.floor(x + P.PLAYER_W - EPS) + 1;
    if (right - (x + P.PLAYER_W) <= P.WALL_TOUCH_TOL + 1e-9 && solidAt(right)) return 1;
    return 0;
};

interface Run {
    status: string;
    frames: number;
    maxHeight: number;
    kicks: number;
    escapes: number;
    share: number;
}

/** One 300 s round of the demo bot; with `kickBot`, "enclosed" stretches are played by the kick bot instead. */
const play = (seed: number, kickBot: boolean): Run => {
    const round = new Round(seeded(seed));
    let enclosed = false;
    let kicks = 0;
    let escapes = 0;
    let enclosedSamples = 0;
    let samples = 0;
    let prevJump = false;
    let f = 0;
    for (; f < 300 * 60 && round.status === 'playing'; f++) {
        const pl = round.player;
        if (f % 6 === 0) {
            const c = Math.min(P.COLS - 1, Math.max(0, Math.floor(pl.x + P.PLAYER_W / 2)));
            const r = Math.min(P.ROWS - 1, Math.max(0, Math.floor(pl.y + P.PLAYER_H / 2)));
            const cells = reachable(round.grid, c, r);
            let best = 0;
            for (const key of cells) best = Math.max(best, P.ROWS - Math.floor(key / P.COLS));
            const stranded = Math.max(...columnHeights(round.grid)) - best >= 3 && cells.size <= 3;
            samples++;
            if (stranded) enclosedSamples++;
            if (kickBot) {
                if (!stranded && enclosed) escapes++;
                enclosed = stranded;
            }
        }
        let move: MoveInput = demoBot({ grid: round.grid, player: round.player, flow: round.flow }, f * DT);
        if (kickBot && enclosed) {
            const side = pl.kick?.side ?? 0;
            const ws = touch(round.grid, pl.x, pl.y);
            const want = side !== 0 ? -side : pl.x + P.PLAYER_W / 2 < P.COLS / 2 ? -1 : 1;
            move = { left: want < 0, right: want > 0, jump: false };
            if (pl.onGround) move.jump = true;
            else if (ws !== 0 && ws !== side && !prevJump) move.jump = true;
        }
        prevJump = move.jump;
        round.step(DT, move);
        if (round.player.kick?.kicked) kicks++;
    }
    return { status: round.status, frames: f, maxHeight: round.maxHeight, kicks, escapes, share: enclosedSamples / Math.max(1, samples) };
};

describe('wall kick statistics (60 seeds, 1/60 s steps, up to 300 s)', () => {
    const runs = Array.from({ length: 60 }, (_, i) => play(i + 1, true));

    it('keeps the climber enclosed for at most 10% of the time on average (measured 4.7%, 23.5% without kicks)', () => {
        const mean = runs.reduce((s, r) => s + r.share, 0) / runs.length;
        expect(mean).toBeLessThanOrEqual(0.1);
    });

    it('clears the field in at least 20 of the 60 runs (measured 26, 11 without kicks)', () => {
        expect(runs.filter((r) => r.status === 'cleared').length).toBeGreaterThanOrEqual(20);
    });

    it('is not vacuous: some runs kick, and the kick bot gets out of enclosed states', () => {
        expect(runs.filter((r) => r.kicks > 0).length).toBeGreaterThanOrEqual(1);
        expect(runs.reduce((s, r) => s + r.escapes, 0)).toBeGreaterThanOrEqual(1);
    });
});

describe('the demo bot never kicks', () => {
    const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
    const withKicks = SEEDS.map((s) => play(s, false));

    it('has no kick in 40 seeded runs', () => {
        expect(withKicks).toHaveLength(40);
        expect(withKicks.reduce((s, r) => s + r.kicks, 0)).toBe(0);
    });

    it('ends at the same frame and height as with wall kicks disabled', () => {
        const params = P as { WALL_TOUCH_TOL: number };
        const saved = params.WALL_TOUCH_TOL;
        params.WALL_TOUCH_TOL = -1; // no body edge is ever within a negative distance: no contact, no kick
        try {
            const without = SEEDS.map((s) => play(s, false));
            expect(without.map((r) => [r.status, r.frames, r.maxHeight])).toEqual(withKicks.map((r) => [r.status, r.frames, r.maxHeight]));
        } finally {
            params.WALL_TOUCH_TOL = saved;
        }
    });
});

describe('open-ground steps and holes (random and scripted input)', () => {
    /** Step of height h on the right half (x >= 5). Counts random input sequences that end standing on it. */
    const climbs = (h: number, trials: number): number => {
        const rnd = seeded(7);
        const g = createGrid();
        for (let r = P.ROWS - h; r < P.ROWS; r++) for (let c = 5; c < P.COLS; c++) g[r][c] = 1;
        let ok = 0;
        for (let t = 0; t < trials; t++) {
            let pl: Player = { ...createPlayer(), x: 1 + rnd() * 3.3 };
            let f = 0;
            let done = false;
            while (f < 150 && !done) {
                const len = 1 + Math.floor(rnd() * 8);
                const move: MoveInput = { left: rnd() < 0.3, right: rnd() < 0.7, jump: rnd() < 0.6 };
                for (let k = 0; k < len && f < 150; k++, f++) {
                    pl = stepPlayer(g, pl, move, DT);
                    if (pl.onGround && pl.x + P.PLAYER_W > 5.05 && Math.abs(pl.y + P.PLAYER_H - (P.ROWS - h)) < 1e-3) {
                        done = true;
                        break;
                    }
                }
            }
            if (done) ok++;
        }
        return ok;
    };

    it('never reaches the top of a one-sided step of height 3, with or without kicking', () => {
        expect(climbs(3, 20000)).toBe(0);
    });

    it('is not vacuous: the same random input does reach a step of height 2', () => {
        expect(climbs(2, 2000)).toBeGreaterThan(0);
    });

    /** Scripted climber: jump on the ground; in the air kick when a wall other than the last kicked one is touched. */
    const shaftExit = (width: number): number | null => {
        const g = createGrid();
        for (let r = P.ROWS - 6; r < P.ROWS; r++) for (let c = 0; c < P.COLS; c++) if (c < 4 || c >= 4 + width) g[r][c] = 1;
        let pl: Player = { ...createPlayer(), x: 4 + (width - P.PLAYER_W) / 2 };
        let prevJump = false;
        for (let f = 0; f < 60 * 8; f++) {
            const side = pl.kick?.side ?? 0;
            const ws = touch(g, pl.x, pl.y);
            const want = side !== 0 ? -side : -1;
            const move: MoveInput = { left: want < 0, right: want > 0, jump: false };
            if (pl.onGround) move.jump = true;
            else if (ws !== 0 && ws !== side && !prevJump) move.jump = true;
            prevJump = move.jump;
            pl = stepPlayer(g, pl, move, DT);
            if (pl.onGround && Math.abs(pl.y + P.PLAYER_H - (P.ROWS - 6)) < 1e-3) return f * DT;
        }
        return null;
    };

    it('climbs out of holes of width 1, 2 and 3 (depth 6) within 8 s by alternating kicks', () => {
        for (const w of [1, 2, 3]) expect(shaftExit(w), `width ${w}`).not.toBeNull();
    });

    it('does not get out of a hole of width 4 (the gap 3.3 is out of reach of a kick)', () => {
        expect(shaftExit(4)).toBeNull();
    });
});
