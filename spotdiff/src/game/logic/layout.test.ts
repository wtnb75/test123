import { describe, expect, it } from 'vitest';
import { hitPanel, isPortraitSize, layoutFor, panelPixels, toCanvas, toPanelLocal } from './layout';

describe('isPortraitSize', () => {
    it('is portrait only when taller than wide', () => {
        expect(isPortraitSize(768, 1024)).toBe(true);
        expect(isPortraitSize(1024, 768)).toBe(false);
    });

    it('treats a square window as landscape', () => {
        expect(isPortraitSize(800, 800)).toBe(false);
    });
});

describe('layoutFor', () => {
    it('lays two 400px panels side by side in the 1024x768 landscape canvas', () => {
        const l = layoutFor(false);
        expect([l.width, l.height]).toEqual([1024, 768]);
        // (1024 - 400*2 - 64) / 2 = 80 left margin; second panel after a 64px gap
        expect(l.panels).toEqual([
            { x: 80, y: 200 },
            { x: 544, y: 200 },
        ]);
        expect(l.hud).toEqual({ x: 512, y: 50 });
        expect(l.message).toEqual({ x: 512, y: 120 });
        expect(l.center).toEqual({ x: 512, y: 384 });
    });

    it('stacks the enlarged panels in the 768x1664 portrait canvas (spec: panelScale 1.75)', () => {
        const l = layoutFor(true);
        expect([l.width, l.height]).toEqual([768, 1664]);
        expect(l.panelScale).toBe(1.75);
        // (768 - 400*1.75) / 2 = 34; second panel at 950; each panel is 700 px on screen
        expect(l.panels).toEqual([
            { x: 34, y: 210 },
            { x: 34, y: 950 },
        ]);
        expect(l.hud).toEqual({ x: 384, y: 80 });
        expect(l.message).toEqual({ x: 384, y: 150 });
        expect(l.center).toEqual({ x: 384, y: 832 });
        expect(l.portrait).toBe(true);
    });

    it('draws the landscape panels at their natural size', () => {
        const l = layoutFor(false);
        expect(l.panelScale).toBe(1);
        expect(l.portrait).toBe(false);
        expect(panelPixels(l)).toBe(400);
    });

    it('ends the second portrait panel at y = 1650, inside the 1664 canvas, and fills most of the width', () => {
        const l = layoutFor(true);
        expect(panelPixels(l)).toBe(700);
        expect(l.panels[1].y + panelPixels(l)).toBe(1650);
        expect(panelPixels(l) / l.width).toBeGreaterThan(0.9);
    });

    it.each([false, true])('keeps both panels inside the canvas and apart (portrait=%s)', (portrait) => {
        const l = layoutFor(portrait);
        const [a, b] = l.panels;
        for (const p of l.panels) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.x + panelPixels(l)).toBeLessThanOrEqual(l.width);
            expect(p.y + panelPixels(l)).toBeLessThanOrEqual(l.height);
        }
        const size = panelPixels(l);
        const overlapX = a.x < b.x + size && b.x < a.x + size;
        const overlapY = a.y < b.y + size && b.y < a.y + size;
        expect(overlapX && overlapY).toBe(false);
    });

    it('keeps the HUD and message rows above the panels', () => {
        for (const portrait of [false, true]) {
            const l = layoutFor(portrait);
            expect(l.message.y).toBeGreaterThan(l.hud.y);
            expect(l.message.y).toBeLessThan(l.panels[0].y);
        }
    });
});

describe('toPanelLocal', () => {
    const landscape = layoutFor(false);

    it('converts a point inside a panel to panel-local coordinates', () => {
        expect(toPanelLocal(landscape, 100, 250)).toEqual({ x: 20, y: 50 });
        expect(toPanelLocal(landscape, 600, 300)).toEqual({ x: 56, y: 100 });
    });

    it('includes the panel edges', () => {
        expect(toPanelLocal(landscape, 80, 200)).toEqual({ x: 0, y: 0 });
        expect(toPanelLocal(landscape, 480, 600)).toEqual({ x: 400, y: 400 });
    });

    it('returns null just outside a panel, in the gap, and outside the canvas area', () => {
        expect(toPanelLocal(landscape, 480.5, 300)).toBeNull();
        expect(toPanelLocal(landscape, 79.5, 300)).toBeNull();
        expect(toPanelLocal(landscape, 100, 199.5)).toBeNull();
        expect(toPanelLocal(landscape, 100, 600.5)).toBeNull();
        expect(toPanelLocal(landscape, 512, 400)).toBeNull();
    });

    it('divides by the portrait display scale: 35 px right/down of a panel corner is 20 panel units', () => {
        const portrait = layoutFor(true);
        expect(toPanelLocal(portrait, 34 + 35, 210 + 35)).toEqual({ x: 20, y: 20 });
        expect(toPanelLocal(portrait, 34 + 35, 950 + 70)).toEqual({ x: 20, y: 40 });
    });

    it('includes the edges of the 700 px portrait panels and excludes just beyond them', () => {
        const portrait = layoutFor(true);
        expect(toPanelLocal(portrait, 34, 210)).toEqual({ x: 0, y: 0 });
        expect(toPanelLocal(portrait, 734, 910)).toEqual({ x: 400, y: 400 });
        expect(toPanelLocal(portrait, 734.5, 500)).toBeNull();
        expect(toPanelLocal(portrait, 400, 910.5)).toBeNull(); // in the 40 px gap
        expect(toPanelLocal(portrait, 400, 949.5)).toBeNull();
        expect(toPanelLocal(portrait, 734, 1650)).toEqual({ x: 400, y: 400 });
        expect(toPanelLocal(portrait, 400, 1650.5)).toBeNull();
    });
});

describe('hitPanel', () => {
    it('names the panel that was hit along with the local coordinates', () => {
        const landscape = layoutFor(false);
        expect(hitPanel(landscape, 100, 250)).toEqual({ panel: 0, x: 20, y: 50 });
        expect(hitPanel(landscape, 600, 300)).toEqual({ panel: 1, x: 56, y: 100 });
        expect(hitPanel(layoutFor(true), 34 + 35, 950 + 70)).toEqual({ panel: 1, x: 20, y: 40 });
    });

    it('returns null outside both panels', () => {
        expect(hitPanel(layoutFor(false), 512, 400)).toBeNull();
    });
});

describe('toCanvas', () => {
    it('is the inverse of hitPanel for both orientations', () => {
        for (const portrait of [false, true]) {
            const l = layoutFor(portrait);
            for (const panel of [0, 1]) {
                const at = toCanvas(l, panel, 123, 321);
                expect(hitPanel(l, at.x, at.y)).toEqual({ panel, x: 123, y: 321 });
            }
        }
    });

    it('applies the display scale and the panel origin', () => {
        expect(toCanvas(layoutFor(true), 1, 100, 200)).toEqual({ x: 34 + 175, y: 950 + 350 });
        expect(toCanvas(layoutFor(false), 1, 100, 200)).toEqual({ x: 544 + 100, y: 200 + 200 });
    });
});
