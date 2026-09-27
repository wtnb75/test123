import {
    HIT_EDGE_ALPHA, HIT_EDGE_DURATION, HIT_EDGE_WIDTH, HIT_RING_DURATION, HIT_RING_MAX_RADIUS, HIT_TINT_ALPHA,
    HIT_TINT_DURATION, PLAYER_RADIUS
} from './constants';
import { effectProgress, fadeAlpha } from './effects';
import type { Point } from './geometry';

/**
 * The hit effect in play: tint, edge band and ring all start together when the player loses a life,
 * and restart on the next hit. Drawing only: the rules never read this. It plays on whatever the
 * phase, including while ending.
 */
export class HitEffects {
    /** Seconds since the latest hit; Infinity when none is playing. */
    age = Infinity;
    /** Where the latest hit happened (the ring's fixed centre). */
    x = 0;
    y = 0;

    update(dt: number, hits: readonly Point[]): void {
        this.age += dt;
        if (hits.length === 0) return;
        const hit = hits[hits.length - 1];
        this.age = 0;
        this.x = hit.x;
        this.y = hit.y;
    }

    clear(): void {
        this.age = Infinity;
    }
}

/** Opacity of the full-screen red tint `age` seconds after a hit (0 when not showing). */
export function hitTintAlpha(age: number): number {
    const p = effectProgress(age, HIT_TINT_DURATION);
    return p < 0 ? 0 : HIT_TINT_ALPHA * (1 - p);
}

/**
 * Opacity of the red edge band `age` seconds after a hit, at `distance` px from the nearest screen
 * edge: strongest at the edge, gone at HIT_EDGE_WIDTH inward (0 when not showing).
 */
export function hitEdgeAlpha(age: number, distance: number): number {
    const p = effectProgress(age, HIT_EDGE_DURATION);
    if (p < 0) return 0;
    return HIT_EDGE_ALPHA * Math.max(0, 1 - distance / HIT_EDGE_WIDTH) * (1 - p);
}

/** How much of the edge band is left `age` seconds after a hit: 1 at the hit, fading to 0 (0 when not showing). */
export function hitEdgeFade(age: number): number {
    const p = effectProgress(age, HIT_EDGE_DURATION);
    return p < 0 ? 0 : 1 - p;
}

/** Nested frames approximating the edge band's inward fade (the spec leaves the approximation open). */
export const HIT_EDGE_STEPS = 16;

/** One rectangle of the edge band and its opacity at the moment of the hit. */
export interface EdgeRect {
    x: number;
    y: number;
    w: number;
    h: number;
    alpha: number;
}

/**
 * The edge band as non-overlapping rectangles: HIT_EDGE_STEPS nested frames, each with the band's
 * opacity at its outer side (so the screen edge gets the full HIT_EDGE_ALPHA and corners follow the
 * nearest edge). The outermost frame reaches `pad` px past the screen so a camera shake never uncovers
 * an edge. Drawn once; fading over time is a single opacity on top (hitEdgeFade).
 */
export function edgeFrames(width: number, height: number, pad: number): EdgeRect[] {
    const rects: EdgeRect[] = [];
    const step = HIT_EDGE_WIDTH / HIT_EDGE_STEPS;
    for (let i = 0; i < HIT_EDGE_STEPS; i++) {
        const alpha = hitEdgeAlpha(0, i * step);
        const outer = i === 0 ? -pad : i * step;
        const inner = (i + 1) * step;
        const thick = inner - outer;
        rects.push(
            { x: outer, y: outer, w: width - outer * 2, h: thick, alpha },
            { x: outer, y: height - inner, w: width - outer * 2, h: thick, alpha },
            { x: outer, y: inner, w: thick, h: height - inner * 2, alpha },
            { x: width - inner, y: inner, w: thick, h: height - inner * 2, alpha }
        );
    }
    return rects;
}

/** Progress of the hit ring `age` seconds after a hit; -1 when not showing. */
export function hitRingProgress(age: number): number {
    return effectProgress(age, HIT_RING_DURATION);
}

export function hitRingAlpha(progress: number): number {
    return fadeAlpha(progress);
}

export function hitRingRadius(progress: number): number {
    return PLAYER_RADIUS + (HIT_RING_MAX_RADIUS - PLAYER_RADIUS) * progress;
}
