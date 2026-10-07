import { afterEach, describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { clampStage, generateStage } from './generate';
import type { Diff, Shape, Stage } from './generate';
import { mulberry32 } from './random';

// enough seeds that every rare case (e.g. an enlargement that would leave the panel) occurs in the checks below
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);
const STAGES = [1, 2, 3, 4, 5];
const PS = PARAMS.panelSize;

const hueDistance = (a: number, b: number) => {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
};

/** Independent oracle for the hit circle of a difference (spec "判定円" table). */
const expectedCircle = (stage: number, l: Shape, r: Shape | null, kind: Diff['kind']) => {
    const margin = PARAMS.hitMargin;
    if (kind === 'move' && r) {
        return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2, r: l.size + margin + PARAMS.moveDist[stage - 1] / 2 };
    }
    if (kind === 'size' && r) return { x: l.x, y: l.y, r: Math.max(l.size, r.size) + margin };
    // colour, missing, added and shape (form change) all use the shape's own centre and size + hitMargin
    return { x: l.x, y: l.y, r: l.size + margin };
};

const eachStage = (fn: (s: Stage, stage: number, seed: number) => void) => {
    for (const stage of STAGES) for (const seed of SEEDS) fn(generateStage(stage, mulberry32(seed)), stage, seed);
};

describe('clampStage', () => {
    it('clamps to 1-5 and rounds', () => {
        expect(clampStage(0)).toBe(1);
        expect(clampStage(-3)).toBe(1);
        expect(clampStage(6)).toBe(5);
        expect(clampStage(3.4)).toBe(3);
        expect(clampStage(4)).toBe(4);
    });
});

describe('parameter tables', () => {
    it('have one entry per stage', () => {
        for (const t of [
            PARAMS.shapeCounts,
            PARAMS.shapeSizeMax,
            PARAMS.diffCounts,
            PARAMS.timeLimits,
            PARAMS.hueShift,
            PARAMS.moveDist,
            PARAMS.scaleDelta,
        ]) {
            expect(t).toHaveLength(PARAMS.stageCount);
        }
    });

    it('make later stages harder: smaller changes, lower difference share, less time', () => {
        for (let i = 1; i < PARAMS.stageCount; i++) {
            expect(PARAMS.hueShift[i]).toBeLessThan(PARAMS.hueShift[i - 1]);
            expect(PARAMS.moveDist[i]).toBeLessThan(PARAMS.moveDist[i - 1]);
            expect(PARAMS.scaleDelta[i]).toBeLessThan(PARAMS.scaleDelta[i - 1]);
            expect(PARAMS.timeLimits[i]).toBeLessThan(PARAMS.timeLimits[i - 1]);
            expect(PARAMS.diffCounts[i]).toBeGreaterThan(PARAMS.diffCounts[i - 1]);
            expect(PARAMS.shapeCounts[i]).toBeGreaterThan(PARAMS.shapeCounts[i - 1]);
            const share = (k: number) => PARAMS.diffCounts[k] / PARAMS.shapeCounts[k];
            expect(share(i)).toBeLessThan(share(i - 1));
        }
        expect(PARAMS.diffCounts[0] / PARAMS.shapeCounts[0]).toBeCloseTo(0.25, 5);
        expect(PARAMS.diffCounts[4] / PARAMS.shapeCounts[4]).toBeCloseTo(7 / 36, 5);
    });
});

describe('generateStage: determinism', () => {
    it('builds the identical stage from the same seed', () => {
        for (const stage of STAGES) {
            expect(generateStage(stage, mulberry32(42))).toEqual(generateStage(stage, mulberry32(42)));
        }
    });

    it('builds a different picture from a different seed, at every stage', () => {
        for (const stage of STAGES) {
            expect(generateStage(stage, mulberry32(1))).not.toEqual(generateStage(stage, mulberry32(2)));
        }
    });

    it('clamps out-of-range stage numbers to the nearest end', () => {
        expect(generateStage(0, mulberry32(5))).toEqual(generateStage(1, mulberry32(5)));
        expect(generateStage(9, mulberry32(5))).toEqual(generateStage(5, mulberry32(5)));
        expect(generateStage(0, mulberry32(5)).stage).toBe(1);
        expect(generateStage(9, mulberry32(5)).stage).toBe(5);
    });
});

describe('generateStage: shapes', () => {
    it('places the stage shape count inside the panel margin with sizes in range', () => {
        eachStage((s, stage, seed) => {
            const max = PARAMS.shapeSizeMax[stage - 1];
            const pad = max + PARAMS.shapePadding;
            const shapes = s.shapes;
            if (shapes.length !== PARAMS.shapeCounts[stage - 1]) expect.fail(`count ${shapes.length} stage ${stage} seed ${seed}`);
            for (const sh of shapes) {
                const ok =
                    sh.x >= pad && sh.x <= PS - pad && sh.y >= pad && sh.y <= PS - pad &&
                    sh.size >= PARAMS.shapeSizeMin && sh.size <= max &&
                    sh.sat >= PARAMS.shapeSat.min && sh.sat <= PARAMS.shapeSat.max &&
                    sh.light >= PARAMS.shapeLight.min && sh.light <= PARAMS.shapeLight.max &&
                    Number.isInteger(sh.hue) && sh.hue >= 0 && sh.hue < 360;
                if (!ok) expect.fail(`shape out of range stage ${stage} seed ${seed}: ${JSON.stringify(sh)}`);
            }
        });
    });

    it('keeps centres apart by more than (r1 + r2) * overlapFactor, yet lets shapes overlap', () => {
        let overlapping = 0;
        eachStage((s, stage, seed) => {
            const shapes = s.shapes;
            for (let i = 0; i < shapes.length; i++) {
                for (let j = i + 1; j < shapes.length; j++) {
                    const a = shapes[i];
                    const b = shapes[j];
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d <= (a.size + b.size) * PARAMS.overlapFactor) expect.fail(`too close stage ${stage} seed ${seed}`);
                    if (d < a.size + b.size) overlapping++;
                }
            }
        });
        expect(overlapping).toBeGreaterThan(0);
    });

    it('uses all three shape kinds', () => {
        const kinds = new Set<string>();
        eachStage((s) => s.shapes.forEach((sh) => kinds.add(sh.kind)));
        expect([...kinds].sort()).toEqual(['circle', 'rect', 'triangle']);
    });

    it('builds the background hue and the decoration dots inside the panel', () => {
        eachStage((s, stage, seed) => {
            if (!Number.isInteger(s.bgHue) || s.bgHue < 0 || s.bgHue > 359) expect.fail(`bgHue ${s.bgHue}`);
            if (s.dots.length !== PARAMS.bgDots) expect.fail(`dots ${s.dots.length}`);
            for (const d of s.dots) {
                const ok =
                    d.x >= 0 && d.x <= PS && d.y >= 0 && d.y <= PS &&
                    d.r >= PARAMS.bgDotRadius.min && d.r <= PARAMS.bgDotRadius.max;
                if (!ok) expect.fail(`dot out of range stage ${stage} seed ${seed}`);
            }
        });
    });
});

describe('generateStage: differences', () => {
    it('creates exactly the stage difference count, with unique indices', () => {
        eachStage((s, stage, seed) => {
            if (s.diffs.length !== PARAMS.diffCounts[stage - 1]) expect.fail(`diffs ${s.diffs.length} stage ${stage} seed ${seed}`);
            if (new Set(s.diffs.map((d) => d.index)).size !== s.diffs.length) expect.fail(`dup index stage ${stage} seed ${seed}`);
        });
    });

    it('never lets two hit circles overlap, so one circle never covers two differences', () => {
        eachStage((s, stage, seed) => {
            for (let i = 0; i < s.diffs.length; i++) {
                for (let j = i + 1; j < s.diffs.length; j++) {
                    const a = s.diffs[i];
                    const b = s.diffs[j];
                    if (Math.hypot(a.x - b.x, a.y - b.y) <= a.r + b.r) expect.fail(`overlap stage ${stage} seed ${seed}`);
                }
            }
        });
    });

    it('changes exactly the shapes named by the differences, by exactly the stage amount, and nothing else', () => {
        const seen = { color: 0, move: 0, size: 0, missing: 0, added: 0, shape: 0, grown: 0, shrunk: 0, huePlus: 0, hueMinus: 0, hueWrapped: 0, forcedShrink: 0 };
        const quadrants = new Set<string>();
        const swaps = new Set<string>();
        eachStage((s, stage, seed) => {
            const si = stage - 1;
            const byIndex = new Map(s.diffs.map((d) => [d.index, d]));
            if (s.right.length !== s.left.length) expect.fail('right is not aligned with left');
            s.shapes.forEach((l, i) => {
                const r = s.right[i];
                const d = byIndex.get(i);
                const tag = `stage ${stage} seed ${seed} shape ${i}`;
                if (!d) {
                    if (JSON.stringify(r) !== JSON.stringify(l) || JSON.stringify(s.left[i]) !== JSON.stringify(l)) {
                        expect.fail(`untouched shape changed: ${tag}`);
                    }
                    return;
                }
                seen[d.kind]++;
                if (d.kind === 'added') {
                    // the mirror of 'missing': not drawn on the left, drawn unchanged on the right
                    if (s.left[i] !== null) expect.fail(`added shape is drawn on the left: ${tag}`);
                    if (JSON.stringify(r) !== JSON.stringify(l)) expect.fail(`added shape changed on the right: ${tag}`);
                } else if (JSON.stringify(s.left[i]) !== JSON.stringify(l)) {
                    // every other kind leaves the left picture exactly as the shape set (only the right changes)
                    expect.fail(`the left picture differs from the shape set for a ${d.kind} difference: ${tag}`);
                }
                const c = expectedCircle(stage, l, r, d.kind);
                if (Math.abs(c.x - d.x) > 1e-9 || Math.abs(c.y - d.y) > 1e-9 || Math.abs(c.r - d.r) > 1e-9) {
                    expect.fail(`hit circle mismatch (${d.kind}): ${tag}`);
                }
                if (d.kind === 'missing') {
                    if (r !== null) expect.fail(`missing shape still drawn: ${tag}`);
                    return;
                }
                if (d.kind === 'added') return; // checked above against the shape set: absent on the left, unchanged on the right
                if (!r) expect.fail(`unexpectedly missing: ${tag}`);
                const rr = r as Shape;
                const same = (k: keyof Shape) => rr[k] === l[k];
                if (d.kind === 'color') {
                    if (!(same('x') && same('y') && same('size') && same('kind'))) expect.fail(`color diff moved shape: ${tag}`);
                    if (Math.abs(hueDistance(rr.hue, l.hue) - PARAMS.hueShift[si]) > 1e-9) expect.fail(`hue shift wrong: ${tag}`);
                    const signed = ((rr.hue - l.hue + 540) % 360) - 180;
                    if (signed > 0) seen.huePlus++;
                    else seen.hueMinus++;
                    if (l.hue + signed >= 360 || l.hue + signed < 0) seen.hueWrapped++;
                } else if (d.kind === 'move') {
                    if (!(same('hue') && same('size') && same('kind'))) expect.fail(`move diff changed look: ${tag}`);
                    if (Math.abs(Math.hypot(rr.x - l.x, rr.y - l.y) - PARAMS.moveDist[si]) > 1e-9) expect.fail(`move distance wrong: ${tag}`);
                    quadrants.add(`${Math.sign(rr.x - l.x)},${Math.sign(rr.y - l.y)}`);
                } else if (d.kind === 'shape') {
                    // only the form changes: a kind different from the original; position, radius and colour stay
                    if (rr.kind === l.kind) expect.fail(`shape diff kept the kind: ${tag}`);
                    if (!(same('x') && same('y') && same('size') && same('hue') && same('sat') && same('light'))) {
                        expect.fail(`shape diff changed more than the kind: ${tag}`);
                    }
                    swaps.add(`${l.kind}->${rr.kind}`);
                } else {
                    if (!(same('hue') && same('x') && same('y') && same('kind'))) expect.fail(`size diff changed look: ${tag}`);
                    const ratio = rr.size / l.size;
                    const up = 1 + PARAMS.scaleDelta[si];
                    const down = 1 - PARAMS.scaleDelta[si];
                    const grownFits = l.x - l.size * up >= 0 && l.x + l.size * up <= PS && l.y - l.size * up >= 0 && l.y + l.size * up <= PS;
                    if (Math.abs(ratio - up) < 1e-9) seen.grown++;
                    else if (Math.abs(ratio - down) < 1e-9) {
                        seen.shrunk++;
                        if (!grownFits) seen.forcedShrink++;
                    }
                    else expect.fail(`size ratio ${ratio}: ${tag}`);
                }
                if (r && !(rr.x - rr.size >= 0 && rr.x + rr.size <= PS && rr.y - rr.size >= 0 && rr.y + rr.size <= PS)) {
                    expect.fail(`changed shape leaves the panel: ${tag}`);
                }
            });
        });
        // guard against vacuous runs: every kind and both size directions occurred
        for (const [k, v] of Object.entries(seen)) expect(v, k).toBeGreaterThan(0);
        expect(quadrants.size).toBeGreaterThanOrEqual(4);
        expect([...swaps].sort()).toEqual([
            'circle->rect', 'circle->triangle', 'rect->circle', 'rect->triangle', 'triangle->circle', 'triangle->rect',
        ]);
    });
});

describe('generateStage: shares of the six difference kinds', () => {
    it('shows all six kinds, each between 8% and 25% of the chosen differences (300 sets x 5 stages)', () => {
        const counts: Record<string, number> = { color: 0, move: 0, size: 0, missing: 0, added: 0, shape: 0 };
        let total = 0;
        for (let seed = 1; seed <= 300; seed++) {
            for (const stage of STAGES) {
                for (const d of generateStage(stage, mulberry32(seed)).diffs) {
                    counts[d.kind]++;
                    total++;
                }
            }
        }
        // the lowest share is allowed to be low: movement circles are the largest, so overlapping candidates drop them most
        for (const [kind, n] of Object.entries(counts)) {
            const share = n / total;
            if (n === 0 || share < 0.08 || share > 0.25) expect.fail(`${kind} share ${(share * 100).toFixed(1)}%`);
        }
        expect(Object.keys(counts)).toHaveLength(6);
    });

    it('swaps each shape kind to either of the other two about half of the time (300 sets x 5 stages)', () => {
        const swaps: Record<string, number> = {};
        for (let seed = 1; seed <= 300; seed++) {
            for (const stage of STAGES) {
                const s = generateStage(stage, mulberry32(seed));
                for (const d of s.diffs) {
                    if (d.kind !== 'shape') continue;
                    const key = `${(s.left[d.index] as Shape).kind}->${(s.right[d.index] as Shape).kind}`;
                    swaps[key] = (swaps[key] ?? 0) + 1;
                }
            }
        }
        const kinds = ['circle', 'rect', 'triangle'];
        for (const from of kinds) {
            const targets = kinds.filter((k) => k !== from);
            const [a, b] = targets.map((to) => swaps[`${from}->${to}`] ?? 0);
            const share = a / (a + b);
            if (a === 0 || b === 0 || share < 0.35 || share > 0.65) expect.fail(`${from}: ${targets[0]} ${a} vs ${targets[1]} ${b}`);
        }
        expect(Object.keys(swaps)).toHaveLength(6);
    });

    it('draws a shape in the left picture unless it was added, and in the right unless it was missing (counts by hand)', () => {
        let bothDirections = 0;
        for (let seed = 1; seed <= 300; seed++) {
            for (const stage of STAGES) {
                const s = generateStage(stage, mulberry32(seed));
                const total = PARAMS.shapeCounts[stage - 1];
                const added = s.diffs.filter((d) => d.kind === 'added').length;
                const missing = s.diffs.filter((d) => d.kind === 'missing').length;
                const drawnLeft = s.left.filter((x) => x !== null).length;
                const drawnRight = s.right.filter((x) => x !== null).length;
                if (drawnLeft !== total - added) expect.fail(`left drawn ${drawnLeft} vs ${total - added}: stage ${stage} seed ${seed}`);
                if (drawnRight !== total - missing) expect.fail(`right drawn ${drawnRight} vs ${total - missing}: stage ${stage} seed ${seed}`);
                if (added > 0 && missing > 0) bothDirections++;
            }
        }
        expect(bothDirections).toBeGreaterThan(0); // a picture can have a missing and an added shape at once
    });

    it('lets every stage produce every kind (spec: any kind can appear at every stage)', () => {
        for (const stage of STAGES) {
            const kinds = new Set<string>();
            for (let seed = 1; seed <= 300; seed++) for (const d of generateStage(stage, mulberry32(seed)).diffs) kinds.add(d.kind);
            expect([...kinds].sort(), `stage ${stage}`).toEqual(['added', 'color', 'missing', 'move', 'shape', 'size']);
        }
    });
});

describe('generateStage: regeneration', () => {
    const table = PARAMS.diffCounts as unknown as number[];
    const regen = PARAMS as unknown as { regenMax: number };
    const shapes = PARAMS.shapeCounts as unknown as number[];
    const original = { diff0: table[0], shapes0: shapes[0], regenMax: regen.regenMax };

    afterEach(() => {
        table[0] = original.diff0;
        shapes[0] = original.shapes0;
        regen.regenMax = original.regenMax;
    });

    it('rebuilds the picture when too few differences fit and keeps the best attempt', () => {
        table[0] = 12; // every shape would need to differ: not reachable with disjoint circles
        let improved = 0;
        for (const seed of SEEDS.slice(0, 30)) {
            regen.regenMax = 0;
            const first = generateStage(1, mulberry32(seed));
            regen.regenMax = original.regenMax;
            const best = generateStage(1, mulberry32(seed));
            expect(best.diffs.length).toBeLessThan(12);
            expect(best.diffs.length).toBeGreaterThanOrEqual(first.diffs.length);
            if (best.diffs.length > first.diffs.length) improved++;
        }
        expect(improved).toBeGreaterThan(0);
    });

    it('makes one build plus regenMax rebuilds, keeping the first build that has the most differences', () => {
        table[0] = 12;
        const k = 3;
        let lastWon = 0;
        for (const seed of SEEDS.slice(0, 60)) {
            regen.regenMax = 0;
            const shared = mulberry32(seed);
            const builds = Array.from({ length: k + 1 }, () => generateStage(1, shared));
            let best = builds[0];
            for (const b of builds) if (b.diffs.length > best.diffs.length) best = b;
            if (best === builds[k] && builds[k].diffs.length > builds[k - 1].diffs.length) lastWon++;
            regen.regenMax = k;
            expect(generateStage(1, mulberry32(seed))).toEqual(best);
        }
        expect(lastWon).toBeGreaterThan(0);
    });

    it('does not rebuild when the picture has fewer shapes than the wanted differences but every shape differs', () => {
        shapes[0] = 1;
        table[0] = 3; // more differences than shapes can ever exist
        const count = (regenMax: number) => {
            regen.regenMax = regenMax;
            let calls = 0;
            const base = mulberry32(21);
            const stage = generateStage(1, () => (calls++, base()));
            return { calls, diffs: stage.diffs.length };
        };
        const single = count(0);
        expect(single.diffs).toBe(1);
        expect(count(original.regenMax)).toEqual(single);
    });

    it('stops rebuilding as soon as the wanted number of differences is reached', () => {
        let calls = 0;
        const base = mulberry32(8);
        generateStage(1, () => {
            calls++;
            return base();
        });
        let oneBuild = 0;
        const base2 = mulberry32(8);
        regen.regenMax = 0;
        generateStage(1, () => {
            oneBuild++;
            return base2();
        });
        expect(calls).toBe(oneBuild);
    });
});

describe('generateStage: moves that cannot fit', () => {
    const dist = PARAMS.moveDist as unknown as number[];
    const regen = PARAMS as unknown as { regenMax: number };
    const original = { dist: dist[0], regenMax: regen.regenMax };

    afterEach(() => {
        dist[0] = original.dist;
        regen.regenMax = original.regenMax;
    });

    it('heads for the panel centre when no random direction keeps the shape inside', () => {
        dist[0] = 500; // longer than the panel: no random direction can fit
        regen.regenMax = 0; // such huge circles leave one difference per picture; keep the first build
        let checked = 0;
        for (const seed of SEEDS) {
            const s = generateStage(1, mulberry32(seed));
            for (const d of s.diffs) {
                if (d.kind !== 'move') continue;
                const l = s.left[d.index] as Shape; // only 'added' differences leave the left picture without the shape
                const r = s.right[d.index] as Shape;
                const inside = r.x - r.size >= 0 && r.x + r.size <= PS && r.y - r.size >= 0 && r.y + r.size <= PS;
                const toward = Math.atan2(PS / 2 - l.y, PS / 2 - l.x);
                const fx = l.x + Math.cos(toward) * 500;
                const fy = l.y + Math.sin(toward) * 500;
                const isFallback = Math.abs(r.x - fx) < 1e-9 && Math.abs(r.y - fy) < 1e-9;
                if (!inside && !isFallback) expect.fail(`seed ${seed}: neither inside nor centre-bound`);
                if (isFallback) checked++;
            }
        }
        expect(checked).toBeGreaterThan(0);
    });
});
