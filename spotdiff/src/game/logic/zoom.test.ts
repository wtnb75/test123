import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { layoutFor } from './layout';
import {
    NO_ZOOM,
    anchorView,
    clampView,
    clampZoom,
    hitPanelView,
    hudMaxWidth,
    inPanelRect,
    isZoomed,
    resetButtonX,
    resetLabelX,
    resetVisible,
    sameView,
    toPanelPoint,
    viewFrame,
    wheelFactor,
} from './zoom';

// portrait: panel scale 1.75, panel origins (34, 210) and (34, 950)
const portrait = layoutFor('portrait');
const O0 = portrait.panels[0];
const S = portrait.panelScale;

describe('toPanelPoint', () => {
    it('is the plain panel scale at zoom 1 with the whole picture shown', () => {
        const p = toPanelPoint(O0, S, NO_ZOOM, 34 + 35, 210 + 35);
        expect(p).toEqual({ x: 20, y: 20 });
    });

    it('maps the panel corner to the view origin and offsets by pixels / (zoom * scale) when zoomed', () => {
        const view = { zoom: 2, x: 100, y: 50 };
        expect(toPanelPoint(O0, S, view, 34, 210)).toEqual({ x: 100, y: 50 });
        // 70 and 35 canvas px over a factor of 2 * 1.75 = 3.5 are 20 and 10 panel units
        expect(toPanelPoint(O0, S, view, 34 + 70, 210 + 35)).toEqual({ x: 120, y: 60 });
    });
});

describe('round trips on every layout', () => {
    // [kind, scale, second panel origin] from the layout table: landscape 1.0 at (80, 200)/(544, 200), wide 1.6 at (160, 104)/(864, 104)
    it.each([
        ['portrait', 1.75, { x: 34, y: 950 }],
        ['landscape', 1, { x: 544, y: 200 }],
        ['wide', 1.6, { x: 864, y: 104 }],
    ] as const)('%s: a canvas point maps to the panel point origin-relative and back through the frame', (kind, scale, origin1) => {
        const layout = layoutFor(kind);
        expect(layout.panelScale).toBe(scale);
        expect(layout.panels[1]).toEqual(origin1);
        const view = { zoom: 2.5, x: 120, y: 80 };
        for (const origin of layout.panels) {
            const k = view.zoom * scale;
            const p = toPanelPoint(origin, scale, view, origin.x + 90, origin.y + 45);
            expect(p.x).toBeCloseTo(120 + 90 / k, 9); // view + canvas offset / (zoom * scale)
            expect(p.y).toBeCloseTo(80 + 45 / k, 9);
            const f = viewFrame(origin, scale, view);
            expect(f.x + p.x * f.scale).toBeCloseTo(origin.x + 90, 9);
            expect(f.y + p.y * f.scale).toBeCloseTo(origin.y + 45, 9);
        }
    });

    it('wide: the hit test through a zoom-2 view finds the second panel with its own origin (864, 104)', () => {
        const wide = layoutFor('wide');
        const view = { zoom: 2, x: 100, y: 50 };
        // 3.2 canvas px per panel unit: 64 px right of the corner is 20 units
        expect(hitPanelView(wide, view, 864 + 64, 104 + 32)).toEqual({ panel: 1, x: 120, y: 60 });
    });
});

describe('viewFrame', () => {
    it('is the layout frame at zoom 1', () => {
        expect(viewFrame(O0, S, NO_ZOOM)).toEqual({ x: 34, y: 210, scale: 1.75 });
    });

    it('draws the view origin at the panel corner and scales by zoom * panel scale', () => {
        const view = { zoom: 2, x: 100, y: 50 };
        const f = viewFrame(O0, S, view);
        expect(f).toEqual({ x: 34 - 100 * 3.5, y: 210 - 50 * 3.5, scale: 3.5 });
        // the view origin lands on the panel corner, and the inverse mapping gives back the panel point
        expect(f.x + 100 * f.scale).toBe(34);
        expect(f.y + 50 * f.scale).toBe(210);
    });
});

describe('clampZoom and clampView', () => {
    it('limits the zoom to zoomMin..zoomMax', () => {
        expect(clampZoom(0.5)).toBe(1);
        expect(clampZoom(1)).toBe(1);
        expect(clampZoom(2.2)).toBe(2.2);
        expect(clampZoom(5)).toBe(3);
    });

    it('keeps the visible square inside the panel: the largest origin is 400 - 400 / zoom', () => {
        expect(clampView({ zoom: 1, x: 50, y: 50 })).toEqual({ zoom: 1, x: 0, y: 0 });
        expect(clampView({ zoom: 2, x: 999, y: -5 })).toEqual({ zoom: 2, x: 200, y: 0 });
        const v = clampView({ zoom: 3, x: 999, y: 999 });
        expect(v.x).toBeCloseTo(266.667, 3);
        expect(v.y).toBeCloseTo(266.667, 3);
    });

    it('clamps the zoom before fitting the position', () => {
        expect(clampView({ zoom: 9, x: 999, y: 0 }).zoom).toBe(PARAMS.zoomMax);
        expect(clampView({ zoom: 9, x: 999, y: 0 }).x).toBeCloseTo(266.667, 3);
    });
});

describe('isZoomed and sameView', () => {
    it('is zoomed only above zoomMin', () => {
        expect(isZoomed(NO_ZOOM)).toBe(false);
        expect(isZoomed({ zoom: 1.0001, x: 0, y: 0 })).toBe(true);
    });

    it('compares all three fields', () => {
        expect(sameView({ zoom: 2, x: 1, y: 2 }, { zoom: 2, x: 1, y: 2 })).toBe(true);
        expect(sameView({ zoom: 2, x: 1, y: 2 }, { zoom: 3, x: 1, y: 2 })).toBe(false);
        expect(sameView({ zoom: 2, x: 1, y: 2 }, { zoom: 2, x: 9, y: 2 })).toBe(false);
        expect(sameView({ zoom: 2, x: 1, y: 2 }, { zoom: 2, x: 1, y: 9 })).toBe(false);
    });
});

describe('anchorView', () => {
    // at zoom 1 the panel point (ax, ay) is drawn at (34 + ax * 1.75, 210 + ay * 1.75)
    const screenOf = (ax: number, ay: number) => ({ x: 34 + ax * 1.75, y: 210 + ay * 1.75 });

    it('zooming 1 -> 2 about the point (300, 100) moves the view origin to (150, 50)', () => {
        const v = anchorView(O0, S, 2, { x: 300, y: 100 }, screenOf(300, 100));
        expect(v.zoom).toBe(2);
        expect(v.x).toBeCloseTo(150, 9);
        expect(v.y).toBeCloseTo(50, 9);
    });

    it('fits the view into the panel at the far corner: (390, 390) -> (195, 195), (400, 400) -> (200, 200)', () => {
        const a = anchorView(O0, S, 2, { x: 390, y: 390 }, screenOf(390, 390));
        expect(a.x).toBeCloseTo(195, 9);
        expect(a.y).toBeCloseTo(195, 9);
        const b = anchorView(O0, S, 2, { x: 400, y: 400 }, screenOf(400, 400));
        expect(b.x).toBeCloseTo(200, 9);
        expect(b.y).toBeCloseTo(200, 9);
    });

    it('keeps the anchor under the screen point', () => {
        const screen = screenOf(250, 120);
        const v = anchorView(O0, S, 2.5, { x: 250, y: 120 }, screen);
        const back = toPanelPoint(O0, S, v, screen.x, screen.y);
        expect(back.x).toBeCloseTo(250, 9);
        expect(back.y).toBeCloseTo(120, 9);
    });

    it('zooming out from the far corner keeps the view inside the panel (zoom 3 at the maximum -> 1.5: at most 400 - 400 / 1.5)', () => {
        const farScreen = { x: 34 + 400 * 3 * 1.75, y: 210 + 400 * 3 * 1.75 };
        const v = anchorView(O0, S, 1.5, { x: 400, y: 400 }, farScreen);
        expect(v.zoom).toBe(1.5);
        expect(v.x).toBeLessThanOrEqual(400 - 400 / 1.5);
        expect(v.y).toBeLessThanOrEqual(400 - 400 / 1.5);
        expect(v.x).toBeGreaterThanOrEqual(0);
    });

    it('clamps the zoom to zoomMax and to zoomMin (a view at zoom 1 sits at the origin)', () => {
        expect(anchorView(O0, S, 10, { x: 200, y: 200 }, screenOf(200, 200)).zoom).toBe(3);
        expect(anchorView(O0, S, 0.2, { x: 200, y: 200 }, screenOf(200, 200))).toEqual({ zoom: 1, x: 0, y: 0 });
    });
});

describe('wheelFactor', () => {
    it('is 1.1 per 100 of deltaY, zooming in for negative values and out for positive ones', () => {
        expect(wheelFactor(-100)).toBeCloseTo(1.1, 12);
        expect(wheelFactor(100)).toBeCloseTo(1 / 1.1, 12);
        expect(wheelFactor(0)).toBe(1);
    });

    it('caps one event at wheelDeltaMax (300): -300 and -1000 both give 1.1^3 = 1.331', () => {
        expect(wheelFactor(-300)).toBeCloseTo(1.331, 12);
        expect(wheelFactor(-1000)).toBeCloseTo(1.331, 12);
        expect(wheelFactor(1000)).toBeCloseTo(1 / 1.331, 12);
    });

    it('counts a line-mode delta as wheelLinePx (16) pixels per line: -3 lines are -48', () => {
        expect(wheelFactor(-3, 1)).toBeCloseTo(Math.pow(1.1, 0.48), 12);
        expect(wheelFactor(-3, 0)).toBeCloseTo(Math.pow(1.1, 0.03), 12);
    });

    it('applies the cap after the line conversion (-30 lines are -480 -> capped to -300)', () => {
        expect(wheelFactor(-30, 1)).toBeCloseTo(1.331, 12);
    });
});

describe('hitPanelView', () => {
    it('gives the panel and the panel point seen through the view', () => {
        const view = { zoom: 2, x: 100, y: 50 };
        expect(hitPanelView(portrait, view, 104, 245)).toEqual({ panel: 0, x: 120, y: 60 });
        // the second panel starts at y = 950
        expect(hitPanelView(portrait, view, 34, 950)).toEqual({ panel: 1, x: 100, y: 50 });
    });

    it('is null outside both panels, and the same as the plain panel hit at zoom 1', () => {
        expect(hitPanelView(portrait, NO_ZOOM, 5, 5)).toBeNull();
        expect(hitPanelView(portrait, NO_ZOOM, 69, 245)).toEqual({ panel: 0, x: 20, y: 20 });
    });
});

describe('inPanelRect', () => {
    it('counts the panel edges as inside and a point just past an edge as outside', () => {
        // panel 0 covers x 34..734 and y 210..910 (700 px)
        expect(inPanelRect(portrait, 0, 34, 210)).toBe(true);
        expect(inPanelRect(portrait, 0, 734, 910)).toBe(true);
        expect(inPanelRect(portrait, 0, 734.1, 910)).toBe(false);
        expect(inPanelRect(portrait, 0, 734, 910.1)).toBe(false);
        expect(inPanelRect(portrait, 0, 33.9, 300)).toBe(false);
        expect(inPanelRect(portrait, 0, 300, 209.9)).toBe(false);
        expect(inPanelRect(portrait, 1, 300, 950)).toBe(true);
        expect(inPanelRect(portrait, 1, 300, 930)).toBe(false);
    });
});

describe('RESET button helpers', () => {
    it('shows RESET only while zoomed in and playing', () => {
        const zoomed = { zoom: 1.5, x: 0, y: 0 };
        expect(resetVisible(zoomed, true)).toBe(true);
        expect(resetVisible(zoomed, false)).toBe(false);
        expect(resetVisible(NO_ZOOM, true)).toBe(false);
    });

    it('mirrors the HINT centre about the canvas centre for the hit square', () => {
        expect(resetButtonX(768, 700)).toBe(68);
        expect(resetButtonX(1664, 1600)).toBe(64);
    });

    it('moves only the label right when its text would cross the left margin (16 px)', () => {
        expect(resetLabelX(768, 700, 100)).toBe(68); // 16 + 50 = 66 <= 68: no move
        expect(resetLabelX(768, 700, 130)).toBe(81); // 16 + 65 = 81 > 68
    });

    it('limits the HUD by the wider of the two labels, whether or not RESET shows, and by the pulse peak', () => {
        // (768 - 2 * (100 + 16)) / 1.1
        expect(hudMaxWidth(768, 80, 100)).toBeCloseTo(536 / 1.1, 9);
        // HINT wider than RESET: HINT decides
        expect(hudMaxWidth(768, 120, 100)).toBeCloseTo((768 - 2 * 136) / 1.1, 9);
    });
});
