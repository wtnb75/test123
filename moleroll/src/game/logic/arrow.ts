// Direction arrows for moles on the hidden side (docs/spec.md "方向矢印").
import {
    ARROW_BACK_PX,
    ARROW_BLINK_RATE,
    ARROW_BLINK_SEC,
    ARROW_HALF_WIDTH_PX,
    ARROW_POLE_EPSILON,
    ARROW_PULSE_SCALE,
    ARROW_PULSE_SEC,
    ARROW_RING_PX,
    ARROW_TIP_PX,
} from '../params';
import { apply, isHiddenSide, type Mat3, type Point, type Vec3 } from './math';
import { remainingLife, type Pop } from './pop';

export interface Arrow {
    /** Where the arrow sits: on the ring, at the hole's side of the cube. */
    pos: Point;
    /** Unit direction to swipe (towards the cube's centre); the arrow points this way. */
    dir: Point;
}

/** Only moles on a hidden-side face get an arrow. */
export function hasArrow(pop: Pop, m: Mat3): boolean {
    return pop.kind === 'mole' && isHiddenSide(m, pop.hole);
}

/**
 * The arrow for a rotated hole centre `p`. Straight behind (|(p.x, p.y)| below ARROW_POLE_EPSILON) it sits
 * directly below the centre and points up.
 */
export function arrowFromPoint(p: Vec3, o: Point): Arrow {
    const len = Math.hypot(p[0], p[1]);
    const out: Point = len < ARROW_POLE_EPSILON ? { x: 0, y: 1 } : { x: p[0] / len, y: p[1] / len };
    return {
        pos: { x: o.x + out.x * ARROW_RING_PX, y: o.y + out.y * ARROW_RING_PX },
        // 0 - x keeps +0 (never -0) for an axis-aligned direction.
        dir: { x: 0 - out.x, y: 0 - out.y },
    };
}

export function arrowFor(pop: Pop, m: Mat3, o: Point): Arrow {
    return arrowFromPoint(apply(m, pop.hole.center), o);
}

/** The triangle's three corners [tip, base1, base2], scaled about the arrow's position by `scale`. */
export function arrowTriangle(a: Arrow, scale = 1): [Point, Point, Point] {
    const nx = 0 - a.dir.y;
    const ny = a.dir.x;
    const tip = ARROW_TIP_PX * scale;
    const back = ARROW_BACK_PX * scale;
    const half = ARROW_HALF_WIDTH_PX * scale;
    return [
        { x: a.pos.x + a.dir.x * tip, y: a.pos.y + a.dir.y * tip },
        { x: a.pos.x - a.dir.x * back + nx * half, y: a.pos.y - a.dir.y * back + ny * half },
        { x: a.pos.x - a.dir.x * back - nx * half, y: a.pos.y - a.dir.y * back - ny * half },
    ];
}

/** Arrow size factor at `elapsed` s of play: 1 → ARROW_PULSE_SCALE → 1, one period per ARROW_PULSE_SEC. */
export function arrowPulseScale(elapsed: number): number {
    return 1 + ((ARROW_PULSE_SCALE - 1) * (1 - Math.cos((2 * Math.PI * elapsed) / ARROW_PULSE_SEC))) / 2;
}

/** Blinks while the Pop is about to go: below ARROW_BLINK_SEC left, hidden on even half-periods. */
export function arrowVisible(remaining: number): boolean {
    if (remaining >= ARROW_BLINK_SEC) return true;
    return Math.floor(remaining * ARROW_BLINK_RATE) % 2 !== 0;
}

export function popArrowVisible(pop: Pop): boolean {
    return arrowVisible(remainingLife(pop));
}
