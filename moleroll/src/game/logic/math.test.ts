import { describe, expect, it } from 'vitest';
import {
    apply,
    dragRotation,
    IDENTITY,
    initialRotation,
    isFacing,
    isHiddenSide,
    mul,
    project,
    rotX,
    rotY,
    spun,
    type Mat3,
} from './math';
import { SHAPE, seeded } from './testing';

const close = (actual: readonly number[], expected: readonly number[], digits = 9) => {
    expect(actual).toHaveLength(expected.length);
    expected.forEach((e, i) => expect(actual[i]).toBeCloseTo(e, digits));
};

describe('rotation', () => {
    it('Ry(π/2) turns the front point (0,0,1) to +x and the +x point to behind (0,0,-1)', () => {
        close(apply(rotY(Math.PI / 2), [0, 0, 1]), [1, 0, 0]);
        close(apply(rotY(Math.PI / 2), [1, 0, 0]), [0, 0, -1]);
    });

    it('Rx(π/2) turns the front point (0,0,1) to +y (down)', () => {
        close(apply(rotX(Math.PI / 2), [0, 0, 1]), [0, 1, 0]);
    });

    it('turns a drag of dx px about Y and dy px about X at 0.01 rad per px', () => {
        expect(dragRotation(100, 0)).toEqual({ ay: 1, ax: 0 });
        expect(dragRotation(0, -50)).toEqual({ ay: 0, ax: -0.5 });
        const mixed = dragRotation(30, -20);
        expect(mixed.ay).toBeCloseTo(0.3, 9);
        expect(mixed.ax).toBeCloseTo(-0.2, 9);
    });

    it('a zero increment leaves the pose unchanged', () => {
        const m = initialRotation();
        close(spun(m, 0, 0), m);
    });

    it('applies the increment as Rx(ax) · Ry(ay) · R (hand-worked for ay = 0.5, ax = 0.3)', () => {
        // Ry(0.5)(0,0,1) = (0.4794, 0, 0.8776); Rx(0.3) then gives y = 0.8776 sin 0.3, z = 0.8776 cos 0.3.
        close(apply(spun(IDENTITY, 0.5, 0.3), [0, 0, 1]), [0.4794, 0.2593, 0.8384], 3);
        // The other order (Ry after Rx) lands elsewhere, so the order is pinned.
        const other = apply(mul(rotY(0.5), rotX(0.3)), [0, 0, 1]);
        expect(Math.abs(other[1] - 0.2593)).toBeGreaterThan(0.01);
    });

    it('keeps the columns unit length and orthogonal after 1000 random spins', () => {
        const rng = seeded(7);
        let m: Mat3 = initialRotation();
        for (let i = 0; i < 1000; i++) m = spun(m, (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.4);
        for (let a = 0; a < 3; a++) {
            for (let b = a; b < 3; b++) {
                const dot = m[a] * m[b] + m[3 + a] * m[3 + b] + m[6 + a] * m[6 + b];
                if (Math.abs(dot - (a === b ? 1 : 0)) > 1e-9) expect.fail(`columns ${a},${b}: dot ${dot}`);
            }
        }
    });

    it('starts in a pose where exactly three faces are seen', () => {
        const seen = SHAPE.faces.filter((f) => isFacing(initialRotation(), f));
        expect(seen).toHaveLength(3);
    });
});

describe('projection (O = (270, 480), scale 120, camera distance 6)', () => {
    const o = { x: 270, y: 480 };

    it('puts the centre at O', () => {
        expect(project([0, 0, 0], o)).toEqual({ x: 270, y: 480 });
    });

    it('does not scale a point at z = 0', () => {
        expect(project([1, 0, 0], o)).toEqual({ x: 390, y: 480 });
    });

    it('enlarges a near point by 6/5 and shrinks a far point by 6/7', () => {
        expect(project([1, 0, 1], o).x).toBeCloseTo(414, 9);
        expect(project([1, 0, -1], o).x).toBeCloseTo(372.857, 3);
        expect(project([0, -1, 1], o).y).toBeCloseTo(480 - 144, 9);
    });
});

describe('facing and hidden side', () => {
    const plane = { normal: [0, 0, 1] as const, d: 1 };
    const withZ = (z: number): Mat3 => [1, 0, 0, 0, 1, 0, 0, 0, z];

    it('sees a face only when its rotated normal z is above 1/6 (equal is not seen)', () => {
        expect(isFacing(withZ(0.17), plane)).toBe(true);
        expect(isFacing(withZ(1 / 6), plane)).toBe(false);
        expect(isFacing(withZ(0.16), plane)).toBe(false);
    });

    it('with the identity pose sees only the +Z face', () => {
        const seen = SHAPE.faces.map((f) => isFacing(IDENTITY, f));
        expect(seen).toEqual([false, false, false, false, true, false]);
    });

    it('calls a face hidden below z = 0.25 (0.25 itself is not hidden)', () => {
        expect(isHiddenSide(withZ(0.24), plane)).toBe(true);
        expect(isHiddenSide(withZ(0.25), plane)).toBe(false);
        expect(isHiddenSide(withZ(0.26), plane)).toBe(false);
    });
});
