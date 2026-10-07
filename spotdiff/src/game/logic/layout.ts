import { PARAMS } from '../params';

export interface Point {
    x: number;
    y: number;
}

export type LayoutKind = 'portrait' | 'landscape' | 'wide';

export interface Layout {
    kind: LayoutKind;
    /** True on the phone-oriented layouts, where texts must stay >= 32px on the canvas. */
    bigText: boolean;
    width: number;
    height: number;
    /** Top-left corners of the two panels on the canvas. */
    panels: [Point, Point];
    /** Display scale of the panels (panel-local coordinates times this give canvas pixels). */
    panelScale: number;
    hud: Point;
    message: Point;
    center: Point;
}

export interface PanelHit extends Point {
    /** Which panel was hit (0 = first/left/top, 1 = second/right/bottom). */
    panel: number;
}

/** Portrait when the window is taller than wide; wide when it is at least `wideAspectMin` times as wide as tall. */
export const layoutKindFor = (width: number, height: number): LayoutKind => {
    if (height > width) return 'portrait';
    return width / height >= PARAMS.wideAspectMin ? 'wide' : 'landscape';
};

const stacked = (scale: number): Layout => {
    const { width, height } = PARAMS.portrait;
    const x = (width - PARAMS.panelSize * scale) / 2;
    const [y0, y1] = PARAMS.portraitPanelY;
    return {
        kind: 'portrait',
        bigText: true,
        width,
        height,
        panels: [
            { x, y: y0 },
            { x, y: y1 },
        ],
        panelScale: scale,
        hud: { x: width / 2, y: PARAMS.hudY.portrait },
        message: { x: width / 2, y: PARAMS.messageY.portrait },
        center: { x: width / 2, y: height / 2 },
    };
};

const sideBySide = (kind: 'landscape' | 'wide'): Layout => {
    const wide = kind === 'wide';
    const { width, height } = wide ? PARAMS.wide : PARAMS.landscape;
    const scale = wide ? PARAMS.widePanelScale : 1;
    const size = PARAMS.panelSize * scale;
    const x0 = (width - size * 2 - PARAMS.panelGap) / 2;
    const y = wide ? PARAMS.widePanelY : PARAMS.landscapePanelY;
    return {
        kind,
        bigText: wide,
        width,
        height,
        panels: [
            { x: x0, y },
            { x: x0 + size + PARAMS.panelGap, y },
        ],
        panelScale: scale,
        hud: { x: width / 2, y: wide ? PARAMS.hudY.wide : PARAMS.hudY.landscape },
        message: { x: width / 2, y: wide ? PARAMS.messageY.wide : PARAMS.messageY.landscape },
        center: { x: width / 2, y: height / 2 },
    };
};

export const layoutFor = (kind: LayoutKind): Layout =>
    kind === 'portrait' ? stacked(PARAMS.portraitPanelScale) : sideBySide(kind);

/** Canvas size of one panel on screen. */
export const panelPixels = (layout: Layout): number => PARAMS.panelSize * layout.panelScale;

/** The panel under a canvas point and the panel-local (unscaled) coordinates, or null outside both panels. */
export const hitPanel = (layout: Layout, px: number, py: number): PanelHit | null => {
    const size = panelPixels(layout);
    for (let panel = 0; panel < layout.panels.length; panel++) {
        const p = layout.panels[panel];
        if (px >= p.x && px <= p.x + size && py >= p.y && py <= p.y + size) {
            return { panel, x: (px - p.x) / layout.panelScale, y: (py - p.y) / layout.panelScale };
        }
    }
    return null;
};

/** Panel-local coordinates of a canvas point, or null when it is outside both panels. */
export const toPanelLocal = (layout: Layout, px: number, py: number): Point | null => {
    const hit = hitPanel(layout, px, py);
    return hit ? { x: hit.x, y: hit.y } : null;
};

/** Canvas position of a panel-local point of the given panel. */
export const toCanvas = (layout: Layout, panel: number, x: number, y: number): Point => ({
    x: layout.panels[panel].x + x * layout.panelScale,
    y: layout.panels[panel].y + y * layout.panelScale,
});
