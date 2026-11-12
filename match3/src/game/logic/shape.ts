// Stone silhouettes (docs/spec.md "石の形"): which shape a colour has, its outline, and where the marks of a
// line / bomb stone and the highlight go so that they stay inside it. Pure: no Phaser, no randomness, no time.
// Coordinates are texture pixels: a CELL x CELL square, x to the right, y down.
import {
    CELL,
    GEM_INSET,
    GEM_SHINE_OFFSET,
    GEM_SHINE_RADIUS,
    MARK_BAR_MIN,
    MARK_LENGTH,
    MARK_OUTLINE,
    MARK_RING_MIN,
    MARK_RING_RADIUS,
    MARK_THICKNESS,
    SHAPE_BOX,
} from '../params';
import type { Kind } from './board';

export type Shape = 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon' | 'star';
export interface Pt {
    x: number;
    y: number;
}
/** A line stone's bar (the rectangle without its dark outline) or a bomb stone's ring (without its outline). */
export type Mark =
    | { type: 'bar'; x: number; y: number; w: number; h: number }
    | { type: 'ring'; x: number; y: number; r: number };
export interface Shine {
    x: number;
    y: number;
    r: number;
}

/** The shape of each colour, in the order of `COLOR.gems` (red, blue, green, yellow, purple, orange). */
export const SHAPES: readonly Shape[] = ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'star'];

const MID = CELL / 2;
const CIRCLE_R = MID - GEM_INSET;
const CIRCLE_STEPS = 48;
const SQUARE_SIDE = 32;
const SQUARE_CORNER = 6;
const CORNER_STEPS = 6;
const STAR_OUTER = SHAPE_BOX / 2;
const STAR_INNER = 12;

/** The shape of a colour number; the colour stone (no colour) and anything out of range are round. */
export function gemShape(color: number): Shape {
    return SHAPES[color] ?? 'circle';
}

const polar = (cx: number, cy: number, r: number, deg: number): Pt => ({
    x: cx + r * Math.cos((deg * Math.PI) / 180),
    y: cy + r * Math.sin((deg * Math.PI) / 180),
});

function roundedSquare(): Pt[] {
    const half = SQUARE_SIDE / 2 - SQUARE_CORNER;
    const pts: Pt[] = [];
    // Corners clockwise from the top right, each an arc around its own centre.
    const corners = [
        { cx: MID + half, cy: MID - half, from: -90 },
        { cx: MID + half, cy: MID + half, from: 0 },
        { cx: MID - half, cy: MID + half, from: 90 },
        { cx: MID - half, cy: MID - half, from: 180 },
    ];
    for (const { cx, cy, from } of corners) {
        for (let i = 0; i <= CORNER_STEPS; i++) pts.push(polar(cx, cy, SQUARE_CORNER, from + (90 * i) / CORNER_STEPS));
    }
    return pts;
}

function triangle(): Pt[] {
    const height = (SHAPE_BOX * Math.sqrt(3)) / 2;
    const top = MID - height / 2;
    return [
        { x: MID, y: top },
        { x: MID + SHAPE_BOX / 2, y: top + height },
        { x: MID - SHAPE_BOX / 2, y: top + height },
    ];
}

function star(): Pt[] {
    const pts: Pt[] = [];
    for (let i = 0; i < 10; i++) pts.push(polar(MID, MID, i % 2 === 0 ? STAR_OUTER : STAR_INNER, -90 + 36 * i));
    return pts;
}

/** The outline of a shape as a polygon (a circle and rounded corners are approximated), clockwise on screen. */
export function shapeOutline(shape: Shape): Pt[] {
    switch (shape) {
        case 'circle':
            return Array.from({ length: CIRCLE_STEPS }, (_, i) => polar(MID, MID, CIRCLE_R, -90 + (360 * i) / CIRCLE_STEPS));
        case 'square':
            return roundedSquare();
        case 'triangle':
            return triangle();
        case 'diamond':
            return [
                { x: MID, y: MID - SHAPE_BOX / 2 },
                { x: MID + SHAPE_BOX / 2, y: MID },
                { x: MID, y: MID + SHAPE_BOX / 2 },
                { x: MID - SHAPE_BOX / 2, y: MID },
            ];
        case 'hexagon':
            return Array.from({ length: 6 }, (_, i) => polar(MID, MID, SHAPE_BOX / 2, -90 + 60 * i));
        case 'star':
            return star();
    }
}

/** The area of a polygon (the shoelace formula). */
export function polygonArea(pts: readonly Pt[]): number {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
}

/** The mean of the vertices: the centre of every shape here, and the centroid of the triangle. */
export function outlineCenter(pts: readonly Pt[]): Pt {
    const n = pts.length;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
}

/** Whether a point is inside a polygon (a point on the edge may count either way). */
export function insidePolygon(p: Pt, pts: readonly Pt[]): boolean {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i];
        const b = pts[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}

const RING_SAMPLES = 32;
const EDGE_SAMPLES = 8;

/** The points to test for "a mark with its dark outline is inside the shape": a rectangle's edges, or a ring's rim. */
function markPoints(mark: Mark): Pt[] {
    if (mark.type === 'ring') {
        const outer = mark.r + MARK_THICKNESS / 2 + MARK_OUTLINE;
        return Array.from({ length: RING_SAMPLES }, (_, i) => polar(mark.x, mark.y, outer, (360 * i) / RING_SAMPLES));
    }
    const x0 = mark.x - MARK_OUTLINE;
    const y0 = mark.y - MARK_OUTLINE;
    const x1 = mark.x + mark.w + MARK_OUTLINE;
    const y1 = mark.y + mark.h + MARK_OUTLINE;
    const pts: Pt[] = [];
    for (let i = 0; i <= EDGE_SAMPLES; i++) {
        const t = i / EDGE_SAMPLES;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        pts.push({ x, y: y0 }, { x, y: y1 }, { x: x0, y }, { x: x1, y });
    }
    return pts;
}

/** Whether a mark, with its dark outline, lies inside the outline of a shape. */
export function markFits(mark: Mark, outline: readonly Pt[]): boolean {
    return markPoints(mark).every((p) => insidePolygon(p, outline));
}

/** Where marks and the highlight are centred: the centroid of the shape (the middle of the cell for all but the triangle). */
export function shapeAnchor(shape: Shape): Pt {
    return shape === 'triangle' ? outlineCenter(shapeOutline('triangle')) : { x: MID, y: MID };
}

/**
 * The mark of a line / bomb stone on a shape, centred on the shape's anchor and as large as fits inside it
 * (the base size of a round stone first, then smaller down to MARK_BAR_MIN / MARK_RING_MIN). A normal or colour
 * stone has none.
 */
export function markSpec(shape: Shape, kind: Kind): Mark | null {
    if (kind !== 'lineRow' && kind !== 'lineCol' && kind !== 'bomb') return null;
    const outline = shapeOutline(shape);
    const { x, y } = shapeAnchor(shape);
    if (kind === 'bomb') {
        let mark: Mark = { type: 'ring', x, y, r: MARK_RING_RADIUS };
        for (let r = MARK_RING_RADIUS; r >= MARK_RING_MIN; r--) {
            mark = { type: 'ring', x, y, r };
            if (markFits(mark, outline)) break;
        }
        return mark;
    }
    const make = (len: number): Mark =>
        kind === 'lineRow'
            ? { type: 'bar', x: x - len / 2, y: y - MARK_THICKNESS / 2, w: len, h: MARK_THICKNESS }
            : { type: 'bar', x: x - MARK_THICKNESS / 2, y: y - len / 2, w: MARK_THICKNESS, h: len };
    let mark = make(MARK_LENGTH);
    for (let len = MARK_LENGTH; len >= MARK_BAR_MIN; len--) {
        mark = make(len);
        if (markFits(mark, outline)) break;
    }
    return mark;
}

/**
 * The highlight: the round stone's (up and to the left of the centre) when it fits, otherwise moved towards the
 * anchor and then made smaller until the whole circle is inside the outline.
 */
export function shinePlacement(shape: Shape): Shine {
    const outline = shapeOutline(shape);
    const anchor = shapeAnchor(shape);
    const base = { x: MID - GEM_SHINE_OFFSET, y: MID - GEM_SHINE_OFFSET };
    const inside = (s: Shine) =>
        Array.from({ length: RING_SAMPLES }, (_, i) => polar(s.x, s.y, s.r, (360 * i) / RING_SAMPLES)).every((p) =>
            insidePolygon(p, outline),
        );
    for (let r = GEM_SHINE_RADIUS; r >= 2; r--) {
        for (let step = 0; step <= 10; step++) {
            const t = step / 10;
            const s = { x: base.x + (anchor.x - base.x) * t, y: base.y + (anchor.y - base.y) * t, r };
            if (inside(s)) return s;
        }
    }
    return { ...anchor, r: 2 };
}
