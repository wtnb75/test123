import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { holeCenter } from './board';
import { decideDemo, newDemoMove, type DemoSight } from './demoBot';
import { LANDSCAPE } from './layout';
import { judgeStrike, showsArrow, type Pop } from './pop';
import { displaySeconds, remainingMs } from './run';
import { nextStreak, resolveStrike } from './streak';

// The clock item (docs/spec/items.md): it adds time when hit, and nothing else changes.

describe('remainingMs with the clock bonus', () => {
    it('is the starting time when no clock has been hit', () => {
        expect(remainingMs(0)).toBe(60000);
        expect(remainingMs(0, 0)).toBe(60000);
    });

    it('adds each clock bonus to the time left (58 s in, one clock hit: 3 + 2 = 5 s left)', () => {
        expect(remainingMs(58000, 3000)).toBe(5000);
    });

    it('has no cap: a clock hit with 58 s left shows 61 s left', () => {
        // 2 s in: 58 s left before the hit; the bonus takes it to 61 s, shown as 61
        expect(remainingMs(2000, 3000)).toBe(61000);
        expect(displaySeconds(remainingMs(2000, 3000))).toBe(61);
        expect(remainingMs(0, 3000) - remainingMs(0)).toBe(3000);
    });

    it('reaches 0 exactly when elapsed time equals the starting time plus the bonus', () => {
        expect(remainingMs(63000, 3000)).toBe(0);
        expect(remainingMs(62999, 3000)).toBe(1);
    });

    it('never goes below 0 even when the elapsed time overruns', () => {
        expect(remainingMs(70000, 0)).toBe(0);
    });
});

describe('a clock hit in the streak and score rules', () => {
    it('leaves the score and the streak as they were (a clock is not a mole or a cat)', () => {
        expect(resolveStrike(30, 7, 'clock')).toEqual({ score: 30, streak: 7, applied: 0, announce: null });
    });

    it('does not start the streak over, even at 0', () => {
        expect(nextStreak(0, 'clock')).toBe(0);
        expect(nextStreak(4, 'clock')).toBe(4);
    });

    it('does not raise the multiplier when a clock would reach a step (streak 4 stays 4, nothing announced)', () => {
        expect(resolveStrike(0, 4, 'clock').announce).toBeNull();
        expect(nextStreak(4, 'mole')).toBe(5); // for contrast: a mole hit would reach the step
    });

    it('keeps a streak of 9 at 9 (a clock hit is not a mole hit: a mole from 9 would reach 10 and ×3)', () => {
        expect(resolveStrike(100, 9, 'clock')).toEqual({ score: 100, streak: 9, applied: 0, announce: null });
    });
});

describe('a clock pop is never a direction arrow and is hit like any pop', () => {
    const clock: Pop = { hole: 0, kind: 'clock', spawnedAt: 0 };

    it('shows no arrow while telegraphing or up (only moles and decoy cats do)', () => {
        expect(showsArrow(clock, 0)).toBe(false);
        expect(showsArrow(clock, PARAMS.telegraphMs + 1)).toBe(false);
    });

    it('is hit only while up, at the hole center (the hit judgment is shared with moles)', () => {
        const up = PARAMS.telegraphMs + 1;
        const at = holeCenter(0, LANDSCAPE);
        expect(judgeStrike(at, [clock], up, LANDSCAPE)).toBe(clock);
        expect(judgeStrike(at, [clock], 1, LANDSCAPE)).toBeNull();
    });
});

describe('the demo bot never chases a clock (docs/spec/title-demo.md)', () => {

    it('decides exactly what it decides with no pops at all, for a clock on or off screen, from either corner, over time', () => {
        // a clock in the far corner the bot would steer towards if it treated it as a target; the roaming
        // direction differs from that at some times and from the other corner, so a sweep catches it
        const corners = [
            { x: 0, y: 0 },
            { x: LANDSCAPE.boardW - LANDSCAPE.viewW, y: LANDSCAPE.boardH - LANDSCAPE.viewH },
        ];
        for (const hole of [0, 47]) {
            const clock: Pop = { hole, kind: 'clock', spawnedAt: 0 };
            for (const corner of corners) {
                for (let now = PARAMS.telegraphMs; now <= 12000; now += 500) {
                    const sightAt = (pops: Pop[]): DemoSight => ({
                        now,
                        view: { x: corner.x, y: corner.y, w: LANDSCAPE.viewW, h: LANDSCAPE.viewH },
                        layout: LANDSCAPE,
                        pops,
                    });
                    const withClock = newDemoMove();
                    const without = newDemoMove();
                    decideDemo(sightAt([clock]), withClock);
                    decideDemo(sightAt([]), without);
                    if (JSON.stringify(withClock) !== JSON.stringify(without)) {
                        expect.fail(`clock at hole ${hole} changed the bot at now ${now}, corner ${corner.x},${corner.y}`);
                    }
                }
            }
        }
    });

    it('never taps a clock, even one up and in the central area', () => {
        const c = holeCenter(0, LANDSCAPE);
        const clock: Pop = { hole: 0, kind: 'clock', spawnedAt: 0 };
        const move = newDemoMove();
        // a view centred on the clock's hole, the clock long up
        const sight: DemoSight = {
            now: PARAMS.telegraphMs + PARAMS.demoReactionMs + 1000,
            view: { x: c.x - LANDSCAPE.viewW / 2, y: c.y - LANDSCAPE.viewH / 2, w: LANDSCAPE.viewW, h: LANDSCAPE.viewH },
            layout: LANDSCAPE,
            pops: [clock],
        };
        decideDemo(sight, move);
        expect(move.strike).toBe(false);
    });
});
