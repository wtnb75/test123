import { describe, expect, it } from 'vitest';
import { DemoDirector, type DemoEvent } from 'title-demo';

import { createEmptyBoxes, getBoxOrder, getValidBoxes, resolvePlacement, type BoxKey } from './primtris';
import {
    DEMO_DROP_MS,
    DEMO_FADE_MS,
    DEMO_ROUNDS,
    DEMO_SLIDE_MS,
    DEMO_WAIT_MS,
    SelectionFade,
    TITLE_DEMO_OPTIONS,
    chooseDemoMove,
    createTitleDemoGame,
    demoLayout,
    hesitationStart,
    tileStateAt,
    type DemoSchedule,
    type TitleDemoDetail
} from './titleDemo';

// Expected values are worked by hand from docs/spec/title-demo.md ("テスト観点").

/** A rng that returns the given values in order (and fails loudly when it runs out). */
const scripted = (values: number[]) => {
    let index = 0;
    const draw = () => {
        if (index >= values.length) {
            throw new Error('rng ran out');
        }
        return values[index++];
    };
    return Object.assign(draw, { used: () => index });
};

/** A small deterministic generator for property runs. */
const seeded = (seed: number) => {
    let state = seed >>> 0 || 1;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 2 ** 32;
    };
};

describe('chooseDemoMove', () => {
    const empty = createEmptyBoxes();

    it('30 with 2 digits and rng [0.5, 0.5, 0.9]: no miss, the 2nd of [x2, x3, x5] is x3, no hesitation', () => {
        const rng = scripted([0.5, 0.5, 0.9]);
        expect(chooseDemoMove(30, 2, empty, 12, rng)).toEqual({ box: 'x3', decoy: null });
        expect(rng.used()).toBe(3);
    });

    it('30 with rng [0.1, 0.99, 0.9]: a miss picks the last of [x7, P], which is P', () => {
        expect(chooseDemoMove(30, 2, empty, 12, scripted([0.1, 0.99, 0.9]))).toEqual({ box: 'P', decoy: null });
    });

    it('31 (prime) with rng [0, 0, 0.9]: a miss picks the first wrong box, x2', () => {
        expect(chooseDemoMove(31, 2, empty, 12, scripted([0, 0, 0.9]))).toEqual({ box: 'x2', decoy: null });
    });

    it('a miss that would overflow the box becomes a correct move with the same second draw', () => {
        // 3003 = 3 * 7 * 11 * 13: correct [x3, x7], wrong [x2, x5, xN, P]
        const full = createEmptyBoxes();
        full.x2 = [1, 1, 1, 1, 1, 1, 1, 1, 1];
        expect(chooseDemoMove(3003, 4, empty, 12, scripted([0, 0, 0.9])).box).toBe('x2');
        expect(chooseDemoMove(3003, 4, full, 12, scripted([0, 0, 0.9])).box).toBe('x3');
        // r2 = 0.2 first picks x2 (overflow), then the same r2 picks the 1st of [x3, x7]
        expect(chooseDemoMove(3003, 4, full, 12, scripted([0, 0.2, 0.9])).box).toBe('x3');
        // r2 = 0.99 picks P (room left), so there is no switch
        expect(chooseDemoMove(3003, 4, full, 12, scripted([0, 0.99, 0.9])).box).toBe('P');
    });

    it('a first draw exactly at the miss rate is not a miss; just under it is', () => {
        expect(chooseDemoMove(30, 2, empty, 12, scripted([0.2, 0.5, 0.9])).box).toBe('x3');
        expect(chooseDemoMove(30, 2, empty, 12, scripted([0.19999, 0.5, 0.9])).box).toBe('P');
    });

    it('switches to the correct box picked with the same second draw (r2 = 0.99 -> 2nd of [x3, x7])', () => {
        const full = createEmptyBoxes();
        full.P = Array.from({ length: 12 }, () => 1);
        // r1 = 0 misses; r2 = 0.99 picks P of [x2, x5, xN, P]: it holds 12 digits, 4 more overflow
        expect(chooseDemoMove(3003, 4, full, 12, scripted([0, 0.99, 0.9])).box).toBe('x7');
    });

    it('hesitates when the third draw is under the rate, to a box other than the chosen one', () => {
        const rng = scripted([0.5, 0.5, 0.1, 0.0]);
        // chosen x3; the others are [x2, x5, x7, P]; floor(0.0 * 4) = 0 -> x2
        expect(chooseDemoMove(30, 2, empty, 12, rng)).toEqual({ box: 'x3', decoy: 'x2' });
        expect(rng.used()).toBe(4);
    });

    it('does not draw a fourth number when it does not hesitate (0.35 is the first value that does not)', () => {
        const rng = scripted([0.5, 0.5, 0.35]);
        expect(chooseDemoMove(30, 2, empty, 12, rng).decoy).toBeNull();
        expect(rng.used()).toBe(3);
    });

    it('never chooses a hidden box, never overflows, and the decoy is never the chosen box (property)', () => {
        let hesitated = 0;
        let missed = 0;
        for (const digits of [2, 3, 4]) {
            const active = getBoxOrder(digits);
            for (let seed = 1; seed <= 200; seed += 1) {
                const rng = seeded(seed);
                let boxes = createEmptyBoxes();
                for (let n = 0; n < DEMO_ROUNDS; n += 1) {
                    const lower = 10 ** (digits - 1);
                    const value = lower + Math.floor(rng() * 9 * lower);
                    const move = chooseDemoMove(value, digits, boxes, 12, rng);
                    if (!active.includes(move.box)) {
                        expect.fail(`hidden box ${move.box} at ${digits} digits`);
                    }
                    if (move.decoy === move.box || (move.decoy !== null && !active.includes(move.decoy))) {
                        expect.fail('bad decoy');
                    }
                    const result = resolvePlacement(value, move.box, boxes, 12);
                    if (result.gameOver) {
                        expect.fail('the demo must not overflow');
                    }
                    if (move.decoy !== null) {
                        hesitated += 1;
                    }
                    if (!getValidBoxes(value).includes(move.box)) {
                        missed += 1;
                    }
                    boxes = result.boxes;
                }
            }
        }
        expect(hesitated).toBeGreaterThan(0);
        expect(missed).toBeGreaterThan(0);
    });

    it('is deterministic for the same rng values', () => {
        const a = chooseDemoMove(1001, 4, createEmptyBoxes(), 12, seeded(9));
        const b = chooseDemoMove(1001, 4, createEmptyBoxes(), 12, seeded(9));
        expect(a).toEqual(b);
    });
});

describe('the demo game on the shared DemoDirector', () => {
    const run = (digits: number, seed: number, untilMs: number) => {
        const game = createTitleDemoGame(digits, seeded(seed));
        const director = new DemoDirector(game, TITLE_DEMO_OPTIONS, 0);
        const seen: Array<{ t: number; event: DemoEvent<TitleDemoDetail> }> = [];
        for (let t = 1; t <= untilMs; t += 1) {
            const event = director.tick(t);
            if (event) {
                seen.push({ t, event });
            }
        }
        return { director, seen };
    };

    it('acts 700 ms after the number appears, advances 700 ms later, 8 numbers, then fades out', () => {
        const { seen } = run(2, 3, 20000);
        const kinds = seen.map((s) => `${s.event.kind}@${s.t}`);
        expect(kinds.slice(0, 3)).toEqual(['action@700', 'advance@1400', 'action@2100']);
        const actions = seen.filter((s) => s.event.kind === 'action');
        expect(actions.length).toBeGreaterThanOrEqual(DEMO_ROUNDS);
        const fadeOut = seen.find((s) => s.event.kind === 'fade-out');
        // the 8th action is at 700 + 7 * 1400 = 10500; fade-out 700 ms later
        expect(actions[DEMO_ROUNDS - 1].t).toBe(10500);
        expect(fadeOut?.t).toBe(11200);
        expect(seen.filter((s) => s.event.kind === 'advance' && s.t < 11200)).toHaveLength(DEMO_ROUNDS - 1);
    });

    it('rebuilds with empty boxes at fade-in and acts 1100 ms after it', () => {
        const { seen, director } = run(3, 5, 14000);
        const fadeIn = seen.find((s) => s.event.kind === 'fade-in');
        expect(fadeIn?.t).toBe(11200 + DEMO_FADE_MS);
        const next = seen.find((s) => s.event.kind === 'action' && s.t > (fadeIn?.t ?? 0));
        expect(next?.t).toBe((fadeIn?.t ?? 0) + DEMO_FADE_MS + DEMO_WAIT_MS);
        expect(director.state.digitCount).toBe(3);
    });

    it('has empty boxes, a new number and no intent at the fade-in event', () => {
        const game = createTitleDemoGame(3, seeded(5));
        const director = new DemoDirector(game, TITLE_DEMO_OPTIONS, 0);
        let fadeInSeen = false;
        for (let t = 1; t <= 14000 && !fadeInSeen; t += 1) {
            const event = director.tick(t);
            if (event?.kind === 'fade-in') {
                fadeInSeen = true;
                expect(Object.values(director.state.boxes).every((digits) => digits.length === 0)).toBe(true);
                expect(director.state.intent).toBeNull();
                expect(director.state.queue.current).toBeGreaterThanOrEqual(100);
                expect(director.state.queue.current).toBeLessThanOrEqual(999);
            }
        }
        expect(fadeInSeen).toBe(true);
    });

    it('plays a correct number into P: its digits vanish and matching residual digits go one for one', () => {
        const game = createTitleDemoGame(2, seeded(1));
        const state = game.start();
        state.queue = { ...state.queue, current: 31 };
        state.boxes.P = [3, 1, 4];
        const result = game.play(state, { box: 'P', decoy: null });
        // 31 is prime: P is correct. 3 clears the newest 3, 1 clears the newest 1: [3, 1, 4] -> [4]
        expect(result.detail.isCorrect).toBe(true);
        expect(result.detail.clearedDigits).toEqual([3, 1]);
        expect(result.detail.boxes.P).toEqual([4]);
        expect(state.boxes.P).toEqual([4]);
        expect(result.roundDone).toBe(true);
    });

    it('plays a wrong number into x2: its digits stay in that box', () => {
        const game = createTitleDemoGame(2, seeded(1));
        const state = game.start();
        state.queue = { ...state.queue, current: 31 };
        const result = game.play(state, { box: 'x2', decoy: null });
        expect(result.detail.isCorrect).toBe(false);
        expect(result.detail.boxes.x2).toEqual([3, 1]);
        expect(result.detail.clearedDigits).toEqual([]);
    });

    it('makes the intent readable right after the first tick of a wait and clears it on the action', () => {
        const game = createTitleDemoGame(2, seeded(11));
        const director = new DemoDirector(game, TITLE_DEMO_OPTIONS, 0);
        expect(director.state.intent).toBeNull();
        director.tick(1);
        expect(director.state.intent).not.toBeNull();
        let event: DemoEvent<TitleDemoDetail> | null = null;
        for (let t = 2; t <= 700 && event === null; t += 1) {
            event = director.tick(t);
        }
        expect(event?.kind).toBe('action');
        expect(director.state.intent).toBeNull();
    });

    it('places with the game rules: the boxes after an action equal resolvePlacement of the shown number', () => {
        const game = createTitleDemoGame(2, seeded(21));
        const director = new DemoDirector(game, TITLE_DEMO_OPTIONS, 0);
        for (let round = 0; round < 6; round += 1) {
            const before = JSON.parse(JSON.stringify(director.state.boxes)) as Record<BoxKey, number[]>;
            const value = director.state.queue.current;
            let event: DemoEvent<TitleDemoDetail> | null = null;
            for (let t = round * 1400 + 1; t <= round * 1400 + 700 && event === null; t += 1) {
                event = director.tick(t);
            }
            if (event?.kind !== 'action') {
                expect.fail('no action');
            }
            const expected = resolvePlacement(value, event.detail.box, before, 12);
            expect(event.detail.boxes).toEqual(expected.boxes);
            expect(event.detail.isCorrect).toBe(expected.isCorrect);
            // advance
            for (let t = round * 1400 + 701; t <= round * 1400 + 1400; t += 1) {
                director.tick(t);
            }
        }
    });
});

describe('demoLayout', () => {
    it('540x960 with 2 digits: region 413..758, box row top 618, 5 boxes 108 wide, hint at 883', () => {
        const l = demoLayout(540, 960, 2);
        expect([l.regionTop, l.regionBottom, l.boxRowTop, l.hintY]).toEqual([413, 758, 618, 883]);
        expect(l.boxes.map((b) => b.key)).toEqual(['x2', 'x3', 'x5', 'x7', 'P']);
        expect(l.boxes.map((b) => b.left)).toEqual([0, 108, 216, 324, 432]);
        expect(l.boxes[1].centerX).toBe(162);
        expect(l.tileX).toBe(270);
        expect(l.tileTop).toBe(413);
    });

    it('3 and 4 digits: 6 boxes 90 wide, xN at 360 and P at 450 (centre 495)', () => {
        for (const digits of [3, 4]) {
            const l = demoLayout(540, 960, digits);
            expect(l.boxes.map((b) => b.key)).toEqual(['x2', 'x3', 'x5', 'x7', 'xN', 'P']);
            expect(l.boxes.map((b) => b.left)).toEqual([0, 90, 180, 270, 360, 450]);
            expect(l.boxes[5].centerX).toBe(495);
        }
    });
});

describe('tile timeline', () => {
    const base: DemoSchedule = {
        actAt: 700,
        hesitateAt: null,
        startX: 270,
        decoyX: null,
        targetX: 162,
        tileTop: 586,
        tileHeight: 40,
        landBottom: 674,
        box: 'x3',
        decoy: null
    };

    it('without hesitation: waits at the centre, slides 250 ms, drops 200 ms, lands at 1150', () => {
        expect(tileStateAt(699, base)).toMatchObject({ x: 270, top: 586, highlight: null, landed: false });
        expect(tileStateAt(700, base)).toMatchObject({ x: 270, highlight: 'x3' });
        expect(tileStateAt(825, base).x).toBe(216);
        expect(tileStateAt(950, base)).toMatchObject({ x: 162, top: 586 });
        // landed top = 674 - 40 = 634; halfway through the drop
        expect(tileStateAt(1050, base)).toMatchObject({ x: 162, top: 610, landed: false });
        expect(tileStateAt(1150, base)).toMatchObject({ x: 162, top: 634, highlight: null, landed: true });
    });

    it('with hesitation: 150 ms to the decoy from 200 ms, holds, then slides from the decoy at 700', () => {
        const s: DemoSchedule = { ...base, hesitateAt: 200, decoyX: 54, decoy: 'x2' };
        expect(tileStateAt(199, s)).toMatchObject({ x: 270, highlight: null });
        expect(tileStateAt(275, s)).toMatchObject({ x: 162, highlight: 'x2' });
        expect(tileStateAt(350, s)).toMatchObject({ x: 54, highlight: 'x2' });
        expect(tileStateAt(699, s)).toMatchObject({ x: 54, highlight: 'x2' });
        expect(tileStateAt(700, s)).toMatchObject({ x: 54, highlight: 'x3' });
        expect(tileStateAt(825, s).x).toBe(108);
        expect(tileStateAt(950, s).x).toBe(162);
        expect(tileStateAt(700 + DEMO_SLIDE_MS + DEMO_DROP_MS, s).landed).toBe(true);
    });
});

describe('hesitationStart', () => {
    it('starts 500 ms before the action when the move is known early enough', () => {
        expect(hesitationStart(700, 16, true)).toBe(200);
    });

    it('starts when the move became known if that is later than action - 500, and skips when too late', () => {
        expect(hesitationStart(700, 300, true)).toBe(300);
        expect(hesitationStart(700, 550, true)).toBe(550);
        expect(hesitationStart(700, 551, true)).toBeNull();
        expect(hesitationStart(700, 600, true)).toBeNull();
    });

    it('is null when the bot does not hesitate', () => {
        expect(hesitationStart(700, 16, false)).toBeNull();
    });
});

describe('SelectionFade', () => {
    it('from opacity 1: 0.5 at 200 ms, swap at 400 ms, 0.5 at 600 ms, 1 at 800 ms', () => {
        const fade = new SelectionFade();
        fade.change(3);
        expect(fade.update(200)).toBeNull();
        expect(fade.opacity).toBeCloseTo(0.5, 9);
        expect(fade.update(200)).toBe(3);
        expect(fade.opacity).toBe(0);
        expect(fade.update(200)).toBeNull();
        expect(fade.opacity).toBeCloseTo(0.5, 9);
        expect(fade.update(200)).toBeNull();
        expect(fade.opacity).toBe(1);
        expect(fade.active).toBe(false);
    });

    it('a change at opacity 0.5 reaches 0 after 200 ms, and only the last digit count swaps once', () => {
        const fade = new SelectionFade();
        fade.change(3);
        fade.update(200);
        fade.change(4);
        expect(fade.update(199)).toBeNull();
        expect(fade.update(1)).toBe(4);
        expect(fade.update(10_000)).toBeNull();
    });

    it('goes 2 -> 3 -> 2 as one swap to 2 digits', () => {
        const fade = new SelectionFade();
        fade.change(3);
        fade.change(2);
        expect(fade.update(400)).toBe(2);
        expect(fade.update(10_000)).toBeNull();
    });

    it('a change while fading in starts from the current opacity', () => {
        const fade = new SelectionFade();
        fade.change(3);
        fade.update(400); // swap, opacity 0
        fade.update(200); // 0.5
        fade.change(2);
        expect(fade.update(199)).toBeNull();
        expect(fade.update(1)).toBe(2);
    });

    it('starts from the opacity the demo has when it is idle (the end-of-run fade is running)', () => {
        const fade = new SelectionFade();
        fade.change(3, 0.3);
        expect(fade.opacity).toBeCloseTo(0.3, 9);
        expect(fade.update(119)).toBeNull();
        expect(fade.update(1)).toBe(3);
    });

    it('ignores the demo opacity while its own fade is running', () => {
        const fade = new SelectionFade();
        fade.change(3);
        fade.update(200);
        fade.change(4, 1);
        expect(fade.opacity).toBeCloseTo(0.5, 9);
    });

    it('swaps at once when the opacity is already 0', () => {
        const fade = new SelectionFade();
        fade.change(3);
        fade.update(400); // swapped, in with opacity 0
        fade.change(4);
        expect(fade.update(0)).toBe(4);
    });
});
