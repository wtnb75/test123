import { PARAMS } from '../params';
import type { Point } from './layout';
import { Rng, between, shuffle } from './random';

export type ShapeKind = 'circle' | 'rect' | 'triangle';
export type DiffKind = 'color' | 'move' | 'size' | 'missing' | 'added' | 'shape';

export interface Shape {
    kind: ShapeKind;
    x: number;
    y: number;
    size: number;
    hue: number;
    sat: number;
    light: number;
}

/** A difference and its hit circle (panel-local coordinates). */
export interface Diff {
    kind: DiffKind;
    index: number;
    x: number;
    y: number;
    r: number;
}

export interface Dot {
    x: number;
    y: number;
    r: number;
}

export interface Stage {
    stage: number;
    /** The shape set both pictures are built from (before the differences are applied). */
    shapes: Shape[];
    /** Indexed like the shape set; null where an 'added' shape is not drawn in the left picture. */
    left: (Shape | null)[];
    /** Aligned with `left` by index; null where a 'missing' shape is not drawn in the right picture. */
    right: (Shape | null)[];
    diffs: Diff[];
    bgHue: number;
    dots: Dot[];
}

const SHAPE_KINDS: ShapeKind[] = ['circle', 'rect', 'triangle'];
const DIFF_KINDS: DiffKind[] = ['color', 'move', 'size', 'missing', 'added', 'shape'];
const ANGLE_TRIES = 16;

export const clampStage = (stage: number): number => Math.min(Math.max(Math.round(stage), 1), PARAMS.stageCount);

const makeShapes = (rng: Rng, count: number, sizeMax: number): Shape[] => {
    const shapes: Shape[] = [];
    const pad = sizeMax + PARAMS.shapePadding;
    for (let tries = 0; shapes.length < count && tries < PARAMS.placeAttemptsMax; tries++) {
        const size = between(rng, PARAMS.shapeSizeMin, sizeMax);
        const x = between(rng, pad, PARAMS.panelSize - pad);
        const y = between(rng, pad, PARAMS.panelSize - pad);
        const spaced = shapes.every((s) => Math.hypot(s.x - x, s.y - y) > (s.size + size) * PARAMS.overlapFactor);
        if (!spaced) continue;
        shapes.push({
            kind: SHAPE_KINDS[Math.floor(rng() * SHAPE_KINDS.length)],
            x,
            y,
            size,
            hue: Math.floor(rng() * 360),
            sat: between(rng, PARAMS.shapeSat.min, PARAMS.shapeSat.max),
            light: between(rng, PARAMS.shapeLight.min, PARAMS.shapeLight.max),
        });
    }
    return shapes;
};

const makeDots = (rng: Rng): Dot[] =>
    Array.from({ length: PARAMS.bgDots }, () => ({
        x: rng() * PARAMS.panelSize,
        y: rng() * PARAMS.panelSize,
        r: between(rng, PARAMS.bgDotRadius.min, PARAMS.bgDotRadius.max),
    }));

const fitsPanel = (x: number, y: number, size: number): boolean =>
    x - size >= 0 && x + size <= PARAMS.panelSize && y - size >= 0 && y + size <= PARAMS.panelSize;

interface Proposal {
    diff: Diff;
    /** The shape as the right picture shows it; null = not drawn there ('missing'). */
    dst: Shape | null;
    /** 'added': the shape is not drawn in the left picture (it exists only in the right one). */
    hideLeft?: boolean;
}

const sign = (rng: Rng): number => (rng() < 0.5 ? -1 : 1);

/** Picks a direction that keeps the moved shape inside the panel; falls back to heading for the centre. */
const moveTarget = (src: Shape, dist: number, rng: Rng): Point => {
    for (let i = 0; i < ANGLE_TRIES; i++) {
        const ang = rng() * Math.PI * 2;
        const x = src.x + Math.cos(ang) * dist;
        const y = src.y + Math.sin(ang) * dist;
        if (fitsPanel(x, y, src.size)) return { x, y };
    }
    const c = PARAMS.panelSize / 2;
    const ang = Math.atan2(c - src.y, c - src.x);
    return { x: src.x + Math.cos(ang) * dist, y: src.y + Math.sin(ang) * dist };
};

const propose = (si: number, index: number, src: Shape, rng: Rng): Proposal => {
    const kind = DIFF_KINDS[Math.floor(rng() * DIFF_KINDS.length)];
    const margin = PARAMS.hitMargin;
    if (kind === 'color') {
        const hue = (src.hue + PARAMS.hueShift[si] * sign(rng) + 360) % 360;
        return { dst: { ...src, hue }, diff: { kind, index, x: src.x, y: src.y, r: src.size + margin } };
    }
    if (kind === 'move') {
        const dist = PARAMS.moveDist[si];
        const to = moveTarget(src, dist, rng);
        return {
            dst: { ...src, x: to.x, y: to.y },
            diff: { kind, index, x: (src.x + to.x) / 2, y: (src.y + to.y) / 2, r: src.size + margin + dist / 2 },
        };
    }
    if (kind === 'size') {
        let size = src.size * (1 + PARAMS.scaleDelta[si] * sign(rng));
        if (!fitsPanel(src.x, src.y, size)) size = src.size * (1 - PARAMS.scaleDelta[si]);
        return {
            dst: { ...src, size },
            diff: { kind, index, x: src.x, y: src.y, r: Math.max(src.size, size) + margin },
        };
    }
    if (kind === 'added') {
        // the mirror of 'missing': the right picture keeps the shape as it is, the left one does not draw it
        return { dst: { ...src }, hideLeft: true, diff: { kind, index, x: src.x, y: src.y, r: src.size + margin } };
    }
    if (kind === 'shape') {
        // only the form changes, to one of the other two kinds; the bounding square (2 * size) stays the same
        const others = SHAPE_KINDS.filter((k) => k !== src.kind);
        const swapped = others[Math.floor(rng() * others.length)];
        return { dst: { ...src, kind: swapped }, diff: { kind, index, x: src.x, y: src.y, r: src.size + margin } };
    }
    return { dst: null, diff: { kind, index, x: src.x, y: src.y, r: src.size + margin } };
};

const apart = (a: Diff, b: Diff): boolean => Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r;

/** Differences wanted at a stage: the table value, but never more than there are shapes. */
const wantedDiffs = (si: number, shapeCount: number): number => Math.min(PARAMS.diffCounts[si], shapeCount);

const buildPicture = (stage: number, rng: Rng): Stage => {
    const si = stage - 1;
    const shapes = makeShapes(rng, PARAMS.shapeCounts[si], PARAMS.shapeSizeMax[si]);
    const left: (Shape | null)[] = shapes.map((s) => ({ ...s }));
    const right: (Shape | null)[] = shapes.map((s) => ({ ...s }));
    const diffs: Diff[] = [];
    const want = wantedDiffs(si, shapes.length);
    for (const index of shuffle(shapes.map((_, i) => i), rng)) {
        if (diffs.length >= want) break;
        const p = propose(si, index, shapes[index], rng);
        if (!diffs.every((d) => apart(d, p.diff))) continue;
        right[index] = p.dst;
        if (p.hideLeft) left[index] = null;
        diffs.push(p.diff);
    }
    const bgHue = Math.floor(rng() * 360);
    return { stage, shapes, left, right, diffs, bgHue, dots: makeDots(rng) };
};

/**
 * Builds the pictures of one stage from `rng`. Differences are chosen so their hit circles never overlap;
 * when too few fit, the whole picture is rebuilt (up to `regenMax` times) and the best attempt is kept.
 */
export const generateStage = (stage: number, rng: Rng): Stage => {
    const s = clampStage(stage);
    let best = buildPicture(s, rng);
    for (let i = 1; i <= PARAMS.regenMax && best.diffs.length < wantedDiffs(s - 1, best.left.length); i++) {
        const next = buildPicture(s, rng);
        if (next.diffs.length > best.diffs.length) best = next;
    }
    return best;
};
