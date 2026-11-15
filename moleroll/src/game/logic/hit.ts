// Which Pop a tap hits (docs/spec.md "ルール" 叩きの判定).
import { HIT_RADIUS_PX } from '../params';
import { add, apply, project, type Mat3, type Point, type Vec3 } from './math';
import { isHittable, popHeight, type Pop } from './pop';

/** The Pop's rotated point (hole centre lifted along the normal by its height). */
export function popPoint(pop: Pop, m: Mat3): Vec3 {
    return apply(m, add(pop.hole.center, pop.hole.normal, popHeight(pop.age)));
}

/** Screen position of the Pop's lifted point. */
export function popScreen(pop: Pop, m: Mat3, o: Point): Point {
    return project(popPoint(pop, m), o);
}

/**
 * Index of the Pop hit by a tap at (tx, ty), or -1 (a miss). Among Pops within HIT_RADIUS_PX the one
 * nearest the viewer (largest rotated z) wins; equal z → the smaller hole id.
 */
export function findHit(pops: readonly Pop[], m: Mat3, tx: number, ty: number, o: Point): number {
    let best = -1;
    let bestZ = -Infinity;
    let bestId = Infinity;
    pops.forEach((pop, i) => {
        if (!isHittable(pop, m)) return;
        const p = popPoint(pop, m);
        const s = project(p, o);
        const dx = s.x - tx;
        const dy = s.y - ty;
        if (dx * dx + dy * dy > HIT_RADIUS_PX * HIT_RADIUS_PX) return;
        if (p[2] > bestZ || (p[2] === bestZ && pop.hole.id < bestId)) {
            best = i;
            bestZ = p[2];
            bestId = pop.hole.id;
        }
    });
    return best;
}
