import { PARAMS } from '../params';
import type { Pt } from './board';

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
export const edgeDir = (at: Pt): Pt => ({
    x: edgeAxis(at.x, PARAMS.viewW),
    y: edgeAxis(at.y, PARAMS.viewH),
});

export const edgeDelta = (at: Pt, deltaMs: number): Pt => {
    const dir = edgeDir(at);
    const step = (PARAMS.edgeScrollSpeed * deltaMs) / 1000;
    return { x: dir.x * step, y: dir.y * step };
};
