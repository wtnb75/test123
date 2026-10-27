import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { holeCenter } from './board';
import { decideDemo, newDemoMove, type DemoSight } from './demoBot';
import { LANDSCAPE } from './layout';
import { applyStrike, arrowStyle, changeLabel, judgeStrike, popState, showsArrow, type Pop, YELLOW_ARROW_COLOR } from './pop';
import { planSpawn, rollDecoy, rollDecoys, stepSpawn } from './spawn';
import { announcedMultiplier, nextStreak, resolveStrike, streakMultiplier } from './streak';

// docs/spec/golden-mole.md "テスト観点". Numbers in the comments are hand-worked from the spec.

/** A rand() that returns the given values in order, counts its calls and fails if asked for more. */
const seq = (values: number[]): { rand: () => number; calls: () => number } => {
    let i = 0;
    return {
        rand: () => {
            if (i >= values.length) throw new Error(`rand() called more than ${values.length} times`);
            return values[i++];
        },
        calls: () => i,
    };
};

const golden = (hole: number, spawnedAt = 0): Pop => ({ hole, kind: 'golden', spawnedAt });
const mole = (hole: number, spawnedAt = 0): Pop => ({ hole, kind: 'mole', spawnedAt });

describe('golden mole spawn (cat draw -> clock draw -> golden draw -> next pop)', () => {
    // single spawn on an empty board: combo roll 0.5 (no combo), hole pick 0, then the pop's kind draws
    it('is golden for a draw just under goldenRate (0.0499) and a mole at exactly 0.05 or more', () => {
        expect(PARAMS.goldenRate).toBe(0.05);
        expect(planSpawn([], seq([0.5, 0, 0.5, 0.99, 0.0499]).rand)).toEqual([{ hole: 0, kind: 'golden' }]);
        expect(planSpawn([], seq([0.5, 0, 0.5, 0.99, 0.05]).rand)).toEqual([{ hole: 0, kind: 'mole' }]);
        expect(planSpawn([], seq([0.5, 0, 0.5, 0.99, 0.9]).rand)).toEqual([{ hole: 0, kind: 'mole' }]);
    });

    it('draws the golden roll only for a pop that is neither a cat nor a clock', () => {
        const cat = seq([0.5, 0, 0.2]); // cat roll 0.2 < friendRate: no clock roll, no golden roll
        expect(planSpawn([], cat.rand)).toEqual([{ hole: 0, kind: 'cat' }]);
        expect(cat.calls()).toBe(3);
        const clock = seq([0.5, 0, 0.5, 0.0499]); // clock roll under itemRate: a clock, no golden roll
        expect(planSpawn([], clock.rand)).toEqual([{ hole: 0, kind: 'clock' }]);
        expect(clock.calls()).toBe(4);
        const mo = seq([0.5, 0, 0.5, 0.99, 0.99]); // a mole took all three rolls
        planSpawn([], mo.rand);
        expect(mo.calls()).toBe(5);
    });

    it('keeps the order for a combo: each pop takes its own cat, clock and golden draws before the next pop', () => {
        // combo roll 0.1, anchor 0, near 0 and 0.99 (holes 0, 1, 9);
        // pop 1: cat roll 0.9, clock roll 0.99, golden roll 0.01 -> golden
        // pop 2: cat roll 0.1 -> cat (no more draws for it)
        // pop 3: cat roll 0.5, clock roll 0.99, golden roll 0.99 -> mole
        const r = seq([0.1, 0, 0, 0.99, 0.9, 0.99, 0.01, 0.1, 0.5, 0.99, 0.99]);
        expect(planSpawn([], r.rand).map((p) => p.kind)).toEqual(['golden', 'cat', 'mole']);
        expect(r.calls()).toBe(11);
    });

    it('is never a decoy: the decoy roll is for cats only, so a golden mole draws nothing for it', () => {
        const r = seq([]); // any call would throw
        expect(rollDecoy('golden', r.rand)).toBe(false);
        expect(rollDecoys([{ hole: 3, kind: 'golden' }], r.rand)).toEqual([{ hole: 3, kind: 'golden', decoy: false }]);
    });

    it('is spawned by a due check (stepSpawn) with the golden roll included', () => {
        const r = seq([0.5, 0, 0.5, 0.99, 0.01]);
        expect(stepSpawn(500, 500, [], r.rand).plan).toEqual([{ hole: 0, kind: 'golden' }]);
    });
});

describe('golden mole timeline (telegraph 800 ms, then up for goldenLifetimeMs 1500)', () => {
    it('is up from 800 ms and gone at exactly 2300 ms (a mole is up until 3799 ms and gone at 3800 ms)', () => {
        expect(PARAMS.telegraphMs + PARAMS.goldenLifetimeMs).toBe(2300);
        expect(popState(golden(0), 799)).toBe('telegraph');
        expect(popState(golden(0), 800)).toBe('up');
        expect(popState(golden(0), 2299)).toBe('up');
        expect(popState(golden(0), 2300)).toBe('gone');
        expect(popState(mole(0), 3799)).toBe('up');
        expect(popState(mole(0), 3800)).toBe('gone');
    });

    it('counts from its own spawn time', () => {
        expect(popState(golden(0, 10000), 12299)).toBe('up');
        expect(popState(golden(0, 10000), 12300)).toBe('gone');
    });
});

describe('golden mole hit', () => {
    it('scores a fixed +50 with no streak multiplier, whatever the streak (0, 4, 5, 12)', () => {
        for (const streak of [0, 4, 5, 12]) {
            const r = resolveStrike(100, streak, 'golden');
            expect(r.score).toBe(150);
            expect(r.applied).toBe(50);
        }
        expect(streakMultiplier(12)).toBe(3); // the multiplier exists (x3), it is just not applied to a golden mole
    });

    it('extends the streak by one, like a mole (0 -> 1, 4 -> 5, 12 -> 13)', () => {
        expect(nextStreak(0, 'golden')).toBe(1);
        expect(nextStreak(4, 'golden')).toBe(5);
        expect(nextStreak(12, 'golden')).toBe(13);
        expect(resolveStrike(0, 12, 'golden').streak).toBe(13);
    });

    it('sets the next mole multiplier: streak 4 -> golden (+50, streak 5) -> mole is x2 (+20); streak 9 -> 10 -> x3 (+30)', () => {
        const afterGolden = resolveStrike(0, 4, 'golden');
        expect([afterGolden.score, afterGolden.streak]).toEqual([50, 5]);
        expect(resolveStrike(afterGolden.score, afterGolden.streak, 'mole').applied).toBe(20);
        const afterNine = resolveStrike(0, 9, 'golden');
        expect(afterNine.streak).toBe(10);
        expect(resolveStrike(afterNine.score, afterNine.streak, 'mole').applied).toBe(30);
    });

    it('announces x2! when it takes the streak to 5 and x3! at 10, and nothing at other values', () => {
        expect(resolveStrike(0, 4, 'golden').announce).toBe(2);
        expect(resolveStrike(0, 9, 'golden').announce).toBe(3);
        expect(resolveStrike(0, 5, 'golden').announce).toBeNull();
        expect(resolveStrike(0, 0, 'golden').announce).toBeNull();
        expect(announcedMultiplier(5)).toBe(2);
    });

    it('is shown as "+50" (the applied score)', () => {
        expect(changeLabel(applyStrike(0, 'golden', 3).applied)).toBe('+50');
        expect(PARAMS.scoreGolden).toBe(50);
    });

    it('leaves the other strikes as they were: mole x multiplier, cat -20 never below 0, clock and miss change nothing', () => {
        expect(applyStrike(0, 'mole', 1).applied).toBe(10);
        expect(applyStrike(0, 'mole', 3).applied).toBe(30);
        expect(applyStrike(100, 'cat').applied).toBe(-20);
        expect(applyStrike(5, 'cat')).toEqual({ score: 0, applied: -5 });
        expect(resolveStrike(80, 7, 'clock')).toEqual({ score: 80, streak: 7, applied: 0, announce: null });
        expect(resolveStrike(80, 7, 'miss')).toEqual({ score: 80, streak: 0, applied: 0, announce: null });
        expect(resolveStrike(80, 7, 'cat').streak).toBe(0);
    });

    it('is hit at exactly hitRadius and missed beyond it, like a mole', () => {
        const c = holeCenter(5, LANDSCAPE);
        const now = 1000; // up for both kinds
        expect(judgeStrike({ x: c.x + PARAMS.hitRadius, y: c.y }, [golden(5)], now)?.kind).toBe('golden');
        expect(judgeStrike({ x: c.x + PARAMS.hitRadius + 0.01, y: c.y }, [golden(5)], now)).toBeNull();
        expect(judgeStrike({ x: c.x + PARAMS.hitRadius, y: c.y }, [mole(5)], now)?.kind).toBe('mole');
    });

    it('picks the golden mole or the mole by distance, whatever the list order (holes 320 px apart cannot tie within hitRadius 70)', () => {
        const a = holeCenter(5, LANDSCAPE);
        const now = 1000;
        const up = (hole: number, kind: Pop['kind']): Pop => ({ hole, kind, spawnedAt: 0 });
        // a tap 10 px from hole 5's centre is nearer to hole 5 whichever of the two sits there
        for (const list of [[up(5, 'golden'), up(6, 'mole')], [up(6, 'mole'), up(5, 'golden')]]) {
            expect(judgeStrike({ x: a.x + 10, y: a.y }, list, now)?.kind).toBe('golden');
        }
        for (const list of [[up(5, 'mole'), up(6, 'golden')], [up(6, 'golden'), up(5, 'mole')]]) {
            expect(judgeStrike({ x: a.x + 10, y: a.y }, list, now)?.kind).toBe('mole');
        }
        // the point halfway between the two holes is 160 px from each: out of range for both, so a miss
        expect(PARAMS.hitRadius).toBeLessThan(160);
        expect(judgeStrike({ x: a.x + 160, y: a.y }, [up(5, 'golden'), up(6, 'mole')], now)).toBeNull();
    });

    it('cannot be hit while it telegraphs (a tap there is a miss) and not after it has gone', () => {
        const c = holeCenter(2, LANDSCAPE);
        expect(judgeStrike(c, [golden(2)], 799)).toBeNull();
        expect(judgeStrike(c, [golden(2)], 800)?.kind).toBe('golden');
        expect(judgeStrike(c, [golden(2)], 2300)).toBeNull();
        expect(resolveStrike(30, 6, 'miss').streak).toBe(0); // the miss resets the streak
    });
});

describe('golden mole arrow', () => {
    it('is shown while telegraphing or up (the Scene draws it only off screen), and not once gone', () => {
        expect(showsArrow(golden(0), 0)).toBe(true);
        expect(showsArrow(golden(0), 799)).toBe(true);
        expect(showsArrow(golden(0), 800)).toBe(true);
        expect(showsArrow(golden(0), 2299)).toBe(true);
        expect(showsArrow(golden(0), 2300)).toBe(false);
    });

    it('keeps the arrow rules for the others: moles and decoy cats yes; plain cats and clocks never', () => {
        expect(showsArrow(mole(0), 0)).toBe(true);
        expect(showsArrow({ hole: 0, kind: 'cat', spawnedAt: 0, decoy: true }, 0)).toBe(true);
        expect(showsArrow({ hole: 0, kind: 'cat', spawnedAt: 0 }, 0)).toBe(false);
        expect(showsArrow({ hole: 0, kind: 'clock', spawnedAt: 0 }, 0)).toBe(false);
    });

    it('is gold with a 3 px white outline for a golden mole; moles and decoys stay yellow with no outline', () => {
        expect(arrowStyle(golden(0))).toEqual({ color: PARAMS.goldenArrowColor, outlinePx: 3 });
        expect(PARAMS.goldenArrowColor).toBe(0xffaa00);
        expect(PARAMS.goldenArrowOutlinePx).toBe(3);
        expect(arrowStyle(mole(0))).toEqual({ color: YELLOW_ARROW_COLOR, outlinePx: 0 });
        expect(arrowStyle({ hole: 0, kind: 'cat', spawnedAt: 0, decoy: true })).toEqual({ color: YELLOW_ARROW_COLOR, outlinePx: 0 });
        expect(arrowStyle(golden(0)).color).not.toBe(arrowStyle({ hole: 0, kind: 'cat', spawnedAt: 0, decoy: true }).color);
    });
});

describe('golden mole and the demo bot', () => {
    const sight = (pops: Pop[], now: number): DemoSight => ({
        now,
        view: { x: 500, y: 400, w: LANDSCAPE.viewW, h: LANDSCAPE.viewH },
        layout: LANDSCAPE,
        pops,
    });
    const REACTED = PARAMS.telegraphMs + PARAMS.demoReactionMs + 10;

    it('never taps a golden mole, even one that is up in the middle of the view for long enough', () => {
        const c = holeCenter(19, LANDSCAPE); // inside the central area of this view
        const out = newDemoMove();
        decideDemo(sight([golden(19)], REACTED), out);
        expect(out.strike).toBe(false);
        // a mole in the same place is tapped (the bot works at all in this setup)
        const moleOut = newDemoMove();
        decideDemo(sight([mole(19)], REACTED), moleOut);
        expect(moleOut.strike).toBe(true);
        expect([moleOut.strikeX, moleOut.strikeY]).toEqual([c.x - 500, c.y - 400]);
    });

    it('does not walk towards a golden mole (it is not a target): scrolling follows the mole instead, or roams', () => {
        const far = golden(0); // hole 0 at (160, 160), far up-left of the view: a mole there would pull the view left and up
        const goldenOnly = newDemoMove();
        decideDemo(sight([far], 0), goldenOnly);
        const moleToo = newDemoMove();
        decideDemo(sight([mole(0)], 0), moleToo);
        expect([moleToo.moveX, moleToo.moveY]).toEqual([-1, -1]);
        expect([goldenOnly.moveX, goldenOnly.moveY]).not.toEqual([-1, -1]);
        // with both present, the mole alone decides the target (the nearer golden mole is ignored)
        const bothMole = golden(19);
        const both = newDemoMove();
        decideDemo(sight([bothMole, mole(0)], 0), both);
        expect([both.moveX, both.moveY]).toEqual([-1, -1]);
    });
});
