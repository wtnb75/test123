import { PARAMS } from '../params';
import { Layout, PanelHit, Point, hitPanel, panelPixels } from './layout';

/** What is shown of a panel: the scale and the top-left of the visible square, in panel-local coordinates. */
export interface View {
    zoom: number;
    x: number;
    y: number;
}

/** Origin and scale a panel is drawn with: `canvas = x + local * scale`. */
export interface Frame {
    x: number;
    y: number;
    scale: number;
}

export const NO_ZOOM: View = { zoom: PARAMS.zoomMin, x: 0, y: 0 };

export const isZoomed = (view: View): boolean => view.zoom > PARAMS.zoomMin;

export const sameView = (a: View, b: View): boolean => a.zoom === b.zoom && a.x === b.x && a.y === b.y;

export const clampZoom = (zoom: number): number => Math.min(PARAMS.zoomMax, Math.max(PARAMS.zoomMin, zoom));

/** Clamps the zoom, and moves the view so the visible square (side `panelSize / zoom`) stays inside the panel. */
export const clampView = (view: View): View => {
    const zoom = clampZoom(view.zoom);
    const max = PARAMS.panelSize - PARAMS.panelSize / zoom;
    return { zoom, x: Math.min(max, Math.max(0, view.x)), y: Math.min(max, Math.max(0, view.y)) };
};

/** Panel-local point under a canvas point (`origin`: the panel's top-left on the canvas). */
export const toPanelPoint = (origin: Point, panelScale: number, view: View, cx: number, cy: number): Point => {
    const k = view.zoom * panelScale;
    return { x: view.x + (cx - origin.x) / k, y: view.y + (cy - origin.y) / k };
};

/** The panel's drawing frame under a view: drawing with it shows the viewed part at the panel's place. */
export const viewFrame = (origin: Point, panelScale: number, view: View): Frame => {
    const k = view.zoom * panelScale;
    return { x: origin.x - view.x * k, y: origin.y - view.y * k, scale: k };
};

/**
 * The view that keeps the panel-local point `anchor` under the canvas point `screen` at the given zoom
 * (the zoom is clamped first, the position then fitted into the panel).
 */
export const anchorView = (origin: Point, panelScale: number, zoom: number, anchor: Point, screen: Point): View => {
    const z = clampZoom(zoom);
    const k = z * panelScale;
    return clampView({ zoom: z, x: anchor.x - (screen.x - origin.x) / k, y: anchor.y - (screen.y - origin.y) / k });
};

/** Zoom factor of one wheel event: `wheelStep` per 100 of `deltaY` (negative zooms in), capped; line mode counts `wheelLinePx` per line. */
export const wheelFactor = (deltaY: number, deltaMode = 0): number => {
    const px = deltaMode === 1 ? deltaY * PARAMS.wheelLinePx : deltaY;
    const capped = Math.min(PARAMS.wheelDeltaMax, Math.max(-PARAMS.wheelDeltaMax, px));
    return Math.pow(PARAMS.wheelStep, -capped / 100);
};

/** The panel under a canvas point and the panel-local point there, seen through the view; null outside both panels. */
export const hitPanelView = (layout: Layout, view: View, px: number, py: number): PanelHit | null => {
    const hit = hitPanel(layout, px, py);
    if (!hit) return null;
    const p = toPanelPoint(layout.panels[hit.panel], layout.panelScale, view, px, py);
    return { panel: hit.panel, x: p.x, y: p.y };
};

/** Whether a canvas point is inside the given panel's rectangle (edges count). */
export const inPanelRect = (layout: Layout, panel: number, x: number, y: number): boolean => {
    const o = layout.panels[panel];
    const size = panelPixels(layout);
    return x >= o.x && x <= o.x + size && y >= o.y && y <= o.y + size;
};

/** RESET is shown only while zoomed in and playing. */
export const resetVisible = (view: View, playing: boolean): boolean => playing && isZoomed(view);

/** Centre x of the RESET hit square: the mirror image of the HINT button's centre about the canvas centre. */
export const resetButtonX = (canvasWidth: number, hintCenterX: number): number => canvasWidth - hintCenterX;

/** Centre x of the RESET label: at the hit square's centre, moved right when its (wider) text would cross the left margin. */
export const resetLabelX = (canvasWidth: number, hintCenterX: number, resetWidth: number): number =>
    Math.max(resetButtonX(canvasWidth, hintCenterX), PARAMS.hintMargin + resetWidth / 2);

/**
 * Widest the HUD may be (before the low-time pulse): clear of both buttons, the wider label deciding, so the HUD's size
 * does not change when RESET appears. The pulse's peak (`1 + lowTimePulse`) must stay inside too.
 */
export const hudMaxWidth = (canvasWidth: number, hintWidth: number, resetWidth: number): number =>
    (canvasWidth - 2 * (Math.max(hintWidth, resetWidth) + PARAMS.hintMargin)) / (1 + PARAMS.lowTimePulse);
