import { describe, expect, it } from 'vitest';
import { pickLayout, portraitLayout } from './layout';
import { computeTitleLayout } from './titleLayout';

describe('computeTitleLayout', () => {
    // Hand-worked from docs/spec/title-demo.md: landscape 150 / 255 / 470 / 620 (28 px), portrait 230 / 360 / 720 /
    // 900 (26 px) plus dy = round((viewH - 1024) / 2).
    const cases: { win: [number, number]; view: [number, number]; ys: number[]; size: number; dy: number }[] = [
        { win: [375, 550], view: [768, 1126], ys: [281, 411, 771, 951], size: 26, dy: 51 },
        { win: [667, 310], view: [1024, 768], ys: [150, 255, 470, 620], size: 28, dy: 0 },
        { win: [390, 844], view: [768, 1662], ys: [549, 679, 1039, 1219], size: 26, dy: 319 },
        { win: [1280, 720], view: [1024, 768], ys: [150, 255, 470, 620], size: 28, dy: 0 },
        { win: [1000, 1001], view: [768, 1024], ys: [230, 360, 720, 900], size: 26, dy: 0 },
        { win: [1000, 1000], view: [1024, 768], ys: [150, 255, 470, 620], size: 28, dy: 0 },
    ];

    it.each(cases)('places the Title for a $win window', ({ win, view, ys, size }) => {
        const layout = pickLayout(win[0], win[1]);
        expect([layout.viewW, layout.viewH]).toEqual(view);
        const t = computeTitleLayout(layout);
        expect([t.nameY, t.taglineY, t.infoY, t.buttonY]).toEqual(ys);
        expect(t.infoSize).toBe(size);
        expect(t.portrait).toBe(view[1] > view[0]);
    });

    it('moves the portrait group down by half of the extra height: 1792 -> 384, 1025 -> 1 (half rounds up)', () => {
        const tall = computeTitleLayout(portraitLayout(1792));
        expect([tall.nameY, tall.taglineY, tall.infoY, tall.buttonY]).toEqual([614, 744, 1104, 1284]);
        const slightly = computeTitleLayout(portraitLayout(1025));
        expect([slightly.nameY, slightly.buttonY]).toEqual([231, 901]);
    });

    it('keeps the elements on the canvas and apart for every view height', () => {
        const layouts = [pickLayout(1024, 768), ...[1024, 1126, 1400, 1662, 1792].map((h) => portraitLayout(h))];
        for (const layout of layouts) {
            const t = computeTitleLayout(layout);
            const nameBottom = t.nameY + 48;
            const taglineTop = t.taglineY - 17;
            const taglineBottom = t.taglineY + 17;
            const infoTop = t.infoY - 65; // three lines of 26-28 px with 10 px between, about 130 px
            const infoBottom = t.infoY + 65;
            const buttonTop = t.buttonY - 45;
            const buttonBottom = t.buttonY + 45;
            if (nameBottom >= taglineTop || taglineBottom >= infoTop || infoBottom >= buttonTop || buttonBottom > layout.viewH) {
                expect.fail(`overlap or overflow at ${layout.viewW} x ${layout.viewH}`);
            }
        }
    });
});
