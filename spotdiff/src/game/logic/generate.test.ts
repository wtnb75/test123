import { afterEach, describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { clampStage, diffKindsAt, generateStage, shiftColor, shiftLight } from './generate';
import type { Diff, Shape, Stage } from './generate';
import { mulberry32 } from './random';

// enough seeds that every rare case (e.g. an enlargement that would leave the panel) occurs in the checks below
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);
const STAGES = [1, 2, 3, 4, 5];
const PS = PARAMS.panelSize;

/** Spec "図形の種類", written out by hand per stage (index = stage). */
const STAGE_KINDS: Record<number, string[]> = {
    1: ['circle', 'rect', 'triangle'],
    2: ['circle', 'rect', 'triangle', 'star'],
    3: ['circle', 'rect', 'triangle', 'star', 'cross'],
    4: ['circle', 'rect', 'triangle', 'star', 'cross', 'hexagon'],
    5: ['circle', 'rect', 'triangle', 'star', 'cross', 'hexagon'],
};

/** Every ordered pair (from -> to) of different kinds of a stage. */
const swapPairs = (stage: number): string[] =>
    STAGE_KINDS[stage].flatMap((a) => STAGE_KINDS[stage].filter((b) => b !== a).map((b) => `${a}->${b}`)).sort();

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
    // colour, tone, missing, added and shape (form change) all use the shape's own centre and size + hitMargin
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
        // spec/tone-diff.md: the tone shift also shrinks from stage 3 to 5, and stays within what always fits the lightness range
        expect(PARAMS.toneFromStage).toBe(3);
        expect(PARAMS.toneDelta).toEqual([0, 0, 0.22, 0.18, 0.15]);
        for (let i = 3; i < PARAMS.stageCount; i++) expect(PARAMS.toneDelta[i]).toBeLessThan(PARAMS.toneDelta[i - 1]);
        for (const d of PARAMS.toneDelta) expect(d).toBeLessThanOrEqual(0.3);
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

    // Spec "図形の種類": stage 1 circle/rect/triangle, +star at 2, +cross at 3, +hexagon at 4 and 5 (written out by hand).
    it('draws only the kinds of the stage and every one of them (stage 1: 3 kinds, 2: +star, 3: +cross, 4-5: +hexagon)', () => {
        const seen = new Map<number, Set<string>>(STAGES.map((st) => [st, new Set<string>()]));
        eachStage((s, stage) => s.shapes.forEach((sh) => seen.get(stage)?.add(sh.kind)));
        for (const st of STAGES) expect([...(seen.get(st) as Set<string>)].sort(), `stage ${st}`).toEqual(STAGE_KINDS[st].slice().sort());
    });

    it('draws the kinds of a stage about equally often (within 5 points of 1 / kinds)', () => {
        for (const st of STAGES) {
            const counts = new Map<string, number>();
            let total = 0;
            for (const seed of SEEDS) {
                for (const sh of generateStage(st, mulberry32(seed)).shapes) {
                    counts.set(sh.kind, (counts.get(sh.kind) ?? 0) + 1);
                    total++;
                }
            }
            const even = 1 / STAGE_KINDS[st].length;
            for (const kind of STAGE_KINDS[st]) {
                const share = (counts.get(kind) ?? 0) / total;
                if (Math.abs(share - even) > 0.05) expect.fail(`stage ${st} ${kind} share ${(share * 100).toFixed(1)}%`);
            }
        }
    });

    it('uses the kinds of stage 1 and stage 5 for out-of-range stage numbers', () => {
        for (const seed of SEEDS.slice(0, 40)) {
            for (const sh of generateStage(0, mulberry32(seed)).shapes) expect(STAGE_KINDS[1]).toContain(sh.kind);
        }
        const kinds = new Set<string>();
        for (const seed of SEEDS.slice(0, 40)) generateStage(9, mulberry32(seed)).shapes.forEach((sh) => kinds.add(sh.kind));
        expect([...kinds].sort()).toEqual(STAGE_KINDS[5].slice().sort());
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
        const seen = {
            color: 0, move: 0, size: 0, missing: 0, added: 0, shape: 0, tone: 0, grown: 0, shrunk: 0, huePlus: 0, hueMinus: 0, hueWrapped: 0, forcedShrink: 0,
            toneUp: 0, toneDown: 0, toneEdgeOnly: 0,
        };
        const colorSigns = new Set<string>();
        const quadrants = new Set<string>();
        const swaps = new Map<number, Set<string>>(STAGES.map((st) => [st, new Set<string>()]));
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
                    if (!(same('x') && same('y') && same('size') && same('kind') && same('sat'))) expect.fail(`color diff changed more than hue and lightness: ${tag}`);
                    if (Math.abs(hueDistance(rr.hue, l.hue) - PARAMS.hueShift[si]) > 1e-9) expect.fail(`hue shift wrong: ${tag}`);
                    // spec/tone-diff.md: the lightness moves by colorLightShift too (and stays inside the shape range 0.4-0.6 +- 0.12)
                    if (Math.abs(Math.abs(rr.light - l.light) - PARAMS.colorLightShift) > 1e-9) expect.fail(`colour lightness shift wrong: ${tag}`);
                    if (rr.light < 0.28 - 1e-9 || rr.light > 0.72 + 1e-9) expect.fail(`colour lightness out of range: ${tag}`);
                    const signed = ((rr.hue - l.hue + 540) % 360) - 180;
                    if (signed > 0) seen.huePlus++;
                    else seen.hueMinus++;
                    colorSigns.add(`${signed > 0 ? '+' : '-'}${rr.light > l.light ? '+' : '-'}`);
                    if (l.hue + signed >= 360 || l.hue + signed < 0) seen.hueWrapped++;
                } else if (d.kind === 'tone') {
                    if (stage < PARAMS.toneFromStage) expect.fail(`tone diff before stage ${PARAMS.toneFromStage}: ${tag}`);
                    if (!(same('x') && same('y') && same('size') && same('kind') && same('hue') && same('sat'))) expect.fail(`tone diff changed more than lightness: ${tag}`);
                    if (Math.abs(Math.abs(rr.light - l.light) - PARAMS.toneDelta[si]) > 1e-9) expect.fail(`tone shift wrong: ${tag}`);
                    if (rr.light < PARAMS.toneLightMin - 1e-9 || rr.light > PARAMS.toneLightMax + 1e-9) expect.fail(`tone lightness out of range: ${tag}`);
                    if (rr.light > l.light) seen.toneUp++;
                    else seen.toneDown++;
                    // shapes near an end of 0.4-0.6 can only move one way (the other would leave [0.2, 0.8]); whether the
                    // asked direction was turned around is pinned by the shiftLight tests, not visible in the output here
                    const delta = PARAMS.toneDelta[si];
                    if (l.light - delta < PARAMS.toneLightMin - 1e-9 && rr.light > l.light) seen.toneEdgeOnly++;
                    if (l.light + delta > PARAMS.toneLightMax + 1e-9 && rr.light < l.light) seen.toneEdgeOnly++;
                } else if (d.kind === 'move') {
                    if (!(same('hue') && same('size') && same('kind'))) expect.fail(`move diff changed look: ${tag}`);
                    if (Math.abs(Math.hypot(rr.x - l.x, rr.y - l.y) - PARAMS.moveDist[si]) > 1e-9) expect.fail(`move distance wrong: ${tag}`);
                    quadrants.add(`${Math.sign(rr.x - l.x)},${Math.sign(rr.y - l.y)}`);
                } else if (d.kind === 'shape') {
                    // only the form changes: a kind different from the original; position, radius and colour stay
                    if (rr.kind === l.kind) expect.fail(`shape diff kept the kind: ${tag}`);
                    if (!STAGE_KINDS[stage].includes(rr.kind)) expect.fail(`shape diff went to a kind the stage does not have: ${tag}`);
                    if (!(same('x') && same('y') && same('size') && same('hue') && same('sat') && same('light'))) {
                        expect.fail(`shape diff changed more than the kind: ${tag}`);
                    }
                    swaps.get(stage)?.add(`${l.kind}->${rr.kind}`);
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
        // spec/tone-diff.md: the hue sign and the lightness sign of a colour difference are independent, so all four pairs occur
        expect([...colorSigns].sort()).toEqual(['++', '+-', '-+', '--']);
        // spec: a form change goes to a kind of that stage other than the original, and every such pair occurs
        // (stage 1: 6 pairs, 2: 12, 3: 20, 4 and 5: 30)
        const expectedCounts = [6, 12, 20, 30, 30];
        STAGES.forEach((st, i) => {
            expect(swapPairs(st), `stage ${st} pair count`).toHaveLength(expectedCounts[i]);
            expect([...(swaps.get(st) as Set<string>)].sort(), `stage ${st}`).toEqual(swapPairs(st));
        });
    });
});

describe('generateStage: shares of the difference kinds', () => {
    it('shows all seven kinds, each between 8% and 25% of the chosen differences (300 sets x 5 stages)', () => {
        const counts: Record<string, number> = { color: 0, move: 0, size: 0, missing: 0, added: 0, shape: 0, tone: 0 };
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
        expect(Object.keys(counts)).toHaveLength(7);
    });

    it('gives the tone kind 8-25% of the differences at each of stages 3-5 and none at stages 1-2 (300 sets)', () => {
        for (const stage of STAGES) {
            let tone = 0;
            let total = 0;
            for (let seed = 1; seed <= 300; seed++) {
                for (const d of generateStage(stage, mulberry32(seed)).diffs) {
                    total++;
                    if (d.kind === 'tone') tone++;
                }
            }
            const share = tone / total;
            if (stage < PARAMS.toneFromStage) expect(tone, `stage ${stage}`).toBe(0);
            else if (share < 0.08 || share > 0.25) expect.fail(`stage ${stage} tone share ${(share * 100).toFixed(1)}%`);
        }
    });

    it('at stage 1, swaps each shape kind to either of the other two about half of the time (1500 sets)', () => {
        const swaps: Record<string, number> = {};
        for (let seed = 1; seed <= 1500; seed++) {
            const s = generateStage(1, mulberry32(seed));
            for (const d of s.diffs) {
                if (d.kind !== 'shape') continue;
                const key = `${(s.left[d.index] as Shape).kind}->${(s.right[d.index] as Shape).kind}`;
                swaps[key] = (swaps[key] ?? 0) + 1;
            }
        }
        const kinds = STAGE_KINDS[1];
        for (const from of kinds) {
            const targets = kinds.filter((k) => k !== from);
            const [a, b] = targets.map((to) => swaps[`${from}->${to}`] ?? 0);
            const share = a / (a + b);
            if (a === 0 || b === 0 || share < 0.35 || share > 0.65) expect.fail(`${from}: ${targets[0]} ${a} vs ${targets[1]} ${b}`);
        }
        expect(Object.keys(swaps)).toHaveLength(6);
    });

    it('at stage 5, swaps each shape kind to each of the five other kinds about equally often (2000 sets)', () => {
        const kinds = STAGE_KINDS[5];
        const swaps: Record<string, number> = {};
        for (let seed = 1; seed <= 2000; seed++) {
            const s = generateStage(5, mulberry32(seed));
            for (const d of s.diffs) {
                if (d.kind !== 'shape') continue;
                const key = `${(s.left[d.index] as Shape).kind}->${(s.right[d.index] as Shape).kind}`;
                swaps[key] = (swaps[key] ?? 0) + 1;
            }
        }
        // spec: equal probability among the other kinds of the stage, so each target gets 1/5 of a kind's swaps
        for (const from of kinds) {
            const counts = kinds.filter((k) => k !== from).map((to) => swaps[`${from}->${to}`] ?? 0);
            const sum = counts.reduce((a, b) => a + b, 0);
            counts.forEach((n, i) => {
                const share = n / sum;
                if (sum < 300 || Math.abs(share - 0.2) > 0.07) expect.fail(`${from}: target ${i} share ${(share * 100).toFixed(1)}% of ${sum}`);
            });
        }
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

    it('lets every stage produce every kind it has (six kinds at stages 1-2, plus tone at stages 3-5)', () => {
        for (const stage of STAGES) {
            const kinds = new Set<string>();
            for (let seed = 1; seed <= 300; seed++) for (const d of generateStage(stage, mulberry32(seed)).diffs) kinds.add(d.kind);
            const six = ['added', 'color', 'missing', 'move', 'shape', 'size'];
            expect([...kinds].sort(), `stage ${stage}`).toEqual(stage >= 3 ? [...six, 'tone'] : six);
        }
    });
});

describe('shiftLight (spec/tone-diff.md, hand-worked values)', () => {
    const MIN = 0.2;
    const MAX = 0.8;

    it('moves the lightness by delta in the asked direction when the result stays in range', () => {
        expect(shiftLight(0.5, 0.22, 1, MIN, MAX)).toBeCloseTo(0.72, 12);
        expect(shiftLight(0.5, 0.22, -1, MIN, MAX)).toBeCloseTo(0.28, 12);
        expect(shiftLight(0.4, 0.15, -1, MIN, MAX)).toBeCloseTo(0.25, 12);
    });

    it('turns around when the asked direction would leave the range', () => {
        expect(shiftLight(0.41, 0.22, -1, MIN, MAX)).toBeCloseTo(0.63, 12); // 0.41 - 0.22 = 0.19 < 0.2
        expect(shiftLight(0.59, 0.22, 1, MIN, MAX)).toBeCloseTo(0.37, 12); // 0.59 + 0.22 = 0.81 > 0.8
    });

    it('accepts a result exactly on the range edge, despite floating point error', () => {
        expect(0.42 - 0.22).toBeLessThan(0.2); // 0.19999999999999998: the epsilon is what keeps this one in range
        expect(shiftLight(0.42, 0.22, -1, MIN, MAX)).toBeCloseTo(0.2, 12);
        expect(shiftLight(0.58, 0.22, 1, MIN, MAX)).toBeCloseTo(0.8, 12);
    });

    it('turns around just past the edge (outside the 1e-9 tolerance)', () => {
        expect(shiftLight(0.42 - 1e-6, 0.22, -1, MIN, MAX)).toBeCloseTo(0.64 - 1e-6, 12);
        expect(shiftLight(0.58 + 1e-6, 0.22, 1, MIN, MAX)).toBeCloseTo(0.36 + 1e-6, 12);
    });

    it('has a tone delta exactly from the first tone stage on, and a direction that always fits the parameter ranges', () => {
        PARAMS.toneDelta.forEach((d, si) => {
            if ((d > 0) !== (si + 1 >= PARAMS.toneFromStage)) expect.fail(`toneDelta[${si}] = ${d} vs toneFromStage ${PARAMS.toneFromStage}`);
        });
        // down fits for light >= min + d and up for light <= max - d: they cover every lightness when d <= (max - min) / 2
        const reach = (PARAMS.toneLightMax - PARAMS.toneLightMin) / 2;
        for (const d of PARAMS.toneDelta) expect(d).toBeLessThanOrEqual(reach + 1e-9);
    });

    it('always keeps some direction in range for every lightness of a shape and every tone delta', () => {
        for (let light = PARAMS.shapeLight.min; light <= PARAMS.shapeLight.max + 1e-9; light += 0.005) {
            for (const delta of PARAMS.toneDelta.filter((d) => d > 0)) {
                for (const sign of [-1, 1]) {
                    const out = shiftLight(light, delta, sign, PARAMS.toneLightMin, PARAMS.toneLightMax);
                    if (out < MIN - 1e-9 || out > MAX + 1e-9 || Math.abs(Math.abs(out - light) - delta) > 1e-9) {
                        expect.fail(`light ${light} delta ${delta} sign ${sign} -> ${out}`);
                    }
                }
            }
        }
    });
});

describe('shiftColor (spec/tone-diff.md, hand-worked values)', () => {
    it('moves the lightness by 0.12 in the asked direction and leaves it inside 0.28-0.72 for shapes of 0.4-0.6', () => {
        expect(shiftColor({ hue: 100, light: 0.5 }, 55, 0.12, 1, 1).light).toBeCloseTo(0.62, 12);
        expect(shiftColor({ hue: 100, light: 0.5 }, 55, 0.12, 1, -1).light).toBeCloseTo(0.38, 12);
        expect(shiftColor({ hue: 100, light: 0.4 }, 55, 0.12, 1, -1).light).toBeCloseTo(0.28, 12);
        expect(shiftColor({ hue: 100, light: 0.4 }, 55, 0.12, 1, 1).light).toBeCloseTo(0.52, 12);
        expect(shiftColor({ hue: 100, light: 0.6 }, 55, 0.12, 1, -1).light).toBeCloseTo(0.48, 12);
        expect(shiftColor({ hue: 100, light: 0.6 }, 55, 0.12, 1, 1).light).toBeCloseTo(0.72, 12);
    });

    it('moves the hue independently of the lightness sign, wrapping around 0 and 360', () => {
        expect(shiftColor({ hue: 100, light: 0.5 }, 55, 0.12, 1, -1).hue).toBe(155);
        expect(shiftColor({ hue: 100, light: 0.5 }, 55, 0.12, -1, 1).hue).toBe(45);
        expect(shiftColor({ hue: 20, light: 0.5 }, 30, 0.12, -1, 1).hue).toBe(350);
        expect(shiftColor({ hue: 350, light: 0.5 }, 30, 0.12, 1, 1).hue).toBe(20);
    });
});

describe('diffKindsAt', () => {
    it('has the six original kinds at stages 1-2 and adds tone from stage 3', () => {
        const six = ['color', 'move', 'size', 'missing', 'added', 'shape'];
        expect(diffKindsAt(0)).toEqual(six);
        expect(diffKindsAt(1)).toEqual(six);
        expect(diffKindsAt(2)).toEqual([...six, 'tone']);
        expect(diffKindsAt(4)).toEqual([...six, 'tone']);
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
