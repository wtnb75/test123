import type { ScreenSize } from './screen';

export interface Point {
    x: number;
    y: number;
}

export type Rng = () => number;

export function distanceSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

export function circlesOverlap(a: Point, ar: number, b: Point, br: number): boolean {
    const r = ar + br;
    return distanceSq(a.x, a.y, b.x, b.y) <= r * r;
}

export function angleTo(from: Point, to: Point): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
}

/** Wraps an angle into (-PI, PI]. */
export function normalizeAngle(a: number): number {
    let r = a % (Math.PI * 2);
    if (r <= -Math.PI) r += Math.PI * 2;
    if (r > Math.PI) r -= Math.PI * 2;
    return r;
}

/** Rotates `current` toward `target` by at most `maxStep` radians. */
export function turnToward(current: number, target: number, maxStep: number): number {
    const diff = normalizeAngle(target - current);
    if (Math.abs(diff) <= maxStep) return target;
    return current + Math.sign(diff) * maxStep;
}

/** True while the point's center lies inside the visible screen. */
export function isOnScreen(p: Point, s: ScreenSize): boolean {
    return p.x >= 0 && p.x <= s.width && p.y >= 0 && p.y <= s.height;
}

/** True once a circle of radius r has fully left the screen on any side. */
export function isFullyOffScreen(p: Point, r: number, s: ScreenSize): boolean {
    return p.x < -r || p.x > s.width + r || p.y < -r || p.y > s.height + r;
}

export function randomRange(rng: Rng, min: number, max: number): number {
    return min + (max - min) * rng();
}

/** Removes every element matching `pred` in place, without allocating a new array. */
export function removeWhere<T>(items: T[], pred: (item: T) => boolean): void {
    let w = 0;
    for (let r = 0; r < items.length; r++) {
        const item = items[r];
        if (!pred(item)) items[w++] = item;
    }
    items.length = w;
}
