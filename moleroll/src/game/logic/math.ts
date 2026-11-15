// Rotation and perspective projection (docs/spec.md "立方体の回し方", "Game の盤面").
import {
    CAMERA_DISTANCE,
    CUBE_SCALE_PX,
    DRAG_RAD_PER_PX,
    HIDDEN_NORMAL_Z,
    INITIAL_TILT_X,
    INITIAL_TURN_Y,
} from '../params';

export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];
export interface Point {
    x: number;
    y: number;
}
/** A plane of the solid: outward normal and the plane's distance from the centre along it. */
export interface Plane {
    readonly normal: Vec3;
    readonly d: number;
}

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul(a: Mat3, b: Mat3): Mat3 {
    const r: number[] = [];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
        }
    }
    return r as unknown as Mat3;
}

/** Rotation about the screen Y axis; a > 0 moves points in front to +x. */
export function rotY(a: number): Mat3 {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [c, 0, s, 0, 1, 0, -s, 0, c];
}

/** Rotation about the screen X axis; a > 0 moves points in front to +y (down). */
export function rotX(a: number): Mat3 {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [1, 0, 0, 0, c, s, 0, -s, c];
}

export function apply(m: Mat3, v: Vec3): Vec3 {
    return [
        m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
        m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
        m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
    ];
}

export function add(a: Vec3, b: Vec3, k = 1): Vec3 {
    return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
}

/** The pose a run starts in: R = Rx(tilt) · Ry(turn) (three faces visible). */
export function initialRotation(): Mat3 {
    return mul(rotX(INITIAL_TILT_X), rotY(INITIAL_TURN_Y));
}

/** Adds a drag/key increment (about the screen axes) on the left: R ← Rx(ax) · Ry(ay) · R. */
export function spun(m: Mat3, ay: number, ax: number): Mat3 {
    return mul(mul(rotX(ax), rotY(ay)), m);
}

/** A drag of (dx, dy) px turns the cube by ay = dx × DRAG_RAD_PER_PX about Y and ax = dy × DRAG_RAD_PER_PX about X. */
export function dragRotation(dx: number, dy: number): { ay: number; ax: number } {
    return { ay: dx * DRAG_RAD_PER_PX, ax: dy * DRAG_RAD_PER_PX };
}

/** Screen position of an already-rotated point; `o` is the screen position of the cube's centre. */
export function project(p: Vec3, o: Point): Point {
    const f = CAMERA_DISTANCE / (CAMERA_DISTANCE - p[2]);
    return { x: o.x + p[0] * CUBE_SCALE_PX * f, y: o.y + p[1] * CUBE_SCALE_PX * f };
}

/** The camera sees a plane's outer side when its rotated normal's z is above d / cameraDistance. */
export function isFacing(m: Mat3, plane: Plane): boolean {
    return apply(m, plane.normal)[2] > plane.d / CAMERA_DISTANCE;
}

/** "Hidden side" (arrow target, spawn side): the rotated normal's z is below HIDDEN_NORMAL_Z. */
export function isHiddenSide(m: Mat3, plane: Plane): boolean {
    return apply(m, plane.normal)[2] < HIDDEN_NORMAL_Z;
}
