/** Points per digit cleared as collateral (docs/spec.md "パラメータ表" `collateralPoint`). */
export const COLLATERAL_POINT = 1;

/** Upper bound of the streak bonus (docs/spec.md `streakCap`). */
export const STREAK_CAP = 5;

/** The running score: three subtotals plus the current run of correct drops. */
export interface ScoreTally {
    placed: number;
    collateral: number;
    streakBonus: number;
    streak: number;
}

export const createScoreTally = (): ScoreTally => ({
    placed: 0,
    collateral: 0,
    streakBonus: 0,
    streak: 0
});

/** The streak bonus for the n-th consecutive correct drop: 0 for n < 2, else min(n - 1, cap). */
export const streakBonusFor = (streak: number, cap: number = STREAK_CAP): number => {
    if (streak < 2) {
        return 0;
    }

    return Math.min(streak - 1, cap);
};

/**
 * Applies one finished drop. Every drop counts +1 as placed; only a correct drop adds the collateral
 * and streak bonus. A miss or time-out (including the game-ending drop) resets the streak.
 */
export const applyDrop = (tally: ScoreTally, isCorrect: boolean, clearedDigitCount: number): ScoreTally => {
    if (!isCorrect) {
        return { ...tally, placed: tally.placed + 1, streak: 0 };
    }

    const streak = tally.streak + 1;

    return {
        placed: tally.placed + 1,
        collateral: tally.collateral + clearedDigitCount * COLLATERAL_POINT,
        streakBonus: tally.streakBonus + streakBonusFor(streak),
        streak
    };
};

export const totalScore = (tally: ScoreTally): number => tally.placed + tally.collateral + tally.streakBonus;

/** The Result breakdown: three lines whose numbers add up to the total score. */
export const breakdownText = (placed: number, collateral: number, streakBonus: number): string =>
    `PLACED +${placed}\nCOLLATERAL +${collateral}\nSTREAK +${streakBonus}`;

/** The COMBO label: shown only while the streak is 2 or more. */
export const comboLabel = (streak: number): string => (streak >= 2 ? `COMBO ×${streak}` : '');
