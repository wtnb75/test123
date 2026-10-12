import { describe, expect, it } from 'vitest';
import { TITLE_HINT_SIZE, TITLE_NAME_SIZE, TITLE_START_HEIGHT, TITLE_START_WIDTH, TITLE_TAGLINE_SIZE } from './constants';
import { computeScreenSize } from './screen';
import { computeTitleLayout } from './titleLayout';

describe('computeTitleLayout', () => {
    // Hand-worked from docs/spec/title-demo.md: name 0.2 H, START 0.6 H (both rounded), tagline +70, hints +110 / +38.
    const cases: { view: [number, number]; size: [number, number]; ys: number[] }[] = [
        { view: [375, 550], size: [768, 1126], ys: [225, 295, 676, 786, 824] },
        { view: [667, 310], size: [1536, 768], ys: [154, 224, 461, 571, 609] },
        { view: [390, 844], size: [768, 1536], ys: [307, 377, 922, 1032, 1070] },
        { view: [1280, 720], size: [1365, 768], ys: [154, 224, 461, 571, 609] },
        { view: [1024, 768], size: [1024, 768], ys: [154, 224, 461, 571, 609] }
    ];

    it.each(cases)('places everything for a $view viewport', ({ view, size, ys }) => {
        const screen = computeScreenSize(view[0], view[1]);
        expect([screen.width, screen.height]).toEqual(size);
        const l = computeTitleLayout(screen);
        expect([l.nameY, l.taglineY, l.startY, l.hint1Y, l.hint2Y]).toEqual(ys);
        expect(l.centerX).toBe(Math.round(size[0] / 2));
        expect(l.startWidth).toBe(TITLE_START_WIDTH);
        expect(l.startHeight).toBe(TITLE_START_HEIGHT);
    });

    it.each(cases)('keeps the elements on screen and apart for a $view viewport', ({ view }) => {
        const screen = computeScreenSize(view[0], view[1]);
        const l = computeTitleLayout(screen);
        const rows = [
            { top: l.nameY - TITLE_NAME_SIZE / 2, bottom: l.nameY + TITLE_NAME_SIZE / 2 },
            { top: l.taglineY - TITLE_TAGLINE_SIZE / 2, bottom: l.taglineY + TITLE_TAGLINE_SIZE / 2 },
            { top: l.startY - l.startHeight / 2, bottom: l.startY + l.startHeight / 2 },
            { top: l.hint1Y - TITLE_HINT_SIZE / 2, bottom: l.hint1Y + TITLE_HINT_SIZE / 2 },
            { top: l.hint2Y - TITLE_HINT_SIZE / 2, bottom: l.hint2Y + TITLE_HINT_SIZE / 2 }
        ];
        expect(rows[0].top).toBeGreaterThanOrEqual(0);
        expect(rows[4].bottom).toBeLessThanOrEqual(screen.height);
        for (let i = 1; i < rows.length; i++) expect(rows[i].top).toBeGreaterThan(rows[i - 1].bottom);
    });

    it('puts START from 419 and the last hint down to 622 at H = 768 (the spec\'s worked values)', () => {
        const l = computeTitleLayout({ width: 1024, height: 768 });
        expect(l.startY - l.startHeight / 2).toBe(419);
        expect(l.hint2Y + TITLE_HINT_SIZE / 2).toBe(622);
    });
});
