import { BestStore } from 'best-store';
import { describe, expect, it } from 'vitest';
import { GAME_ID, POP_CLAMP_X, POP_CLAMP_Y, POP_RISE } from '../params';
import {
    bestLabel,
    centerOf,
    clampPopup,
    countUpValue,
    formatBest,
    hudBest,
    isNewBest,
    movesWarning,
    popupLines,
    popupScale,
    scoreFor,
} from './score';

describe('scoreFor (docs/spec.md "スコア")', () => {
    it('reproduces the examples of the spec', () => {
        expect(scoreFor(3, 1, 10, 20)).toBe(30);
        expect(scoreFor(4, 1, 10, 20)).toBe(60);
        expect(scoreFor(5, 1, 10, 20)).toBe(90);
        expect(scoreFor(3, 2, 10, 20)).toBe(60);
        expect(scoreFor(5, 3, 10, 20)).toBe(270); // (50 + 40) × 3
        expect(scoreFor(6, 1, 10, 20)).toBe(120); // two separate runs of 3 at once
    });

    it('adds no bonus for fewer than 4 stones, and nothing for 0', () => {
        expect(scoreFor(0, 1, 10, 20)).toBe(0);
        expect(scoreFor(3, 1, 10, 0)).toBe(30);
        expect(scoreFor(2, 1, 10, 20)).toBe(20); // the bonus never goes negative
    });

    it('scales with the chain step without a limit', () => {
        expect(scoreFor(3, 10, 10, 20)).toBe(300);
    });
});

describe('popupLines (docs/spec.md "得点のポップアップ")', () => {
    it('shows only the points for a plain clear', () => {
        expect(popupLines(3, 1, 30)).toEqual(['+30']);
    });

    it('adds BONUS for 4 or more stones', () => {
        expect(popupLines(4, 1, 60)).toEqual(['BONUS', '+60']);
        expect(popupLines(3, 1, 30)).not.toContain('BONUS');
    });

    it('adds CHAIN xn from the second step', () => {
        expect(popupLines(3, 2, 60)).toEqual(['CHAIN x2', '+60']);
        expect(popupLines(3, 1, 30)).not.toContain('CHAIN x1');
    });

    it('shows all three lines in order for a bonus on a chain', () => {
        expect(popupLines(5, 3, 270)).toEqual(['CHAIN x3', 'BONUS', '+270']);
    });
});

describe('clampPopup', () => {
    const top = 136;
    const bottom = 488;

    it('keeps x between the side margins', () => {
        expect(clampPopup(10, 300, top, bottom).x).toBe(POP_CLAMP_X);
        expect(clampPopup(350, 300, top, bottom).x).toBe(360 - POP_CLAMP_X);
        expect(clampPopup(180, 300, top, bottom).x).toBe(180);
    });

    it('keeps the start y so low that the end of the rise stays inside the board', () => {
        const lowest = top + POP_CLAMP_Y + POP_RISE;
        expect(lowest).toBe(top + 110);
        expect(clampPopup(180, top + 10, top, bottom).y).toBe(top + 110);
        expect(clampPopup(180, lowest, top, bottom).y).toBe(lowest);
        expect(clampPopup(180, bottom - 10, top, bottom).y).toBe(bottom - POP_CLAMP_Y);
    });
});

describe('popupScale (docs/spec.md "得点のポップアップ": bigger from chain 3, capped at 1.5)', () => {
    it('is 1.0 for chain 1 and 2', () => {
        expect(popupScale(1)).toBe(1);
        expect(popupScale(2)).toBe(1);
    });

    it('grows by 0.15 per chain step from chain 3: 1.15, 1.30, 1.45', () => {
        expect(popupScale(3)).toBeCloseTo(1.15, 10);
        expect(popupScale(4)).toBeCloseTo(1.3, 10);
        expect(popupScale(5)).toBeCloseTo(1.45, 10);
    });

    it('stops at 1.5 from chain 6 on (the next step 1.6 is capped)', () => {
        expect(popupScale(6)).toBe(1.5);
        expect(popupScale(10)).toBe(1.5);
    });

    it('never goes below 1.0, whatever the input', () => {
        expect(popupScale(0)).toBe(1);
    });
});

describe('movesWarning (docs/spec.md "MOVES の警告": red at 5 or fewer)', () => {
    it('is off above MOVES_WARN and on from exactly MOVES_WARN', () => {
        expect(movesWarning(30)).toBe(false);
        expect(movesWarning(6)).toBe(false);
        expect(movesWarning(5)).toBe(true);
        expect(movesWarning(1)).toBe(true);
        expect(movesWarning(0)).toBe(true);
    });
});

describe('clampPopup with a size factor', () => {
    it('widens the margins with the factor: at 1.5, x in [90, 270] and y from top + 130 to bottom − 60', () => {
        expect(clampPopup(10, 300, 136, 488, 1.5).x).toBe(90);
        expect(clampPopup(350, 300, 136, 488, 1.5).x).toBe(270);
        expect(clampPopup(180, 140, 136, 488, 1.5).y).toBe(136 + 130);
        expect(clampPopup(180, 480, 136, 488, 1.5).y).toBe(488 - 60);
    });

    it('returns a point that is already inside the margins as it is (the margins are not wider than needed)', () => {
        expect(clampPopup(180, 300, 136, 488, 1.5)).toEqual({ x: 180, y: 300 });
        expect(clampPopup(90, 266, 136, 488, 1.5)).toEqual({ x: 90, y: 266 }); // exactly on the limits
    });

    it('is unchanged for the default factor 1.0', () => {
        expect(clampPopup(10, 140, 136, 488)).toEqual(clampPopup(10, 140, 136, 488, 1));
        expect(clampPopup(10, 140, 136, 488).x).toBe(60);
    });
});

describe('centerOf', () => {
    it('is the mean of the coordinates', () => {
        expect(centerOf([{ x: 0, y: 0 }, { x: 10, y: 20 }])).toEqual({ x: 5, y: 10 });
        expect(centerOf([{ x: 4, y: 6 }])).toEqual({ x: 4, y: 6 });
    });
});

describe('countUpValue (docs/spec.md "Result": 600 ms count-up)', () => {
    it('counts linearly: 350 points at 0 / 300 / 600 / 900 ms', () => {
        expect(countUpValue(0, 350)).toBe(0);
        expect(countUpValue(300, 350)).toBe(175);
        expect(countUpValue(600, 350)).toBe(350);
        expect(countUpValue(900, 350)).toBe(350);
    });

    it('stays 0 for a score of 0 and before the start', () => {
        expect(countUpValue(300, 0)).toBe(0);
        expect(countUpValue(-5, 350)).toBe(0);
    });
});

describe('isNewBest (docs/spec.md "Result": new-record rule)', () => {
    it('is true for a score of 1 or more when there is no record', () => {
        expect(isNewBest(null, 1)).toBe(true);
        expect(isNewBest(null, 1230)).toBe(true);
    });

    it('is false for a score of 0 even with no record', () => {
        expect(isNewBest(null, 0)).toBe(false);
    });

    it('needs to beat the saved best strictly: a tie is not a new best', () => {
        expect(isNewBest(500, 501)).toBe(true);
        expect(isNewBest(500, 500)).toBe(false);
        expect(isNewBest(500, 499)).toBe(false);
    });
});

describe('best text and saving (docs/spec.md "自己ベスト")', () => {
    it('labels a best like 1230点', () => {
        expect(bestLabel(1230)).toBe('1230点');
    });

    it('shows BEST --- with no record and BEST n with one', () => {
        expect(formatBest(null)).toBe('BEST ---');
        expect(formatBest({ score: 1230, label: '1230点' })).toBe('BEST 1230');
    });

    it('shows on the Game HUD the higher of the saved best and the current score', () => {
        expect(hudBest(null, 0)).toBe('BEST ---');
        expect(hudBest(null, 40)).toBe('BEST 40');
        expect(hudBest({ score: 500, label: '500点' }, 120)).toBe('BEST 500');
        expect(hudBest({ score: 500, label: '500点' }, 500)).toBe('BEST 500');
        expect(hudBest({ score: 500, label: '500点' }, 510)).toBe('BEST 510');
    });

    it('is saved under the key match3.best as { score, label }', () => {
        const data = new Map<string, string>();
        const store = new BestStore(GAME_ID, () => ({
            getItem: (k) => data.get(k) ?? null,
            setItem: (k, v) => void data.set(k, v),
        }));
        store.record(1230, bestLabel(1230));
        expect(JSON.parse(data.get('match3.best') as string)).toEqual({ score: 1230, label: '1230点', date: expect.any(String) });
        expect(store.load()).toEqual({ score: 1230, label: '1230点', date: expect.any(String) });
    });
});
