import { describe, expect, it } from 'vitest';
import {
    chainBarFraction, chainBonus, chainColor, chainLabel, chainLayout, chainVisible, nextChainLevel
} from './chain';
import {
    CHAIN_BAR_H, CHAIN_BAR_TOP, CHAIN_BOSS_OFFSET_Y, CHAIN_MAX_BONUS, CHAIN_TEXT_TOP, CHAIN_WINDOW
} from './constants';
import { releaseScore } from './scoring';

describe('nextChainLevel (docs/spec/chain.md: level decision)', () => {
    it('starts at 1 with no chain running, whatever the time since the last kill', () => {
        expect(nextChainLevel(0, 0)).toBe(1);
        expect(nextChainLevel(0, Infinity)).toBe(1);
    });

    it('goes one above the running level when the last kill is inside the window', () => {
        expect(nextChainLevel(1, 0)).toBe(2);
        expect(nextChainLevel(3, 4.9)).toBe(4);
    });

    it('still continues at exactly 5.0 s, but not just after it', () => {
        expect(CHAIN_WINDOW).toBe(5);
        expect(nextChainLevel(2, 5)).toBe(3);
        expect(nextChainLevel(2, 5 + 1e-6)).toBe(1);
        expect(nextChainLevel(2, 5.01)).toBe(1);
    });

    it('tolerates the float error of a clock summed from frame steps at the 5 s boundary', () => {
        let t = 0;
        for (let i = 0; i < 300; i++) t += 1 / 60;
        expect(nextChainLevel(2, t)).toBe(3);
    });

    it('starts over at 1 when there was no kill yet (Infinity since the last one)', () => {
        expect(nextChainLevel(4, Infinity)).toBe(1);
    });
});

describe('chainBonus', () => {
    it('adds nothing at level 1 (and for a level below it)', () => {
        expect(chainBonus(1)).toBe(0);
        expect(chainBonus(0)).toBe(0);
    });

    it('adds 1.0 per level above the first, up to level 5 (+4.0)', () => {
        expect(chainBonus(2)).toBe(1);
        expect(chainBonus(3)).toBe(2);
        expect(chainBonus(5)).toBe(4);
        expect(CHAIN_MAX_BONUS).toBe(4);
    });

    it('stays at +4.0 beyond level 5', () => {
        expect(chainBonus(6)).toBe(4);
        expect(chainBonus(7)).toBe(4);
        expect(chainBonus(50)).toBe(4);
    });
});

describe('releaseScore with a chain level', () => {
    it('is unchanged at level 1 (same as before the chain existed)', () => {
        expect(releaseScore([100])).toBe(100);
        expect(releaseScore([100], 1)).toBe(100);
        expect(releaseScore([100, 100])).toBe(300);
        expect(releaseScore([100, 100, 100], 1)).toBe(600);
    });

    it('multiplies a single kill by 1 + the chain bonus: level 2 = ×2.0, level 5 = ×5.0', () => {
        expect(releaseScore([100], 2)).toBe(200);
        expect(releaseScore([100], 5)).toBe(500);
    });

    it('caps the chain at level 5: levels 6 and 7 are still ×5.0', () => {
        expect(releaseScore([100], 6)).toBe(500);
        expect(releaseScore([100], 7)).toBe(500);
    });

    it('adds the multi-kill and chain bonuses: level 3 with 2 kills = ×3.5, level 5 with 4 kills = ×6.5', () => {
        expect(releaseScore([100, 200], 3)).toBe(1050); // 300 × (1 + 0.5 + 2.0)
        expect(releaseScore([100, 100, 100, 100], 5)).toBe(2600); // 400 × (1 + 1.5 + 4.0)
    });

    it('rounds down after multiplying', () => {
        expect(releaseScore([150], 2)).toBe(300);
        expect(releaseScore([60, 41], 1)).toBe(151); // 101 × 1.5 = 151.5
        expect(releaseScore([150, 100], 3)).toBe(875); // 250 × 3.5
        expect(releaseScore([33], 4)).toBe(132);
        expect(releaseScore([101], 2)).toBe(202);
        expect(releaseScore([7, 8], 2)).toBe(37); // 15 × 2.5 = 37.5
    });

    it('scores nothing without kills, at any level', () => {
        expect(releaseScore([], 5)).toBe(0);
    });
});

describe('chain display', () => {
    it('is hidden at level 0 and 1, shown from level 2', () => {
        expect(chainVisible(0, 0)).toBe(false);
        expect(chainVisible(1, 0)).toBe(false);
        expect(chainVisible(2, 0)).toBe(true);
    });

    it('shows until just before 5.0 s and is gone at exactly 5.0 s', () => {
        expect(chainVisible(3, 4.99)).toBe(true);
        expect(chainVisible(3, 5)).toBe(false);
        expect(chainVisible(3, Infinity)).toBe(false);
    });

    it('writes the level after CHAIN ×, also with two digits', () => {
        expect(chainLabel(2)).toBe('CHAIN ×2');
        expect(chainLabel(12)).toBe('CHAIN ×12');
    });

    it('is white at level 2, yellow at 3 and 4, orange from 5', () => {
        expect(chainColor(2)).toBe(0xffffff);
        expect(chainColor(3)).toBe(0xffd54f);
        expect(chainColor(4)).toBe(0xffd54f);
        expect(chainColor(5)).toBe(0xffa726);
        expect(chainColor(9)).toBe(0xffa726);
    });

    it('fills the bar by the window left: full at 0 s, half at 2.5 s, empty at 5 s (and never outside 0..1)', () => {
        expect(chainBarFraction(0)).toBe(1);
        expect(chainBarFraction(2.5)).toBe(0.5);
        expect(chainBarFraction(5)).toBe(0);
        expect(chainBarFraction(7)).toBe(0);
        expect(chainBarFraction(-1)).toBe(1);
    });

    it('sits at y 52 (text) and 80 (bar, 4 px high), 24 px lower while a boss is out', () => {
        expect(chainLayout(false)).toEqual({ textTop: 52, barTop: 80, barHeight: 4 });
        expect(chainLayout(true)).toEqual({ textTop: 52 + 24, barTop: 80 + 24, barHeight: 4 });
        expect(CHAIN_TEXT_TOP).toBe(52);
        expect(CHAIN_BAR_TOP).toBe(80);
        expect(CHAIN_BAR_H).toBe(4);
        expect(CHAIN_BOSS_OFFSET_Y).toBe(24);
    });
});
