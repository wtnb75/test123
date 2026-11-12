import { describe, expect, it } from 'vitest';
import { createEmptyBoxes, resolvePlacement, resolveTimeout, type PlacementResult } from './primtris';
import {
    COLLATERAL_POINT,
    STREAK_CAP,
    applyDrop,
    breakdownText,
    comboLabel,
    createScoreTally,
    streakBonusFor,
    totalScore,
    type ScoreTally
} from './scoring';
import { waitMs } from './timer';

/** Feeds a drop result (as the Scene does) into the tally. */
const feed = (tally: ScoreTally, result: PlacementResult): ScoreTally =>
    applyDrop(tally, result.isCorrect, result.clearedDigits.length);

describe('score parameters', () => {
    it('start at the spec initial values (collateralPoint 1, streakCap 5)', () => {
        expect(COLLATERAL_POINT).toBe(1);
        expect(STREAK_CAP).toBe(5);
    });
});

describe('streakBonusFor', () => {
    it.each([
        [0, 0],
        [1, 0],
        [2, 1],
        [3, 2],
        [5, 4],
        [6, 5],
        [7, 5],
        [20, 5]
    ])('gives the %i-th consecutive correct drop a bonus of %i', (streak, bonus) => {
        expect(streakBonusFor(streak)).toBe(bonus);
    });

    it('follows a different cap when one is given', () => {
        expect(streakBonusFor(4, 2)).toBe(2);
        expect(streakBonusFor(2, 2)).toBe(1);
    });
});

describe('applyDrop', () => {
    it('starts from an all-zero tally', () => {
        expect(createScoreTally()).toEqual({ placed: 0, collateral: 0, streakBonus: 0, streak: 0 });
        expect(totalScore(createScoreTally())).toBe(0);
    });

    it('gives a first correct drop with no collateral only the placed point', () => {
        const tally = applyDrop(createScoreTally(), true, 0);

        expect(tally).toEqual({ placed: 1, collateral: 0, streakBonus: 0, streak: 1 });
        expect(totalScore(tally)).toBe(1);
    });

    it('adds placed 1, collateral 1 and streak 2 for the 3rd correct drop that clears one digit (spec example, total 4)', () => {
        const before: ScoreTally = { placed: 2, collateral: 0, streakBonus: 1, streak: 2 };
        const after = applyDrop(before, true, 1);

        expect(after.placed - before.placed).toBe(1);
        expect(after.collateral - before.collateral).toBe(1);
        expect(after.streakBonus - before.streakBonus).toBe(2);
        expect(totalScore(after) - totalScore(before)).toBe(4);
        expect(after.streak).toBe(3);
    });

    it('counts a miss as placed 1 only and resets the streak', () => {
        const before: ScoreTally = { placed: 5, collateral: 3, streakBonus: 6, streak: 4 };
        const after = applyDrop(before, false, 0);

        expect(after).toEqual({ placed: 6, collateral: 3, streakBonus: 6, streak: 0 });
    });

    it('ignores cleared digits on a miss', () => {
        const after = applyDrop({ ...createScoreTally(), streak: 3 }, false, 2);

        expect(after.collateral).toBe(0);
    });

    it('scores the streak sequence correct, correct, miss, correct as bonuses 0, +1, 0, 0', () => {
        const bonuses: number[] = [];
        let tally = createScoreTally();

        for (const correct of [true, true, false, true]) {
            const next = applyDrop(tally, correct, 0);
            bonuses.push(next.streakBonus - tally.streakBonus);
            tally = next;
        }

        expect(bonuses).toEqual([0, 1, 0, 0]);
        expect(tally.streak).toBe(1);
    });

    it('does not mutate the tally it is given', () => {
        const before = createScoreTally();
        applyDrop(before, true, 2);

        expect(before).toEqual({ placed: 0, collateral: 0, streakBonus: 0, streak: 0 });
    });

    it('adds up to 1+2+...: 7 correct drops give streak bonuses 1+2+3+4+5+5 = 20', () => {
        let tally = createScoreTally();
        for (let i = 0; i < 7; i += 1) {
            tally = applyDrop(tally, true, 0);
        }

        expect(tally.streakBonus).toBe(20);
        expect(tally.placed).toBe(7);
        expect(totalScore(tally)).toBe(27);
    });

    it('multiplies cleared digits by the collateral point', () => {
        const after = applyDrop(createScoreTally(), true, 3);

        expect(after.collateral).toBe(3);
    });

    it('keeps the placed count, and so the next wait, the same whatever the bonuses are', () => {
        let plain = createScoreTally();
        let rich = createScoreTally();
        for (let i = 0; i < 22; i += 1) {
            plain = applyDrop(plain, true, 0);
            rich = applyDrop(rich, true, 2);
        }

        expect(rich.placed).toBe(plain.placed);
        expect(totalScore(rich)).toBeGreaterThan(totalScore(plain));
        expect(waitMs(rich.placed)).toBe(waitMs(plain.placed));
        expect(waitMs(plain.placed)).toBe(2500);
    });
});

describe('scoring with real placement results', () => {
    it('gives 12 into x3 holding [1,4] collateral 1 (the 1 is cleared)', () => {
        const boxes = createEmptyBoxes();
        boxes.x3 = [1, 4];
        const tally = feed(createScoreTally(), resolvePlacement(12, 'x3', boxes, 9));

        expect(tally.collateral).toBe(1);
        expect(totalScore(tally)).toBe(2);
    });

    it('gives 12 into x3 holding [1,1,4] collateral 1 (one for one)', () => {
        const boxes = createEmptyBoxes();
        boxes.x3 = [1, 1, 4];
        const tally = feed(createScoreTally(), resolvePlacement(12, 'x3', boxes, 9));

        expect(tally.collateral).toBe(1);
    });

    it('gives 11 into P holding [1,1,4] collateral 2', () => {
        const boxes = createEmptyBoxes();
        boxes.P = [1, 1, 4];
        const tally = feed(createScoreTally(), resolvePlacement(11, 'P', boxes, 9));

        expect(tally.collateral).toBe(2);
    });

    it('gives a correct drop with no matching digit no collateral', () => {
        const boxes = createEmptyBoxes();
        boxes.x3 = [4, 4];
        const tally = feed(createScoreTally(), resolvePlacement(12, 'x3', boxes, 9));

        expect(tally.collateral).toBe(0);
        expect(tally.streak).toBe(1);
    });

    it('treats a time-out into a correct box as a miss: placed only, streak reset', () => {
        const boxes = createEmptyBoxes();
        boxes.x3 = [1, 4];
        const start: ScoreTally = { placed: 3, collateral: 0, streakBonus: 3, streak: 3 };
        const tally = feed(start, resolveTimeout(12, 'x3', boxes, 9));

        expect(tally).toEqual({ placed: 4, collateral: 0, streakBonus: 3, streak: 0 });
    });

    it('gives the game-ending drop only the placed point', () => {
        const boxes = createEmptyBoxes();
        boxes.x3 = [1, 1, 1, 1, 1, 1, 1, 1];
        const result = resolvePlacement(14, 'x3', boxes, 9);
        const start: ScoreTally = { placed: 10, collateral: 4, streakBonus: 6, streak: 4 };
        const tally = feed(start, result);

        expect(result.gameOver).toBe(true);
        expect(tally).toEqual({ placed: 11, collateral: 4, streakBonus: 6, streak: 0 });
    });
});

describe('totalScore against an independent run-length oracle', () => {
    /** Seeded LCG so the sequences are reproducible. */
    const makeRng = (seed: number) => {
        let state = seed;

        return () => {
            state = (state * 1664525 + 1013904223) % 4294967296;

            return state / 4294967296;
        };
    };

    it('equals placed + cleared digits + capped run bonuses for random event lists', () => {
        const rng = makeRng(20241);
        let sawRunBeyondCap = 0;
        let sawMissInsideRun = 0;

        for (let trial = 0; trial < 300; trial += 1) {
            const events = Array.from({ length: 1 + Math.floor(rng() * 40) }, () => ({
                correct: rng() < 0.75,
                cleared: Math.floor(rng() * 4)
            }));

            let tally = createScoreTally();
            for (const event of events) {
                tally = applyDrop(tally, event.correct, event.cleared);
            }

            // Oracle: split into runs of correct drops; a run of length L pays 1+2+..+(L-1), each term capped at 5.
            let expected = events.length;
            let run = 0;
            for (const event of events) {
                if (event.correct) {
                    expected += event.cleared;
                    run += 1;
                    if (run >= 2) {
                        expected += Math.min(run - 1, 5);
                    }
                    if (run > 6) {
                        sawRunBeyondCap += 1;
                    }
                } else {
                    if (run >= 2) {
                        sawMissInsideRun += 1;
                    }
                    run = 0;
                }
            }

            if (totalScore(tally) !== expected) {
                expect.fail(`trial ${trial}: expected ${expected}, got ${totalScore(tally)} for ${JSON.stringify(events)}`);
            }
        }

        expect(sawRunBeyondCap).toBeGreaterThan(0);
        expect(sawMissInsideRun).toBeGreaterThan(0);
    });
});

describe('display strings', () => {
    it('shows no COMBO for a streak of 0 or 1', () => {
        expect(comboLabel(0)).toBe('');
        expect(comboLabel(1)).toBe('');
    });

    it('shows COMBO ×n from a streak of 2', () => {
        expect(comboLabel(2)).toBe('COMBO ×2');
        expect(comboLabel(12)).toBe('COMBO ×12');
    });

    it('writes the Result breakdown in three lines whose numbers add up to the total', () => {
        const tally: ScoreTally = { placed: 120, collateral: 31, streakBonus: 45, streak: 0 };

        expect(breakdownText(tally.placed, tally.collateral, tally.streakBonus)).toBe(
            'PLACED +120\nCOLLATERAL +31\nSTREAK +45'
        );
        expect(totalScore(tally)).toBe(196);
    });

    it('does not print the old COLLATERAL CLEAR label', () => {
        expect(breakdownText(1, 2, 3)).not.toContain('COLLATERAL CLEAR');
    });
});
