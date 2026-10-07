import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { LayoutKind, hitPanel, layoutFor, layoutKindFor, panelPixels, toCanvas, toPanelLocal } from './layout';

const KINDS: LayoutKind[] = ['landscape', 'portrait', 'wide'];

describe('layoutKindFor', () => {
    it('is portrait only when taller than wide', () => {
        expect(layoutKindFor(768, 1024)).toBe('portrait');
        expect(layoutKindFor(1024, 768)).toBe('landscape');
    });

    it('treats a square window as landscape', () => {
        expect(layoutKindFor(800, 800)).toBe('landscape');
    });

    it('is wide at an aspect ratio of exactly 1.6 and landscape just below it', () => {
        expect(layoutKindFor(1280, 800)).toBe('wide');
        expect(layoutKindFor(1279, 800)).toBe('landscape');
    });

    it('is wide for a phone held sideways and a 16:9 window, landscape for 4:3', () => {
        expect(layoutKindFor(844, 390)).toBe('wide');
        expect(layoutKindFor(1920, 1080)).toBe('wide');
        expect(layoutKindFor(1024, 768)).toBe('landscape');
    });

    it('stays portrait for any tall window, however narrow the aspect', () => {
        expect(layoutKindFor(390, 844)).toBe('portrait');
        expect(layoutKindFor(800, 801)).toBe('portrait');
    });
});

describe('layoutFor', () => {
    it('lays two 400px panels side by side in the 1024x768 landscape canvas', () => {
        const l = layoutFor('landscape');
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
        const l = layoutFor('portrait');
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
        expect(l.kind).toBe('portrait');
    });

    it('lays two enlarged panels side by side in the 1664x768 wide canvas (spec: panelScale 1.6)', () => {
        const l = layoutFor('wide');
        expect([l.width, l.height]).toEqual([1664, 768]);
        expect(l.panelScale).toBe(1.6);
        expect(l.kind).toBe('wide');
        // (1664 - 640*2 - 64) / 2 = 160 left margin; second panel after a 64px gap; both at y = 104
        expect(l.panels).toEqual([
            { x: 160, y: 104 },
            { x: 864, y: 104 },
        ]);
        expect(panelPixels(l)).toBe(640);
        expect(l.hud).toEqual({ x: 832, y: 34 });
        expect(l.message).toEqual({ x: 832, y: 78 });
        expect(l.center).toEqual({ x: 832, y: 384 });
        // bottom edge 104 + 640 = 744 <= 768, right edge 864 + 640 = 1504 <= 1664
        expect(l.panels[0].y + panelPixels(l)).toBe(744);
        expect(l.panels[1].x + panelPixels(l)).toBe(1504);
    });

    it('asks for big texts on the portrait and wide layouts only', () => {
        expect(layoutFor('portrait').bigText).toBe(true);
        expect(layoutFor('wide').bigText).toBe(true);
        expect(layoutFor('landscape').bigText).toBe(false);
    });

    it('keeps the smallest hit circle at 44 CSS px or more on an 844x390 wide screen', () => {
        const scale = Math.min(844 / layoutFor('wide').width, 390 / layoutFor('wide').height);
        const smallest = 2 * (PARAMS.shapeSizeMin + PARAMS.hitMargin) * layoutFor('wide').panelScale; // smallest hit circle diameter on the canvas
        expect(smallest * scale).toBeGreaterThanOrEqual(44);
    });

    it('draws the landscape panels at their natural size', () => {
        const l = layoutFor('landscape');
        expect(l.panelScale).toBe(1);
        expect(l.kind).toBe('landscape');
        expect(panelPixels(l)).toBe(400);
    });

    it('ends the second portrait panel at y = 1650, inside the 1664 canvas, and fills most of the width', () => {
        const l = layoutFor('portrait');
        expect(panelPixels(l)).toBe(700);
        expect(l.panels[1].y + panelPixels(l)).toBe(1650);
        expect(panelPixels(l) / l.width).toBeGreaterThan(0.9);
    });

    it.each(KINDS)('keeps both panels inside the canvas and apart (%s)', (kind) => {
        const l = layoutFor(kind);
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
        for (const kind of KINDS) {
            const l = layoutFor(kind);
            expect(l.message.y).toBeGreaterThan(l.hud.y);
            expect(l.message.y).toBeLessThan(l.panels[0].y);
        }
    });
});

describe('toPanelLocal', () => {
    const landscape = layoutFor('landscape');

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
        const portrait = layoutFor('portrait');
        expect(toPanelLocal(portrait, 34 + 35, 210 + 35)).toEqual({ x: 20, y: 20 });
        expect(toPanelLocal(portrait, 34 + 35, 950 + 70)).toEqual({ x: 20, y: 40 });
    });

    it('includes the edges of the 700 px portrait panels and excludes just beyond them', () => {
        const portrait = layoutFor('portrait');
        expect(toPanelLocal(portrait, 34, 210)).toEqual({ x: 0, y: 0 });
        expect(toPanelLocal(portrait, 734, 910)).toEqual({ x: 400, y: 400 });
        expect(toPanelLocal(portrait, 734.5, 500)).toBeNull();
        expect(toPanelLocal(portrait, 400, 910.5)).toBeNull(); // in the 40 px gap
        expect(toPanelLocal(portrait, 400, 949.5)).toBeNull();
        expect(toPanelLocal(portrait, 734, 1650)).toEqual({ x: 400, y: 400 });
        expect(toPanelLocal(portrait, 400, 1650.5)).toBeNull();
    });
});

describe('wide layout hit tests', () => {
    const wide = layoutFor('wide');

    it('divides by the wide display scale: 32 px right/down of a panel corner is 20 panel units', () => {
        expect(toPanelLocal(wide, 160 + 32, 104 + 32)).toEqual({ x: 20, y: 20 });
        expect(hitPanel(wide, 864 + 32, 104 + 64)).toEqual({ panel: 1, x: 20, y: 40 });
    });

    it('includes the edges of the 640 px wide panels and excludes just beyond them', () => {
        expect(toPanelLocal(wide, 160, 104)).toEqual({ x: 0, y: 0 });
        expect(toPanelLocal(wide, 800, 744)).toEqual({ x: 400, y: 400 });
        expect(toPanelLocal(wide, 800.5, 400)).toBeNull();
        expect(toPanelLocal(wide, 400, 744.5)).toBeNull();
        expect(toPanelLocal(wide, 400, 103.5)).toBeNull();
        expect(toPanelLocal(wide, 830, 400)).toBeNull(); // in the 64 px gap
        expect(toPanelLocal(wide, 863.5, 400)).toBeNull();
        expect(toPanelLocal(wide, 864, 104)).toEqual({ x: 0, y: 0 });
    });
});

describe('hitPanel', () => {
    it('names the panel that was hit along with the local coordinates', () => {
        const landscape = layoutFor('landscape');
        expect(hitPanel(landscape, 100, 250)).toEqual({ panel: 0, x: 20, y: 50 });
        expect(hitPanel(landscape, 600, 300)).toEqual({ panel: 1, x: 56, y: 100 });
        expect(hitPanel(layoutFor('portrait'), 34 + 35, 950 + 70)).toEqual({ panel: 1, x: 20, y: 40 });
    });

    it('returns null outside both panels', () => {
        expect(hitPanel(layoutFor('landscape'), 512, 400)).toBeNull();
    });
});

describe('toCanvas', () => {
    it('is the inverse of hitPanel for every layout', () => {
        for (const kind of KINDS) {
            const l = layoutFor(kind);
            for (const panel of [0, 1]) {
                const at = toCanvas(l, panel, 123, 321);
                const hit = hitPanel(l, at.x, at.y);
                // a scale such as 1.6 is not exact in binary, so compare the local point with a tolerance
                expect(hit?.panel).toBe(panel);
                expect(hit?.x).toBeCloseTo(123, 9);
                expect(hit?.y).toBeCloseTo(321, 9);
            }
        }
    });

    it('applies the display scale and the panel origin', () => {
        expect(toCanvas(layoutFor('portrait'), 1, 100, 200)).toEqual({ x: 34 + 175, y: 950 + 350 });
        expect(toCanvas(layoutFor('landscape'), 1, 100, 200)).toEqual({ x: 544 + 100, y: 200 + 200 });
    });
});
