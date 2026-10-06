// Pure game rules (no Phaser imports) so they can be ported to the real implementation.
import { PARAMS } from './params';

export type Rng = () => number;

export type ShapeKind = 'circle' | 'rect' | 'triangle';
export type DiffKind = 'color' | 'move' | 'size' | 'missing';

export interface Shape {
    kind: ShapeKind;
    x: number;
    y: number;
    size: number;
    hue: number; // 0-359
    sat: number;
    light: number;
}

export interface Diff {
    kind: DiffKind;
    index: number;
    x: number; // hit centre (panel-local)
    y: number;
    r: number; // hit radius
}

export interface Dot {
    x: number;
    y: number;
    r: number;
}

export interface Stage {
    left: Shape[];
    right: Shape[];
    diffs: Diff[];
    bgHue: number;
    dots: Dot[]; // background decoration, identical on both panels (never a difference)
}

export interface Layout {
    width: number;
    height: number;
    panels: [{ x: number; y: number }, { x: number; y: number }];
    hud: { x: number; y: number };
    msg: { x: number; y: number };
}

export const layoutFor = (portrait: boolean): Layout => {
    const ps = PARAMS.panelSize;
    const gap = PARAMS.panelGap;
    if (portrait) {
        const { width, height } = PARAMS.portrait;
        const x = (width - ps) / 2;
        const top = 150;
        return {
            width,
            height,
            panels: [{ x, y: top }, { x, y: top + ps + 40 }],
            hud: { x: width / 2, y: 50 },
            msg: { x: width / 2, y: 105 },
        };
    }
    const { width, height } = PARAMS.landscape;
    const x0 = (width - ps * 2 - gap) / 2;
    const y = 200;
    return {
        width,
        height,
        panels: [{ x: x0, y }, { x: x0 + ps + gap, y }],
        hud: { x: width / 2, y: 50 },
        msg: { x: width / 2, y: 120 },
    };
};

export const mulberry32 = (seed: number): Rng => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

export const hslToHex = (h: number, s: number, l: number): number => {
    const hh = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + hh / 30) % 12;
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    const to = (v: number) => Math.round(v * 255);
    return (to(f(0)) << 16) | (to(f(8)) << 8) | to(f(4));
};

const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

const KINDS: ShapeKind[] = ['circle', 'rect', 'triangle'];
const DIFF_KINDS: DiffKind[] = ['color', 'move', 'size', 'missing'];

const makeShapes = (rng: Rng, count: number, sizeMax: number): Shape[] => {
    const shapes: Shape[] = [];
    const pad = sizeMax + 20;
    for (let tries = 0; shapes.length < count && tries < 4000; tries++) {
        const size = between(rng, PARAMS.shapeSizeMin, sizeMax);
        const x = between(rng, pad, PARAMS.panelSize - pad);
        const y = between(rng, pad, PARAMS.panelSize - pad);
        // shapes may overlap, but centres stay apart so each difference is attributable
        const clear = shapes.every((s) => Math.hypot(s.x - x, s.y - y) > (s.size + size) * PARAMS.overlapFactor);
        if (!clear) continue;
        shapes.push({
            kind: KINDS[Math.floor(rng() * KINDS.length)],
            x,
            y,
            size,
            hue: Math.floor(rng() * 360),
            sat: between(rng, 0.55, 0.9),
            light: between(rng, 0.4, 0.6),
        });
    }
    return shapes;
};

const shuffle = <T>(arr: T[], rng: Rng): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const hitRadius = (s: Shape) => s.size + PARAMS.hitMargin;

/** Picks shapes to alter so that no two hit circles overlap (one click never covers two differences). */
export const pickSeparated = (shapes: Shape[], count: number, rng: Rng): number[] => {
    const picks: number[] = [];
    for (const i of shuffle(shapes.map((_, k) => k), rng)) {
        if (picks.length >= count) break;
        const a = shapes[i];
        const apart = picks.every((j) => {
            const b = shapes[j];
            return Math.hypot(a.x - b.x, a.y - b.y) > hitRadius(a) + hitRadius(b);
        });
        if (apart) picks.push(i);
    }
    return picks;
};

export const generateStage =(stage: number, rng: Rng): Stage => {
    const si = Math.min(Math.max(stage, 1), PARAMS.stageCount) - 1;
    const left = makeShapes(rng, PARAMS.shapeCounts[si], PARAMS.shapeSizeMax[si]);
    const right: (Shape | null)[] = left.map((s) => ({ ...s }));
    const diffs: Diff[] = [];
    const count = Math.min(PARAMS.diffCounts[si], left.length);
    const picks = pickSeparated(left, count, rng);
    for (const index of picks) {
        const kind = DIFF_KINDS[Math.floor(rng() * DIFF_KINDS.length)];
        const src = left[index];
        const dst = right[index] as Shape;
        if (kind === 'color') {
            dst.hue = (src.hue + PARAMS.hueShift[si] * (rng() < 0.5 ? -1 : 1) + 360) % 360;
        } else if (kind === 'move') {
            const ang = rng() * Math.PI * 2;
            dst.x = src.x + Math.cos(ang) * PARAMS.moveDist[si];
            dst.y = src.y + Math.sin(ang) * PARAMS.moveDist[si];
        } else if (kind === 'size') {
            dst.size = src.size * (1 + PARAMS.scaleDelta[si] * (rng() < 0.5 ? -1 : 1));
        } else {
            right[index] = null;
        }
        diffs.push({ kind, index, x: src.x, y: src.y, r: src.size + PARAMS.hitMargin });
    }
    const bgHue = Math.floor(rng() * 360);
    const dots: Dot[] = Array.from({ length: PARAMS.bgDots }, () => ({
        x: rng() * PARAMS.panelSize,
        y: rng() * PARAMS.panelSize,
        r: between(rng, 8, 26),
    }));
    return { left, right: right.filter((s): s is Shape => s !== null), diffs, bgHue, dots };
};

/** Returns the index (into diffs) of an unfound difference hit by the click, or -1. */
export const judgeClick = (diffs: Diff[], found: ReadonlySet<number>, x: number, y: number): number => {
    for (let i = 0; i < diffs.length; i++) {
        if (found.has(i)) continue;
        if (Math.hypot(diffs[i].x - x, diffs[i].y - y) <= diffs[i].r) return i;
    }
    return -1;
};
