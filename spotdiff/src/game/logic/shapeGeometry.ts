import { PARAMS } from '../params';
import type { Point } from './layout';

export type PolygonKind = 'star' | 'cross' | 'hexagon';

const RAD = Math.PI / 180;

/** A 5-pointed star pointing up: 10 vertices alternating outer (`size`) and inner (`size * starInnerRatio`) radius. */
const starPoints = (size: number): Point[] =>
    Array.from({ length: 10 }, (_, k) => {
        const angle = (-90 + 36 * k) * RAD;
        const r = k % 2 === 0 ? size : size * PARAMS.starInnerRatio;
        return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
    });

/** A plus sign: the union of a horizontal and a vertical bar, as one 12-vertex outline. */
const crossPoints = (size: number): Point[] => {
    const a = size;
    const w = size * PARAMS.crossArmRatio;
    return [
        [-w, -a], [w, -a], [w, -w], [a, -w], [a, w], [w, w],
        [w, a], [-w, a], [-w, w], [-a, w], [-a, -w], [-w, -w],
    ].map(([x, y]) => ({ x, y }));
};

/** A regular hexagon with vertices left and right and horizontal top and bottom edges. */
const hexagonPoints = (size: number): Point[] =>
    Array.from({ length: 6 }, (_, k) => ({ x: Math.cos(60 * k * RAD) * size, y: Math.sin(60 * k * RAD) * size }));

/** Outline of a polygon shape around (0, 0); every vertex lies inside the square of side `2 * size`. */
export const polygonPoints = (kind: PolygonKind, size: number): Point[] => {
    if (kind === 'star') return starPoints(size);
    if (kind === 'cross') return crossPoints(size);
    return hexagonPoints(size);
};
