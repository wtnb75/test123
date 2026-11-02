import { describe, expect, it } from 'vitest';
import { boardRect, cellCenter, groupTop, hudLayout, resultLayout, titleLayout } from './layout';

describe('groupTop / boardRect (docs/spec.md "配置" 手計算)', () => {
    it.each([
        [528, 40, 136, 488],
        [520, 36, 132, 484],
        [779, 165, 261, 613],
        [800, 176, 272, 624],
    ])('H = %i: group top %i, board %i to %i', (h, top, boardTop, boardBottom) => {
        expect(groupTop(h)).toBe(top);
        const rect = boardRect(h);
        expect(rect.y).toBe(boardTop);
        expect(rect.y + rect.h).toBe(boardBottom);
        expect(rect.x).toBe(4);
        expect(rect.w).toBe(352);
    });

    it('never goes above the screen top when H is below the group height', () => {
        expect(groupTop(440)).toBe(0);
        expect(groupTop(448)).toBe(0);
        expect(groupTop(450)).toBe(1);
    });
});

describe('cellCenter', () => {
    it('is the middle of the cell: board left + col × 44 + 22', () => {
        const rect = boardRect(528);
        expect(cellCenter(rect, { r: 0, c: 0 })).toEqual({ x: 26, y: 158 });
        expect(cellCenter(rect, { r: 7, c: 7 })).toEqual({ x: 334, y: 466 });
    });

    it('allows rows above the board (refills fall in from there)', () => {
        expect(cellCenter(boardRect(528), { r: -1, c: 2 })).toEqual({ x: 114, y: 114 });
    });
});

describe('hudLayout', () => {
    it('places SCORE left, MOVES right and BEST in the middle relative to the group top', () => {
        const h = hudLayout(528); // group top 40
        expect(h).toEqual({ leftX: 16, rightX: 344, centerX: 180, labelY: 52, valueY: 82, bestY: 116 });
    });
});

describe('titleLayout (docs/spec.md "Title" 手計算)', () => {
    it('H = 528: block top 54, name 84, best 274, START centre 398', () => {
        const t = titleLayout(528);
        expect(t.blockTop).toBe(54);
        expect(t.nameY).toBe(84);
        expect(t.subY).toBe(124);
        expect(t.helpY).toEqual([174, 198, 222]);
        expect(t.bestY).toBe(274);
        expect(t.buttonY).toBe(398);
    });

    it('H = 779: block top 179, best 399, START centre 649', () => {
        const t = titleLayout(779);
        expect(t.blockTop).toBe(179);
        expect(t.bestY).toBe(399);
        expect(t.buttonY).toBe(649);
    });

    it('keeps at least 16 from the top on a very short screen', () => {
        expect(titleLayout(300).blockTop).toBe(16);
    });
});

describe('resultLayout (docs/spec.md "Result" 手計算)', () => {
    it('H = 528: block top 104, buttons at y 458 and x 94 / 266', () => {
        const r = resultLayout(528);
        expect(r.blockTop).toBe(104);
        expect(r.titleY).toBe(128);
        expect(r.scoreLabelY).toBe(176);
        expect(r.scoreY).toBe(216);
        expect(r.bestY).toBe(274);
        expect(r.buttonY).toBe(458);
        expect(r.leftButtonX).toBe(94);
        expect(r.rightButtonX).toBe(266);
    });

    it('keeps at least 16 from the top on a very short screen', () => {
        expect(resultLayout(300).blockTop).toBe(16);
    });

    it('fits the two buttons inside the width: 2 × 156 + 16 = 328 <= 360', () => {
        const r = resultLayout(600);
        expect(r.rightButtonX - r.leftButtonX).toBe(172);
        expect(r.leftButtonX - 78).toBeGreaterThanOrEqual(0);
        expect(r.rightButtonX + 78).toBeLessThanOrEqual(360);
    });
});
