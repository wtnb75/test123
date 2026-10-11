import { describe, expect, it } from 'vitest';
import { layoutFor } from './layout';
import type { LayoutKind } from './layout';
import { tapRingAlpha, tapRingRadius } from './effects';
import { titleLayoutFor } from './titleLayout';
import { PARAMS } from '../params';

// Expected values are worked by hand from the spec's Title 配置 table.
const TABLE: Record<
    LayoutKind,
    { name: number; tagline: number; date: number; prompt: number; panels: [number, number][]; scale: number; size: number }
> = {
    portrait: { name: 130, tagline: 230, date: 300, prompt: 1540, panels: [[134, 380], [134, 920]], scale: 1.25, size: 500 },
    landscape: { name: 60, tagline: 125, date: 175, prompt: 700, panels: [[80, 220], [544, 220]], scale: 1, size: 400 },
    wide: { name: 60, tagline: 125, date: 175, prompt: 700, panels: [[400, 220], [864, 220]], scale: 1, size: 400 },
};

describe.each<LayoutKind>(['portrait', 'landscape', 'wide'])('Title layout (%s)', (kind) => {
    const t = titleLayoutFor(kind);
    const want = TABLE[kind];

    it('uses the same canvas as the Game layout of this kind', () => {
        const g = layoutFor(kind);
        expect([t.width, t.height, t.bigText]).toEqual([g.width, g.height, g.bigText]);
    });

    it('puts the texts and the two pictures where the spec table says', () => {
        expect(t.name).toEqual({ x: t.width / 2, y: want.name });
        expect(t.tagline).toEqual({ x: t.width / 2, y: want.tagline });
        expect(t.date).toEqual({ x: t.width / 2, y: want.date });
        expect(t.prompt).toEqual({ x: t.width / 2, y: want.prompt });
        expect(t.panels.map((p) => [p.x, p.y])).toEqual(want.panels);
        expect(t.panelScale).toBe(want.scale);
        expect(PARAMS.panelSize * t.panelScale).toBe(want.size);
    });

    it('keeps the pictures and the texts on the canvas, and the texts off the pictures', () => {
        const size = PARAMS.panelSize * t.panelScale;
        for (const p of t.panels) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.x + size).toBeLessThanOrEqual(t.width);
            expect(p.y + size).toBeLessThanOrEqual(t.height);
        }
        const dateSize = t.bigText ? 32 : 28;
        const rows = [
            { y: t.name.y, h: 72 },
            { y: t.tagline.y, h: 32 },
            { y: t.date.y, h: dateSize },
            { y: t.prompt.y, h: 36 },
        ];
        const top = Math.min(...t.panels.map((p) => p.y));
        const bottom = Math.max(...t.panels.map((p) => p.y)) + size;
        rows.forEach((r) => {
            expect(r.y - r.h / 2).toBeGreaterThanOrEqual(0);
            expect(r.y + r.h / 2).toBeLessThanOrEqual(t.height);
            // each text row is wholly above or wholly below the pictures
            const above = r.y + r.h / 2 <= top;
            const below = r.y - r.h / 2 >= bottom;
            expect(above || below).toBe(true);
        });
        // the rows do not overlap each other
        const sorted = [...rows].sort((a, b) => a.y - b.y);
        for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i].y - sorted[i].h / 2).toBeGreaterThanOrEqual(sorted[i - 1].y + sorted[i - 1].h / 2);
        }
    });

    it('keeps the two pictures from touching each other', () => {
        const size = PARAMS.panelSize * t.panelScale;
        const [a, b] = t.panels;
        const apart = a.x + size <= b.x || b.x + size <= a.x || a.y + size <= b.y || b.y + size <= a.y;
        expect(apart).toBe(true);
    });
});

describe('Title layout, texts on the phone layouts', () => {
    it('portrait and wide use 32px for the date (every text is at least 32px there); landscape keeps 28px', () => {
        expect(titleLayoutFor('portrait').bigText).toBe(true);
        expect(titleLayoutFor('wide').bigText).toBe(true);
        expect(titleLayoutFor('landscape').bigText).toBe(false);
    });

    it('lays the portrait pictures out one above the other, the others side by side', () => {
        const p = titleLayoutFor('portrait').panels;
        expect(p[0].x).toBe(p[1].x);
        expect(p[1].y).toBeGreaterThan(p[0].y);
        const l = titleLayoutFor('landscape').panels;
        expect(l[0].y).toBe(l[1].y);
        expect(l[1].x).toBeGreaterThan(l[0].x);
    });
});

describe('tap ring time functions (spec 演出・UI "タップの輪")', () => {
    it('starts at radius 12 and opacity 1', () => {
        expect(tapRingRadius(0)).toBe(12);
        expect(tapRingAlpha(0)).toBe(1);
    });

    it('is radius 26 and opacity 0.5 at 200 ms (linear)', () => {
        expect(tapRingRadius(200)).toBe(26);
        expect(tapRingAlpha(200)).toBe(0.5);
    });

    it('ends at radius 40 and opacity 0 at 400 ms and stays there', () => {
        expect(tapRingRadius(400)).toBe(40);
        expect(tapRingAlpha(400)).toBe(0);
        expect(tapRingRadius(1000)).toBe(40);
        expect(tapRingAlpha(1000)).toBe(0);
    });

    it('does not go below its start for a negative time', () => {
        expect(tapRingRadius(-50)).toBe(12);
        expect(tapRingAlpha(-50)).toBe(1);
    });
});
