import { describe, expect, it } from 'vitest';
import { resultLayout, titleLayout } from './layout';

describe('titleLayout', () => {
    it('lays out the smallest height (240) as worked by hand in the spec', () => {
        const l = titleLayout(240, 3);
        expect(l.nameY).toBe(43);
        expect(l.helpY).toEqual([87, 109, 131]);
        expect(l.bestY).toBe(157);
        expect(l.buttonY).toBe(196);
    });

    it('keeps the BEST line (bottom 165) above the START button (top 170) at height 240', () => {
        const l = titleLayout(240, 3);
        expect(l.bestY + 8).toBeLessThan(l.buttonY - 26);
    });

    it('centres the name-to-BEST block between the top and the START button, never above y 43', () => {
        // (H - 70 - 114) / 2, hand-worked: 321 -> 68.5 -> 69, 528 -> 172, 779 -> 297.5 -> 298; 240 -> 28 -> 43.
        expect(titleLayout(240, 3).nameY).toBe(43);
        expect(titleLayout(321, 3).nameY).toBe(69);
        expect(titleLayout(528, 3).nameY).toBe(172);
        expect(titleLayout(779, 3).nameY).toBe(298);
    });

    it('puts BEST 114 below the name (412 at height 779) and keeps START in the lower third', () => {
        expect(titleLayout(779, 3).bestY).toBe(412);
        for (const h of [321, 528, 779]) {
            expect(titleLayout(h, 3).buttonY - 26).toBeGreaterThanOrEqual((h * 2) / 3);
        }
    });

    it('never lets BEST reach the START button: a gap of exactly 5 at height 240 and at least 8 from 243', () => {
        const gap = (h: number) => {
            const l = titleLayout(h, 3);
            return l.buttonY - 26 - (l.bestY + 8);
        };
        expect(gap(240)).toBe(5);
        for (let h = 243; h <= 800; h++) expect(gap(h)).toBeGreaterThanOrEqual(8);
    });

    it('puts BEST right under the name when there are no help lines', () => {
        const l = titleLayout(300, 0);
        expect(l.helpY).toEqual([]);
        expect(l.bestY).toBe(l.nameY + 26);
    });
});

describe('resultLayout', () => {
    it('uses the fixed rows from the spec and anchors the buttons to the bottom', () => {
        const l = resultLayout(240);
        expect([l.titleY, l.scoreY, l.wordsY, l.bestY, l.newBestY]).toEqual([34, 72, 104, 128, 152]);
        expect(l.buttonY).toBe(196);
    });

    it('keeps NEW BEST (bottom 160) above the buttons (top 170) at height 240', () => {
        const l = resultLayout(240);
        expect(l.newBestY + 8).toBeLessThan(l.buttonY - 26);
    });

    it('puts the two buttons side by side with a 16 gap, both inside the 360 width', () => {
        const l = resultLayout(528);
        expect(l.retryX).toBe(94);
        expect(l.titleButtonX).toBe(266);
        expect(l.titleButtonX - l.retryX - 156).toBe(16);
        expect(l.retryX - 78).toBeGreaterThanOrEqual(0);
        expect(l.titleButtonX + 78).toBeLessThanOrEqual(360);
    });
});
