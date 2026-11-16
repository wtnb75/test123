import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { fitHud, portraitScale, portraitTextSizes } from './phoneText';

describe('portraitScale', () => {
    it('takes the smaller of width/768 and height/1664 (375x550 is height-bound)', () => {
        expect(portraitScale(375, 550)).toBeCloseTo(550 / 1664, 10); // 0.3305; width gives 0.4883
    });

    it('takes the height side for 390x844 (0.5072 by height vs 0.5078 by width)', () => {
        expect(portraitScale(390, 844)).toBeCloseTo(844 / 1664, 10);
    });

    it('takes the width side when it is the smaller one (300x1000: 0.3906 vs 0.6010)', () => {
        expect(portraitScale(300, 1000)).toBeCloseTo(300 / 768, 10);
        expect(portraitScale(768, 3000)).toBe(1);
    });

    it('falls back to 1 when the display has no size yet', () => {
        expect(portraitScale(0, 0)).toBe(1);
        expect(portraitScale(NaN, 100)).toBe(1);
    });
});

describe('portraitTextSizes', () => {
    it('375x550 gets a 43px HUD without the set number and keeps the 36px rows', () => {
        // ceil(14 / 0.3305) = ceil(42.36) = 43; rows: ceil(11 / 0.3305) = ceil(33.28) = 34 < 36
        expect(portraitTextSizes(550 / 1664)).toEqual({ hud: 43, row: 36, dropSet: true });
    });

    it('390x844 and 375x667 keep today\'s 36px and the set number', () => {
        expect(portraitTextSizes(portraitScale(390, 844))).toEqual({ hud: 36, row: 36, dropSet: false }); // ceil(27.6) = 28
        expect(portraitTextSizes(portraitScale(375, 667))).toEqual({ hud: 36, row: 36, dropSet: false }); // s = 0.4008
    });

    it('switches at s = 14/36: 0.3889 stays 36, 0.3888 becomes 37', () => {
        expect(portraitTextSizes(0.3889)).toMatchObject({ hud: 36, dropSet: false }); // 14 / 0.3889 = 35.9987
        expect(portraitTextSizes(0.3888)).toMatchObject({ hud: 37, dropSet: true }); // 14 / 0.3888 = 36.008
        expect(portraitTextSizes(14 / 36)).toMatchObject({ hud: 36, dropSet: false }); // exactly on the boundary: float noise must not tip it
    });

    it('float noise on an exact size does not round it up (14 / (14/55) = 55.00000000000001, 11 / (11/60) = 60.00000000000001)', () => {
        expect(portraitTextSizes(14 / 55).hud).toBe(55);
        expect(portraitTextSizes(11 / 60).row).toBe(60);
    });

    it('gives a 37px HUD without the set number at s = 0.38 (ceil(36.84))', () => {
        expect(portraitTextSizes(0.38)).toEqual({ hud: 37, row: 36, dropSet: true });
    });

    it('gives 70px HUD and 55px rows at s = 0.2', () => {
        expect(portraitTextSizes(0.2)).toEqual({ hud: 70, row: 55, dropSet: true }); // 14/0.2 = 70, 11/0.2 = 55
    });

    it('uses the base size from the parameters as the floor for both', () => {
        expect(portraitTextSizes(10)).toEqual({ hud: PARAMS.portraitRowTextSize, row: PARAMS.portraitRowTextSize, dropSet: false });
    });

    it('on-screen sizes reach the minimums whenever the HUD grows', () => {
        for (let s = 0.2; s <= 0.6; s += 0.005) {
            const t = portraitTextSizes(s);
            if (t.hud * s < PARAMS.hudRealMinPx - 1e-9) expect.fail(`HUD too small at s=${s}`);
            if (t.row * s < PARAMS.rowRealMinPx - 1e-9) expect.fail(`row too small at s=${s}`);
        }
    });
});

describe('fitHud', () => {
    const s = 0.5072; // 390x844; 36px HUD, floor = 14 / (36 * 0.5072) = 0.7667

    it('keeps the set number and does not shrink when the text fits', () => {
        expect(fitHud(400, 300, 500, 36, s, false)).toEqual({ dropSet: false, scale: 1 });
    });

    it('shrinks with the set number while the on-screen size stays at the minimum or above', () => {
        const fit = fitHud(600, 450, 500, 36, s, false); // 500 / 600 = 0.8333 >= 0.7667
        expect(fit.dropSet).toBe(false);
        expect(fit.scale).toBeCloseTo(500 / 600, 10);
    });

    it('keeps the set number when the shrink lands exactly on the on-screen minimum', () => {
        // 40px at s = 0.5: floor = 14 / 20 = 0.7; 700 / 1000 = 0.7
        expect(fitHud(1000, 800, 700, 40, 0.5, false)).toEqual({ dropSet: false, scale: 0.7 });
    });

    it('drops the set number when keeping it would shrink below the on-screen minimum', () => {
        const fit = fitHud(700, 450, 500, 36, s, false); // 500 / 700 = 0.714 < 0.7667
        expect(fit).toEqual({ dropSet: true, scale: 1 });
    });

    it('stops shrinking at the on-screen minimum even without the set number', () => {
        const fit = fitHud(900, 800, 500, 36, s, false); // 500 / 800 = 0.625 < 0.7667
        expect(fit.dropSet).toBe(true);
        expect(fit.scale).toBeCloseTo(14 / (36 * s), 10);
        expect(36 * fit.scale * s).toBeCloseTo(PARAMS.hudRealMinPx, 10);
    });

    it('leaves the set number out when forced, even if it would fit', () => {
        expect(fitHud(300, 250, 500, 43, 0.3305, true)).toEqual({ dropSet: true, scale: 1 });
    });

    it('stops at the 14 CSS px floor for a 43px HUD on 375x550', () => {
        const fit = fitHud(900, 600, 500, 43, 550 / 1664, true); // 500 / 600 = 0.8333 < floor 14 / (43 * 0.3305) = 0.9851
        expect(fit.scale).toBeCloseTo(14 / (43 * (550 / 1664)), 10);
    });

    it('never asks for more than 1 as the floor', () => {
        expect(fitHud(900, 800, 500, 10, 0.3, true).scale).toBe(1);
    });
});
