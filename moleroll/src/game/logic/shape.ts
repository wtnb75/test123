// The solid as a list of faces with holes (docs/spec.md "Game の盤面"). Rendering, spawning, hit tests
// and arrows read only this, so another shape can be added without touching them.
import { HOLES_PER_SIDE, HOLE_SPACING } from '../params';
import { add, type Plane, type Vec3 } from './math';

export interface Hole extends Plane {
    readonly id: number;
    readonly faceIndex: number;
    /** The two tangents of the face, and the hole's centre (solid-local coordinates). */
    readonly u: Vec3;
    readonly v: Vec3;
    readonly center: Vec3;
}

export interface Face extends Plane {
    readonly u: Vec3;
    readonly v: Vec3;
    /** The face outline, in drawing order. */
    readonly corners: readonly Vec3[];
}

export interface Shape {
    readonly faces: readonly Face[];
    readonly holes: readonly Hole[];
}

function axis(i: number, sign = 1): Vec3 {
    const a = [0, 0, 0];
    a[i] = sign;
    return a as unknown as Vec3;
}

const CORNER_SIGNS: readonly (readonly [number, number])[] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
];

/** The cube: faces +X, -X, +Y, -Y, +Z, -Z, each with HOLES_PER_SIDE² holes in row-major order. */
export function buildCube(): Shape {
    const faces: Face[] = [];
    const holes: Hole[] = [];
    for (let k = 0; k < 3; k++) {
        for (const sign of [1, -1]) {
            const normal = axis(k, sign);
            const u = axis((k + 1) % 3);
            const v = axis((k + 2) % 3);
            const faceIndex = faces.length;
            const corners = CORNER_SIGNS.map(([a, b]) => add(add(normal, u, a), v, b));
            faces.push({ normal, d: 1, u, v, corners });
            for (let row = 0; row < HOLES_PER_SIDE; row++) {
                for (let col = 0; col < HOLES_PER_SIDE; col++) {
                    const a = (col - (HOLES_PER_SIDE - 1) / 2) * HOLE_SPACING;
                    const b = (row - (HOLES_PER_SIDE - 1) / 2) * HOLE_SPACING;
                    const center = add(add(normal, u, a), v, b);
                    holes.push({ id: holes.length, faceIndex, normal, d: 1, u, v, center });
                }
            }
        }
    }
    return { faces, holes };
}
