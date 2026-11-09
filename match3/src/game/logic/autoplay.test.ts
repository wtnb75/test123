// Whole plays by simple bots (docs/spec/special-gems.md "自動プレイ"): the special stones must show up and play out.
import { describe, expect, it } from 'vitest';
import { COLS, MOVES, ROWS } from '../params';
import { RAINBOW, canSwap, findMatches, swapCells, swapPartners, type Pos } from './board';
import { Round } from './round';
import { planClear, type ClearPlan } from './special';
import { seeded } from './testing';

type Bot = 'first' | 'max' | 'bottom';

/** Every neighbouring pair, each once: stones row by row (bottom row first for 'bottom'), right partner before down. */
function candidates(bot: Bot): [Pos, Pos][] {
    const rows = Array.from({ length: ROWS }, (_, r) => r);
    if (bot === 'bottom') rows.reverse();
    const out: [Pos, Pos][] = [];
    for (const r of rows) {
        for (let c = 0; c < COLS; c++) {
            const a = { r, c };
            for (const b of swapPartners(a, ROWS, COLS)) {
                if (b.r > a.r || (b.r === a.r && b.c > a.c)) out.push([a, b]);
            }
        }
    }
    return out;
}

/** The first clear of a swap tried on a copy of the round (null when the swap would be refused), with the number of stones that were in runs. */
function tryFirst(round: Round, a: Pos, b: Pos): { plan: ClearPlan; inRuns: number } | null {
    if (!canSwap(a, b, ROWS, COLS)) return null;
    const board = round.board.map((row) => [...row]);
    const kinds = round.kinds.map((row) => [...row]);
    swapCells(board, a, b);
    [kinds[a.r][a.c], kinds[b.r][b.c]] = [kinds[b.r][b.c], kinds[a.r][a.c]];
    const plan = planClear(board, kinds, [a, b]);
    return plan ? { plan, inRuns: findMatches(board).length } : null;
}

function choose(round: Round, bot: Bot): [Pos, Pos] | null {
    const list = candidates(bot).filter(([a, b]) => tryFirst(round, a, b) !== null);
    if (list.length === 0) return null;
    if (bot !== 'max') return list[0];
    const size = ([a, b]: [Pos, Pos]) => (tryFirst(round, a, b) as NonNullable<ReturnType<typeof tryFirst>>).plan.count;
    return list.reduce((best, cur) => (size(cur) > size(best) ? cur : best));
}

interface Tally {
    made: Record<string, number>;
    /** First clears where special stones (or a colour stone swap) removed more stones than the runs held. */
    effects: number;
    endings: number;
    scores: number[];
}

function playAll(bot: Bot): Tally {
    const tally: Tally = { made: {}, effects: 0, endings: 0, scores: [] };
    for (let seed = 1; seed <= 60; seed++) {
        const round = new Round(seeded(seed));
        while (round.moves > 0) {
            let move = choose(round, bot);
            if (!move) {
                round.reshuffle();
                move = choose(round, bot);
            }
            if (!move) throw new Error(`bot ${bot} seed ${seed}: no move even after a reshuffle`);
            const first = tryFirst(round, move[0], move[1]);
            // A line or bomb went off: the clear is bigger than its runs, and no colour stone was swapped (its sweep
            // alone would make it bigger).
            const [a, b] = move;
            const colourSwap = round.board[a.r][a.c] === RAINBOW || round.board[b.r][b.c] === RAINBOW;
            if (first && !colourSwap && first.plan.count > first.inRuns) tally.effects++;
            const out = round.swap(move[0], move[1]);
            if (!out.accepted) throw new Error(`bot ${bot} seed ${seed}: a swap it chose was refused`);
            for (const step of out.steps) for (const s of step.spawned) tally.made[s.kind] = (tally.made[s.kind] ?? 0) + 1;
            if (out.next === 'ending') tally.endings++;
            if (out.next === 'shuffle') round.reshuffle();
        }
        tally.scores.push(round.score);
    }
    return tally;
}

describe('plays by simple bots, 60 seeds x 30 moves', () => {
    const tallies = new Map<Bot, Tally>();
    const tally = (bot: Bot): Tally => {
        if (!tallies.has(bot)) tallies.set(bot, playAll(bot));
        return tallies.get(bot) as Tally;
    };

    for (const bot of ['first', 'max', 'bottom'] as const) {
        it(`bot "${bot}" plays every play to its end, makes special stones and sets some off`, () => {
            const t = tally(bot);
            expect(t.endings).toBe(60);
            expect(t.scores.every((s) => s > 0)).toBe(true);
            expect(t.effects).toBeGreaterThan(0);
            // Every kind of special stone is made by every bot (60 plays), not just by the bots together.
            for (const kind of ['lineRow', 'lineCol', 'bomb', 'rainbow']) {
                if (!(t.made[kind] >= 1)) expect.fail(`bot ${bot} never made a ${kind} stone: ${JSON.stringify(t.made)}`);
            }
        });
    }

    it('all four special stone kinds get made across the bots', () => {
        const kinds = new Set<string>();
        for (const bot of ['first', 'max', 'bottom'] as const) Object.keys(tally(bot).made).forEach((k) => kinds.add(k));
        expect([...kinds].sort()).toEqual(['bomb', 'lineCol', 'lineRow', 'rainbow']);
    });

    it('a play uses exactly MOVES accepted swaps', () => {
        const round = new Round(seeded(7));
        let used = 0;
        while (round.moves > 0) {
            let move = choose(round, 'first');
            if (!move) {
                round.reshuffle();
                move = choose(round, 'first');
            }
            const out = round.swap((move as [Pos, Pos])[0], (move as [Pos, Pos])[1]);
            if (out.accepted) used++;
            if (out.accepted && out.next === 'shuffle') round.reshuffle();
        }
        expect(used).toBe(MOVES);
    });
});
