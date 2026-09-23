import type { Point } from './types';

/** Below this per-frame movement distance (px), keep `targetRotation` at the
 * current rotation instead of recomputing a direction — avoids the target
 * (and therefore the rotation) flickering from near-zero movement noise
 * while the pointer is essentially stationary. */
export const ROTATION_UPDATE_THRESHOLD = 1.5;

/** Fraction of the remaining angle to `targetRotation` closed per frame
 * (linear interpolation), at full confidence (see `CONFIDENT_ROTATION_DISTANCE`).
 * Lower = slower to "catch up", more of a trailing feel; 1 would snap
 * instantly. */
export const ROTATION_LERP_FACTOR = 0.25;

/** Per-frame movement distance (px) at or above which `targetRotation` is
 * trusted fully (the effective lerp factor reaches `ROTATION_LERP_FACTOR`).
 * Below this, the effective lerp factor is scaled down toward 0 as
 * movement approaches `ROTATION_UPDATE_THRESHOLD` — a single frame's
 * movement vector is direction-of-travel evidence, and a short vector's
 * angle is disproportionately sensitive to ordinary pointer-sampling
 * jitter (a couple of stray pixels can swing `atan2` by tens of degrees),
 * so slow dragging produced visibly erratic rotation even though rotation
 * itself is lerped — chasing a noisy target still looks jittery, just
 * damped a little. Scaling the lerp factor itself by movement confidence
 * fixes this without affecting fast, confident drags (where a frame's
 * movement already comfortably exceeds this distance). */
export const CONFIDENT_ROTATION_DISTANCE = 10;

/**
 * Converts a world-space point into a part's local (unrotated) frame,
 * given the part's current center and rotation. Used once, at grab time,
 * to place the grab-point marker (see drawing.ts) at the spot the player
 * actually grabbed, so it can rotate along with the part as a child of its
 * container.
 */
export function toLocalOffset(point: Point, center: Point, rotation: number): Point {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    return {
        x: dx * cos - dy * sin,
        y: dx * sin + dy * cos,
    };
}

/** Interpolates from `from` to `to` (both radians) by fraction `t`, taking
 * the shorter way around the circle (e.g. 170deg -> -170deg moves +20deg,
 * not the long way around). */
function lerpAngle(from: number, to: number, t: number): number {
    const twoPi = Math.PI * 2;
    let diff = (to - from) % twoPi;
    if (diff > Math.PI) diff -= twoPi;
    if (diff < -Math.PI) diff += twoPi;
    return from + diff * t;
}

/**
 * Given the pointer position at the previous move event (lastPointer), the
 * part's rotation going into this frame (currentRotation), the grabbed
 * point's offset in the part's local frame (grabLocalOffset, fixed for the
 * whole drag), and the pointer's new position, returns the part's new
 * center and rotation for this frame.
 *
 * The held point — not the part's body — is what's being dragged: it is
 * always placed exactly at the pointer (center is solved from that
 * constraint, so it's a dependent value, not driven directly). Rotation
 * eases toward `targetRotation` — chosen so the *held point itself* (not
 * the part's local +x axis; see `grabLocalAngle` below) faces this frame's
 * movement direction, `lastPointer -> pointer` — a little each frame
 * (`ROTATION_LERP_FACTOR`), so the part visibly trails behind and swings
 * into alignment as if towed, rather than snapping instantly.
 *
 * `targetRotation` is deliberately based on `lastPointer` (independent,
 * external state), not on the part's own current center. An earlier
 * version used "current center -> pointer" as the target, which seemed
 * reasonable but is actually self-referential: center is itself solved
 * from rotation via the point-tracking constraint, so measuring the
 * "gap" between current rotation and a target derived from that same
 * center doesn't shrink as rotation changes — it stays at a constant
 * offset (the held point's local angle), which lerp keeps "closing" by
 * the same amount forever. That produced a part that spins continuously
 * even while the pointer sits still. Using the independent, externally-
 * tracked `lastPointer` breaks that feedback loop: a stationary pointer
 * gives a constant target (equal to the current rotation once caught up),
 * so rotation converges and stops, and a straight, steady drag gives a
 * single stable target direction rather than one that keeps drifting.
 *
 * Earlier versions also tried: (1) rotating around a pivot fixed at grab
 * time — rotation kept changing even while dragging in a straight line;
 * (2) rotation fixed by the start-to-end drag vector — no way to steer
 * rotation mid-drag; (3) that fixed-vector rotation combined with exact
 * point-tracking — center teleported on sudden rotation changes; (4)
 * decoupling position (1:1 translation) from rotation — no more
 * teleporting, but felt like dragging the part directly with the held
 * point just riding along, the opposite of "drag the point, the part
 * follows."; (5) `targetRotation` set directly to the movement direction
 * (`atan2(dy, dx)`) — this points the part's local +x axis at the
 * movement direction, not the grabbed point itself. Only felt right when
 * the grabbed point's own local angle happened to be near 0 (grabbed near
 * local +x); grabbing near the opposite side (local angle near 180deg)
 * made the grabbed point face *away* from the movement direction, so the
 * part's body ended up ahead of the pointer instead of trailing behind —
 * "pushing the part through the pointer" rather than pulling it.
 * Subtracting `grabLocalAngle` (below) makes the grabbed point itself
 * face the movement direction regardless of where on the part it is,
 * verified against `grabLocalOffset` near 0, 90 and 180 degrees.
 *
 * The lerp factor itself is scaled by movement confidence (see
 * `CONFIDENT_ROTATION_DISTANCE`) so slow, jitter-prone drags don't produce
 * visibly erratic rotation swings that a fast, confident drag wouldn't.
 */
export function computeDragTransform(
    lastPointer: Point,
    currentRotation: number,
    grabLocalOffset: Point,
    pointer: Point,
): { center: Point; rotation: number } {
    const dx = pointer.x - lastPointer.x;
    const dy = pointer.y - lastPointer.y;
    const moveDistance = Math.hypot(dx, dy);
    const grabLocalAngle = Math.atan2(grabLocalOffset.y, grabLocalOffset.x);
    const targetRotation = moveDistance < ROTATION_UPDATE_THRESHOLD
        ? currentRotation
        : Math.atan2(dy, dx) - grabLocalAngle;
    const speedRatio = Math.min(1, Math.max(0, moveDistance / CONFIDENT_ROTATION_DISTANCE));
    const rotation = lerpAngle(currentRotation, targetRotation, ROTATION_LERP_FACTOR * speedRatio);

    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const rotatedOffset: Point = {
        x: grabLocalOffset.x * cos - grabLocalOffset.y * sin,
        y: grabLocalOffset.x * sin + grabLocalOffset.y * cos,
    };
    return {
        center: { x: pointer.x - rotatedOffset.x, y: pointer.y - rotatedOffset.y },
        rotation,
    };
}
