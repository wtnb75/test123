import { describe, expect, it } from 'vitest';
import { findHit, popScreen } from './hit';
import { IDENTITY, rotY } from './math';
import type { Pop } from './pop';
import { popIn } from './testing';

const O = { x: 270, y: 480 };

describe('findHit (identity pose: the +Z face is in front)', () => {
    it('hits the middle +Z Pop (hole 40, fully out) at the screen centre', () => {
        expect(findHit([popIn(40)], IDENTITY, 270, 480, O)).toBe(0);
    });

    it('puts hole 37 about 94.98 px above the centre (lifted 0.3, scale factor 6/4.7)', () => {
        const s = popScreen(popIn(37), IDENTITY, O);
        expect(s.x).toBe(270);
        expect(s.y).toBeCloseTo(480 - 0.62 * 120 * (6 / 4.7), 6);
    });

    it('hits at exactly the hit radius (32 px) and misses just beyond it', () => {
        const s = popScreen(popIn(37), IDENTITY, O);
        expect(findHit([popIn(37)], IDENTITY, s.x + 32, s.y, O)).toBe(0);
        expect(findHit([popIn(37)], IDENTITY, s.x + 32.1, s.y, O)).toBe(-1);
    });

    it('follows the pose: turned by -π/2 about Y, the +X face (hole 4) is in front and +Z is edge-on', () => {
        // Ry(-π/2): x' = -z, z' = x. The lifted point of hole 4 is (1.3, 0, 0) → (0, 0, 1.3): at the centre.
        const turned = rotY(-Math.PI / 2);
        expect(findHit([popIn(4)], turned, 270, 480, O)).toBe(0);
        expect(findHit([popIn(40)], turned, 270, 480, O)).toBe(-1);
        expect(findHit([popIn(4)], IDENTITY, 270, 480, O)).toBe(-1);
    });

    it('misses when there is no Pop', () => {
        expect(findHit([], IDENTITY, 270, 480, O)).toBe(-1);
    });

    it('ignores a Pop on a face that is not seen, even right under the tap', () => {
        // Hole 49 (-Z face) lifted projects behind the centre, to (270, 480) as well.
        expect(findHit([popIn(49)], IDENTITY, 270, 480, O)).toBe(-1);
    });

    it('ignores a Pop that is not out far enough yet', () => {
        expect(findHit([popIn(40, 'mole', 0.05)], IDENTITY, 270, 480, O)).toBe(-1);
    });

    it('takes the Pop nearest the viewer when two overlap on screen', () => {
        const base = popIn(40);
        const near: Pop = { ...base, hole: { ...base.hole, id: 40, center: [0, 0, 1] } };
        const far: Pop = { ...base, hole: { ...base.hole, id: 41, center: [0, 0, 0.5] } };
        expect(findHit([far, near], IDENTITY, 270, 480, O)).toBe(1);
        expect(findHit([near, far], IDENTITY, 270, 480, O)).toBe(0);
    });

    it('takes the smaller hole id when two overlapping Pops are equally near', () => {
        const base = popIn(40);
        const a: Pop = { ...base, hole: { ...base.hole, id: 7 } };
        const b: Pop = { ...base, hole: { ...base.hole, id: 3 } };
        expect(findHit([a, b], IDENTITY, 270, 480, O)).toBe(1);
        expect(findHit([b, a], IDENTITY, 270, 480, O)).toBe(0);
    });
});
