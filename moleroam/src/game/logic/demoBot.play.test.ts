import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { holeCenter, startScroll } from './board';
import { decideDemo, newDemoMove, type DemoSight } from './demoBot';
import { LANDSCAPE, portraitLayout, type Layout } from './layout';
import { applyStrike, judgeStrike, popState, type Pop } from './pop';
import { combineScrollIn } from './scroll';
import { firstSpawnAt, rollDecoys, stepSpawn } from './spawn';

const DT = 1000 / 60;
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
    moles: number;
    cats: number;
    distance: number;
    passedDecoy: boolean;
}

/** One demo run of `demoRunSeconds`, stepping the same pure logic as the Game Scene with the bot's input. */
function playDemo(layout: Layout, seed: number): RunResult {
    const rand = seeded(seed);
    let pops: Pop[] = [];
    let nextSpawn = firstSpawnAt();
    let score = 0;
    const start = startScroll(layout);
    let view = { x: start.x, y: start.y };
    const sight: DemoSight = { now: 0, view: { x: 0, y: 0, w: layout.viewW, h: layout.viewH }, layout, pops: [] };
    const move = newDemoMove();
    const result: RunResult = { moles: 0, cats: 0, distance: 0, passedDecoy: false };
    const frames = Math.round((PARAMS.demoRunSeconds * 1000) / DT);
    let now = 0;
    const step = (PARAMS.scrollSpeed * PARAMS.demoScrollRatio * DT) / 1000;

    for (let i = 0; i < frames; i++) {
        sight.now = now;
        sight.pops = pops;
        sight.view.x = view.x;
        sight.view.y = view.y;
        decideDemo(sight, move);
        if (move.strike) {
            const at = { x: view.x + move.strikeX, y: view.y + move.strikeY };
            const hit = judgeStrike(at, pops, now, layout);
            if (hit) {
                score = applyStrike(score, hit.kind).score;
                if (hit.kind === 'mole') result.moles++;
                else result.cats++;
                pops = pops.filter((p) => p !== hit);
            }
        }
        const next = combineScrollIn(layout, view, [{ x: move.moveX * step, y: move.moveY * step }]);
        result.distance += Math.hypot(next.x - view.x, next.y - view.y);
        view = next;
        now += DT;
        pops = pops.filter((p) => popState(p, now) !== 'gone');
        const { plan, scheduledAt } = stepSpawn(now, nextSpawn, pops.map((p) => p.hole), rand, layout);
        for (const p of rollDecoys(plan, rand)) pops.push({ hole: p.hole, kind: p.kind, decoy: p.decoy, spawnedAt: now });
        nextSpawn = scheduledAt;
        for (const p of pops) {
            if (p.kind !== 'cat' || p.decoy !== true || popState(p, now) !== 'up') continue;
            const c = holeCenter(p.hole, layout);
            const inside = c.x >= view.x && c.x <= view.x + layout.viewW && c.y >= view.y && c.y <= view.y + layout.viewH;
            if (inside) result.passedDecoy = true;
        }
    }
    return result;
}

const LAYOUTS: { name: string; layout: Layout }[] = [
    { name: 'landscape 1024 x 768', layout: LANDSCAPE },
    { name: 'portrait 768 x 1126', layout: portraitLayout(1126) },
    { name: 'portrait 768 x 1662', layout: portraitLayout(1662) },
];

describe.each(LAYOUTS)('the demo bot playing alone on $name', ({ layout }) => {
    const runs = Array.from({ length: SEEDS }, (_, i) => playDemo(layout, i + 1));

    it('hits at least 8 moles in at least 90% of the seeded runs', () => {
        expect(runs.filter((r) => r.moles >= 8).length / SEEDS).toBeGreaterThanOrEqual(0.9);
    });

    it('never taps a cat', () => {
        expect(runs.every((r) => r.cats === 0)).toBe(true);
    });

    it('scrolls at least 2000 px in at least 90% of the runs', () => {
        expect(runs.filter((r) => r.distance >= 2000).length / SEEDS).toBeGreaterThanOrEqual(0.9);
    });

    it('lets a decoy cat go by (sees it up in view and leaves it) in at least half of the runs', () => {
        expect(runs.filter((r) => r.passedDecoy).length / SEEDS).toBeGreaterThanOrEqual(0.5);
    });
});

describe('playDemo guards', () => {
    it('does real work: moles are hit and the view moves in at least one run', () => {
        const r = playDemo(LANDSCAPE, 1);
        expect(r.moles).toBeGreaterThan(0);
        expect(r.distance).toBeGreaterThan(0);
    });
});
