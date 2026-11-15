// Pure game rules for the prototype (no Phaser imports): rotation math,
// cube hole layout, spawn selection, hit test and win/lose evaluation.
import { PARAMS } from './params';

export type Vec3 = [number, number, number];
export type Mat3 = [number, number, number, number, number, number, number, number, number];
export type Kind = 'mole' | 'cat';
export type Outcome = 'playing' | 'clear' | 'fail';

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul(a: Mat3, b: Mat3): Mat3 {
    const r = new Array<number>(9).fill(0);
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 3; k++) {
                r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
            }
        }
    }
    return r as Mat3;
}

// Rotation about the screen Y axis. Positive angle moves the front surface to +x.
export function rotY(a: number): Mat3 {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [c, 0, s, 0, 1, 0, -s, 0, c];
}

// Rotation about the screen X axis. Positive angle moves the front surface to +y (down).
export function rotX(b: number): Mat3 {
    const c = Math.cos(b);
    const s = Math.sin(b);
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

// Perspective projection: the camera sits on the +z axis at cameraDistance.
export function project(v: Vec3, scale: number, cx: number, cy: number): { x: number; y: number } {
    const f = PARAMS.cameraDistance / (PARAMS.cameraDistance - v[2]);
    return { x: cx + v[0] * scale * f, y: cy + v[1] * scale * f };
}

// Perspective: a face is seen only when its normal points to the camera
// (n . (camera - faceCenter) > 0  <=>  nz > 1 / cameraDistance).
export function isFacing(m: Mat3, normal: Vec3): boolean {
    return apply(m, normal)[2] > 1 / PARAMS.cameraDistance;
}

export interface Hole {
    id: number;
    normal: Vec3;
    u: Vec3;
    v: Vec3;
    center: Vec3;
}

function axis(i: number, sign = 1): Vec3 {
    const a: Vec3 = [0, 0, 0];
    a[i] = sign;
    return a;
}

export interface Face {
    normal: Vec3;
    u: Vec3;
    v: Vec3;
}

export function buildCubeFaces(): Face[] {
    const faces: Face[] = [];
    for (let k = 0; k < 3; k++) {
        for (const sign of [1, -1]) {
            faces.push({ normal: axis(k, sign), u: axis((k + 1) % 3), v: axis((k + 2) % 3) });
        }
    }
    return faces;
}

export function buildCubeHoles(): Hole[] {
    const holes: Hole[] = [];
    const n = PARAMS.holesPerSide;
    for (const f of buildCubeFaces()) {
        for (let row = 0; row < n; row++) {
            for (let col = 0; col < n; col++) {
                const a = (col - (n - 1) / 2) * PARAMS.holeSpacing;
                const b = (row - (n - 1) / 2) * PARAMS.holeSpacing;
                const center = add(add(f.normal, f.u, a), f.v, b);
                holes.push({ id: holes.length, normal: f.normal, u: f.u, v: f.v, center });
            }
        }
    }
    return holes;
}

export function faceZ(m: Mat3, normal: Vec3): number {
    return apply(m, normal)[2];
}

export function isHidden(m: Mat3, hole: Hole): boolean {
    return faceZ(m, hole.normal) < PARAMS.hiddenNormalZ;
}

export function pickKind(rng: () => number): Kind {
    return rng() < PARAMS.catRatio ? 'cat' : 'mole';
}

// Choose a free hole. With probability backSpawnRatio prefer a hidden-side hole.
export function pickHole(
    holes: Hole[],
    occupied: ReadonlySet<number>,
    m: Mat3,
    rng: () => number,
): Hole | null {
    const free = holes.filter((h) => !occupied.has(h.id));
    if (free.length === 0) return null;
    const wantBack = rng() < PARAMS.backSpawnRatio;
    const preferred = free.filter((h) => isHidden(m, h) === wantBack);
    const pool = preferred.length > 0 ? preferred : free;
    return pool[Math.floor(rng() * pool.length)];
}

// Height of the popping mole (0..popHeight) given its age and total life.
export function popHeight(age: number, life: number): number {
    const up = Math.min(1, age / PARAMS.popInSec);
    const down = Math.min(1, (life - age) / PARAMS.popOutSec);
    return PARAMS.popHeight * Math.max(0, Math.min(up, down));
}

export interface Target {
    hole: Hole;
    kind: Kind;
    age: number;
}

// Returns the index of the front-most hit target, or -1.
export function hitTest(
    targets: readonly Target[],
    m: Mat3,
    px: number,
    py: number,
    cx: number,
    cy: number,
): number {
    let best = -1;
    let bestZ = -Infinity;
    targets.forEach((t, i) => {
        if (!isFacing(m, t.hole.normal)) return;
        const h = popHeight(t.age, PARAMS.lifeSec);
        if (h < PARAMS.popHeight * 0.3) return;
        const p = apply(m, add(t.hole.center, t.hole.normal, h));
        const s = project(p, PARAMS.cubeScalePx, cx, cy);
        const r = Math.max(PARAMS.hitMinRadiusPx, PARAMS.moleRadius * PARAMS.cubeScalePx * 1.1);
        if (Math.hypot(s.x - px, s.y - py) <= r && p[2] > bestZ) {
            best = i;
            bestZ = p[2];
        }
    });
    return best;
}

export function applyHit(progress: number, kind: Kind): number {
    return kind === 'mole' ? progress + 1 : Math.max(0, progress - PARAMS.catPenalty);
}

export function evaluate(progress: number, timeLeft: number): Outcome {
    if (progress >= PARAMS.norma) return 'clear';
    if (timeLeft <= 0) return 'fail';
    return 'playing';
}

// Direction (unit, screen space) to swipe so that a hidden hole turns into view.
export function swipeDirection(m: Mat3, hole: Hole): { x: number; y: number } {
    const p = apply(m, hole.center);
    const len = Math.hypot(p[0], p[1]);
    if (len < 0.05) return { x: 0, y: -1 };
    // The hidden point sits at +p and leaves over the rim; the front surface moves opposite to it.
    return { x: -p[0] / len, y: -p[1] / len };
}
