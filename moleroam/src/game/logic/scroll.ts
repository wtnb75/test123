import { PARAMS } from '../params';
import { clampScroll, type Pt } from './board';
import { LANDSCAPE, type Layout } from './layout';

/** New view position in `layout`: the current one plus every scroll source (keys, edge, drag), kept inside the board. */
export const combineScrollIn = (layout: Layout, current: Pt, deltas: readonly Pt[]): Pt => {
    const x = deltas.reduce((sum, d) => sum + d.x, current.x);
    const y = deltas.reduce((sum, d) => sum + d.y, current.y);
    return clampScroll(x, y, layout);
};

/** The landscape layout's `combineScrollIn`. */
export const combineScroll = (current: Pt, ...deltas: Pt[]): Pt => combineScrollIn(LANDSCAPE, current, deltas);

/** True once a press has moved `dragThresholdPx` or more (exactly the threshold already counts). */
export const isDrag = (dx: number, dy: number): boolean => Math.hypot(dx, dy) >= PARAMS.dragThresholdPx;

/** Arrow-key scroll for one update: each axis is the sum of its keys, diagonals are not normalized. */
export const keyDelta = (left: boolean, right: boolean, up: boolean, down: boolean, deltaMs: number): Pt => {
    const step = (PARAMS.scrollSpeed * deltaMs) / 1000;
    return { x: (Number(right) - Number(left)) * step, y: (Number(down) - Number(up)) * step };
};

/** One axis of edge scroll: -1 at the low edge, 0 at the inner border of the zone and beyond, +1 at the high edge. */
const edgeAxis = (value: number, size: number): number => {
    const zone = PARAMS.edgeScrollZonePx;
    if (value < zone) return -Math.min(1, (zone - value) / zone);
    if (value > size - zone) return Math.min(1, (value - (size - zone)) / zone);
    return 0;
};

/** Edge-scroll direction (-1..1 per axis) for a mouse at `at` in canvas coordinates. */
export const edgeDir = (at: Pt, layout: Layout = LANDSCAPE): Pt => ({
    x: edgeAxis(at.x, layout.viewW),
    y: edgeAxis(at.y, layout.viewH),
});

export const edgeDelta = (at: Pt, deltaMs: number, layout: Layout = LANDSCAPE): Pt => {
    const dir = edgeDir(at, layout);
    const step = (PARAMS.edgeScrollSpeed * deltaMs) / 1000;
    return { x: dir.x * step, y: dir.y * step };
};
