import { describe, expect, it } from 'vitest';
import {
    arrowFor,
    arrowFromPoint,
    arrowPulseScale,
    arrowTriangle,
    arrowVisible,
    hasArrow,
    popArrowVisible,
} from './arrow';
import { apply, IDENTITY, rotY, spun, type Mat3 } from './math';
import { popIn, SHAPE, seeded } from './testing';

const O = { x: 270, y: 480 };

describe('arrowFromPoint (ring 242, O = (270, 480))', () => {
    it('puts a hole behind-right on the right ring, pointing left', () => {
        const a = arrowFromPoint([0.5, 0, -0.87], O);
        expect(a.pos).toEqual({ x: 512, y: 480 });
        expect(a.dir).toEqual({ x: -1, y: 0 });
    });

    it('puts a hole behind-above at the top of the ring, pointing down', () => {
        const a = arrowFromPoint([0, -0.5, -0.87], O);
        expect(a.pos).toEqual({ x: 270, y: 238 });
        expect(a.dir).toEqual({ x: 0, y: 1 });
    });

    it('puts a diagonal hole on the diagonal of the ring, pointing back at the centre', () => {
        const a = arrowFromPoint([0.3, 0.3, -0.9], O);
        expect(a.pos.x).toBeCloseTo(270 + 0.7071068 * 242, 3);
        expect(a.pos.y).toBeCloseTo(480 + 0.7071068 * 242, 3);
        expect(a.dir.x).toBeCloseTo(-0.7071068, 6);
        expect(a.dir.y).toBeCloseTo(-0.7071068, 6);
    });

    it('sits directly below the centre pointing up when the hole is straight behind (below 0.05)', () => {
        const a = arrowFromPoint([0.01, 0.02, -1], O);
        expect(a.pos).toEqual({ x: 270, y: 722 });
        expect(a.dir).toEqual({ x: 0, y: -1 });
    });

    it('uses the normal direction at exactly 0.05 from the pole', () => {
        const a = arrowFromPoint([0.05, 0, -1], O);
        expect(a.pos).toEqual({ x: 512, y: 480 });
        expect(a.dir).toEqual({ x: -1, y: 0 });
    });
});

describe('arrowTriangle', () => {
    it('has its tip 22 ahead and its base 12 behind, 16 to each side', () => {
        const [tip, b1, b2] = arrowTriangle({ pos: { x: 100, y: 200 }, dir: { x: 0, y: 1 } });
        expect(tip).toEqual({ x: 100, y: 222 });
        expect(b1).toEqual({ x: 84, y: 188 });
        expect(b2).toEqual({ x: 116, y: 188 });
    });

    it('rotates with the direction (pointing left)', () => {
        const [tip, b1, b2] = arrowTriangle({ pos: { x: 100, y: 200 }, dir: { x: -1, y: 0 } });
        expect(tip).toEqual({ x: 78, y: 200 });
        expect(b1.x).toBe(112);
        expect(b2.x).toBe(112);
        expect(Math.abs(b1.y - b2.y)).toBe(32);
    });
});

describe('arrowPulseScale (1.15 at most, period 1.0 s)', () => {
    it.each([
        [0, 1.0],
        [0.25, 1.075],
        [0.5, 1.15],
        [0.75, 1.075],
        [1.0, 1.0],
        [1.5, 1.15],
        [10.5, 1.15],
    ])('after %f s of play the arrow is %f times its size', (elapsed, expected) => {
        expect(arrowPulseScale(elapsed)).toBeCloseTo(expected, 9);
    });

    it('never leaves 1.0 – 1.15', () => {
        for (let t = 0; t < 5; t += 0.037) {
            const s = arrowPulseScale(t);
            if (s < 1 - 1e-12 || s > 1.15 + 1e-12) expect.fail(`t=${t}: ${s}`);
        }
    });
});

describe('arrowTriangle scaled about the arrow position', () => {
    it('grows tip, back and half-width by the factor and keeps the position fixed', () => {
        const [tip, b1, b2] = arrowTriangle({ pos: { x: 100, y: 200 }, dir: { x: 0, y: 1 } }, 2);
        expect(tip).toEqual({ x: 100, y: 244 });
        expect(b1).toEqual({ x: 68, y: 176 });
        expect(b2).toEqual({ x: 132, y: 176 });
    });
});

describe('arrowVisible (blinks below 0.6 s left)', () => {
    it.each([
        [1.0, true],
        [0.6, true],
        [0.59, false],
        [0.49, true],
        [0.37, false],
        [0.4, true], // floor(3.2) = 3, odd
        [0.3, false], // floor(2.4) = 2, even
        [0.05, false],
    ])('%f s left → visible = %s', (remaining, expected) => {
        expect(arrowVisible(remaining)).toBe(expected);
    });

    it('follows the Pop age (life 2.2)', () => {
        expect(popArrowVisible(popIn(0, 'mole', 1.0))).toBe(true);
        expect(popArrowVisible(popIn(0, 'mole', 1.61))).toBe(false);
    });
});

describe('hasArrow', () => {
    it('gives an arrow to a mole on a hidden face only', () => {
        expect(hasArrow(popIn(0, 'mole'), IDENTITY)).toBe(true); // +X, edge-on (z = 0)
        expect(hasArrow(popIn(49, 'mole'), IDENTITY)).toBe(true); // -Z, behind
        expect(hasArrow(popIn(40, 'mole'), IDENTITY)).toBe(false); // +Z, in front
    });

    it('follows the pose: turned by -π/2 about Y, the +X mole is in front and the +Z mole is edge-on (hidden)', () => {
        const turned = rotY(-Math.PI / 2);
        expect(hasArrow(popIn(4, 'mole'), turned)).toBe(false);
        expect(hasArrow(popIn(40, 'mole'), turned)).toBe(true);
    });

    it('never gives a plain cat an arrow', () => {
        expect(hasArrow(popIn(49, 'cat'), IDENTITY)).toBe(false);
        expect(hasArrow(popIn(0, 'cat', 1, false), IDENTITY)).toBe(false);
    });

    it('gives a decoy cat on a hidden face the same arrow as a mole', () => {
        expect(hasArrow(popIn(0, 'cat', 1, true), IDENTITY)).toBe(true); // +X, edge-on (z = 0)
        expect(hasArrow(popIn(49, 'cat', 1, true), IDENTITY)).toBe(true); // -Z, behind
        const decoy = arrowFor(popIn(49, 'cat', 1, true), IDENTITY, O);
        expect(decoy).toEqual(arrowFor(popIn(49, 'mole'), IDENTITY, O));
    });

    it('gives a decoy cat on a visible face no arrow', () => {
        expect(hasArrow(popIn(40, 'cat', 1, true), IDENTITY)).toBe(false); // +Z, in front
        const turned = rotY(-Math.PI / 2);
        expect(hasArrow(popIn(4, 'cat', 1, true), turned)).toBe(false);
        expect(hasArrow(popIn(40, 'cat', 1, true), turned)).toBe(true);
    });

    it('blinks a decoy arrow exactly like a mole arrow', () => {
        for (const age of [0, 1.5, 1.6, 1.7, 1.8, 2.0, 2.19]) {
            expect(popArrowVisible(popIn(49, 'cat', age, true))).toBe(popArrowVisible(popIn(49, 'mole', age)));
        }
    });
});

describe('arrowFor', () => {
    it('reads the hole centre through the pose', () => {
        // Identity pose: hole 49 (-Z face, middle) is straight behind → below the centre, pointing up.
        const a = arrowFor(popIn(49), IDENTITY, O);
        expect(a.pos).toEqual({ x: 270, y: 722 });
    });
});

describe('swiping along the arrow brings the hole round to the front', () => {
    it('raises the rotated z of every hole that is behind, over random poses', () => {
        const rng = seeded(11);
        let m: Mat3 = IDENTITY;
        let checked = 0;
        for (let i = 0; i < 200; i++) {
            m = spun(m, (rng() - 0.5) * 3, (rng() - 0.5) * 3);
            for (const hole of SHAPE.holes) {
                const p = apply(m, hole.center);
                if (p[2] >= 0) continue; // only holes behind the cube
                const { dir } = arrowFromPoint(p, O);
                const after = apply(spun(m, dir.x * 0.1, dir.y * 0.1), hole.center);
                if (!(after[2] > p[2])) expect.fail(`pose ${i}, hole ${hole.id}: z ${p[2]} → ${after[2]}`);
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(1000);
    });
});
