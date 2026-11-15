import { describe, expect, it } from 'vitest';
import { SHAPE } from './testing';

const center = (id: number) => SHAPE.holes[id].center;

describe('cube shape', () => {
    it('has 6 faces and 54 holes numbered in face order, row-major', () => {
        expect(SHAPE.faces).toHaveLength(6);
        expect(SHAPE.holes).toHaveLength(54);
        SHAPE.holes.forEach((h, i) => {
            expect(h.id).toBe(i);
            expect(h.faceIndex).toBe(Math.floor(i / 9));
        });
    });

    it('places the hand-worked holes', () => {
        const expectCenter = (id: number, x: number, y: number, z: number) => {
            const c = center(id);
            expect(c[0]).toBeCloseTo(x, 9);
            expect(c[1]).toBeCloseTo(y, 9);
            expect(c[2]).toBeCloseTo(z, 9);
        };
        expectCenter(0, 1, -0.62, -0.62); // +X, row 0, col 0
        expectCenter(4, 1, 0, 0);
        expectCenter(8, 1, 0.62, 0.62);
        expectCenter(9, -1, -0.62, -0.62); // -X first
        expectCenter(18, -0.62, 1, -0.62); // +Y first (u = z, v = x)
        expectCenter(40, 0, 0, 1); // +Z middle
        expectCenter(53, 0.62, 0.62, -1); // -Z, row 2, col 2
    });

    it('puts every hole on its face plane (normal · centre = 1)', () => {
        for (const h of SHAPE.holes) {
            const dot = h.normal[0] * h.center[0] + h.normal[1] * h.center[1] + h.normal[2] * h.center[2];
            if (Math.abs(dot - 1) > 1e-9) expect.fail(`hole ${h.id}: ${dot}`);
        }
    });

    it('gives each face four corners on its plane and the faces its outward normals in order', () => {
        const normals = SHAPE.faces.map((f) => f.normal);
        expect(normals).toEqual([
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1],
        ]);
        for (const f of SHAPE.faces) {
            expect(f.corners).toHaveLength(4);
            for (const c of f.corners) expect(f.normal[0] * c[0] + f.normal[1] * c[1] + f.normal[2] * c[2]).toBeCloseTo(1, 9);
        }
    });
});
