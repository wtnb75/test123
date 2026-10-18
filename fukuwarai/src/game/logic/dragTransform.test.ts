import { describe, it, expect } from 'vitest';
import {
    toLocalOffset,
    computeDragTransform,
    ROTATION_START_SPEED,
    ROTATION_LERP_FACTOR,
    ROTATION_FULL_SPEED,
} from './dragTransform';

const RAMP_MIDPOINT = (ROTATION_START_SPEED + ROTATION_FULL_SPEED) / 2;

describe('toLocalOffset', () => {
    it('returns (0, 0) when the point is exactly the center', () => {
        expect(toLocalOffset({ x: 50, y: 50 }, { x: 50, y: 50 }, 0)).toEqual({ x: 0, y: 0 });
    });

    it('matches the raw offset when rotation is 0', () => {
        expect(toLocalOffset({ x: 130, y: 80 }, { x: 100, y: 80 }, 0)).toEqual({ x: 30, y: 0 });
    });

    it('un-rotates the offset so re-applying the same rotation forward reconstructs the original point', () => {
        const center = { x: 200, y: 150 };
        const rotation = Math.PI / 3;
        const point = { x: 240, y: 100 };
        const local = toLocalOffset(point, center, rotation);

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const reconstructed = {
            x: center.x + local.x * cos - local.y * sin,
            y: center.y + local.x * sin + local.y * cos,
        };
        expect(reconstructed.x).toBeCloseTo(point.x, 6);
        expect(reconstructed.y).toBeCloseTo(point.y, 6);
    });
});

describe('computeDragTransform', () => {
    it('keeps rotation unchanged and re-derives the center from the unchanged rotation when movement is at or below ROTATION_START_SPEED', () => {
        // Exactly ROTATION_START_SPEED is the boundary: still no rotation.
        for (const dx of [0, 1, ROTATION_START_SPEED - 0.5, ROTATION_START_SPEED]) {
            const currentRotation = 0.7;
            const grabLocalOffset = { x: 10, y: 0 };
            const result = computeDragTransform(
                { x: 100, y: 100 },
                currentRotation,
                grabLocalOffset,
                { x: 100 + dx, y: 100 },
            );
            expect(result.rotation).toBe(currentRotation);
            const cos = Math.cos(currentRotation);
            const sin = Math.sin(currentRotation);
            expect(result.center.x).toBeCloseTo(100 + dx - grabLocalOffset.x * cos, 10);
            expect(result.center.y).toBeCloseTo(100 - grabLocalOffset.x * sin, 10);
        }
    });

    it('starts rotating just past ROTATION_START_SPEED with the ramp slope (hand-worked: 3.1 -> factor 0.1 / 5 * 0.25 = 0.005)', () => {
        const result = computeDragTransform(
            { x: 0, y: 0 }, Math.PI / 2, { x: 5, y: 0 }, { x: ROTATION_START_SPEED + 0.1, y: 0 },
        );
        expect(result.rotation).toBeCloseTo((Math.PI / 2) * (1 - 0.005), 10);
    });

    it('changes rotation by exactly the effective lerp factor times the angle gap, and moves the center by a bounded amount, at any speed', () => {
        const current = Math.PI / 2;
        const grabLocalOffset = { x: 20, y: 0 };
        const gap = current; // moving right, grabbed at local angle 0: target 0
        for (const distance of [0, 2, 3, 3.5, 5.5, 8, 10, 40]) {
            const prev = { x: 100 - distance, y: 100 };
            const { center, rotation } = computeDragTransform(prev, current, grabLocalOffset, { x: 100, y: 100 });
            // Hand-worked factors (START 3, FULL 8, LERP 0.25), not the production formula.
            const factor = ({ 0: 0, 2: 0, 3: 0, 3.5: 0.025, 5.5: 0.125, 8: 0.25, 10: 0.25, 40: 0.25 } as Record<number, number>)[distance];
            expect(Math.abs(rotation - current)).toBeCloseTo(factor * gap, 10);
            // Center = pointer - rotated offset, so it can shift at most by the
            // rotated offset's change (chord of the swept angle) — never a jump.
            const before = { x: 100 - grabLocalOffset.x * Math.cos(current), y: 100 - grabLocalOffset.x * Math.sin(current) };
            const shift = Math.hypot(center.x - before.x, center.y - before.y);
            expect(shift).toBeLessThanOrEqual(grabLocalOffset.x * Math.abs(rotation - current) + 1e-9);
        }
    });

    it('faces the grabbed point itself (not the local +x axis) toward this frame\'s movement direction, at full speed', () => {
        // grabLocalOffset local angle (grabLocalAngle) is subtracted from the
        // raw movement direction so the grabbed point — not whatever local
        // angle happens to be 0 — ends up pointing the way the pointer moved.
        const cases: Array<[{ x: number; y: number }, number, number]> = [
            [{ x: 5, y: 0 }, 0, 0], // grabbed at local angle 0, moving right -> target 0
            [{ x: 0, y: 5 }, 0, -Math.PI / 2], // grabbed at local angle +90deg, moving right -> target -90deg
            // grabbed at local angle 180deg, moving right -> target -180deg
            // (Math.atan2(0, -5) resolves to +PI, so 0 - PI = -PI; this is
            // the exact +-180deg boundary, where JS's atan2 convention picks
            // a specific sign even though +PI and -PI are the same angle).
            [{ x: -5, y: 0 }, 0, -Math.PI],
            [{ x: 5, y: 0 }, Math.PI / 2, Math.PI / 2], // grabbed at 0, moving up -> target 90deg
        ];
        for (const [grabLocalOffset, moveAngle, expectedTarget] of cases) {
            const distance = ROTATION_FULL_SPEED;
            const dx = distance * Math.cos(moveAngle);
            const dy = distance * Math.sin(moveAngle);
            const result = computeDragTransform(
                { x: 0, y: 0 },
                0,
                grabLocalOffset,
                { x: dx, y: dy },
            );
            // At full speed the effective lerp factor equals ROTATION_LERP_FACTOR,
            // so rotation should be exactly `expectedTarget * ROTATION_LERP_FACTOR`
            // away from the starting rotation of 0.
            expect(result.rotation).toBeCloseTo(expectedTarget * ROTATION_LERP_FACTOR, 10);
        }
    });

    it('ramps the effective lerp factor linearly between ROTATION_START_SPEED and ROTATION_FULL_SPEED (hand-worked: 3 -> 0, 5.5 -> 0.125, 8 -> 0.25)', () => {
        const currentRotation = Math.PI / 2;
        const grabLocalOffset = { x: 5, y: 0 }; // local angle 0
        const lastPointer = { x: 0, y: 0 };
        const rotationAfter = (distance: number): number => computeDragTransform(
            lastPointer, currentRotation, grabLocalOffset, { x: distance, y: 0 },
        ).rotation;

        // Target rotation is 0 in every case (moving right, grabbed at local
        // angle 0), so rotation = currentRotation * (1 - effectiveLerp).
        expect(RAMP_MIDPOINT).toBe(5.5);
        expect(rotationAfter(ROTATION_START_SPEED)).toBeCloseTo(currentRotation, 10);
        expect(rotationAfter(RAMP_MIDPOINT)).toBeCloseTo(currentRotation * (1 - 0.125), 10);
        expect(rotationAfter(ROTATION_FULL_SPEED)).toBeCloseTo(currentRotation * (1 - 0.25), 10);
    });

    it('clamps the effective lerp factor at ROTATION_LERP_FACTOR for movement beyond ROTATION_FULL_SPEED (does not keep accelerating)', () => {
        const currentRotation = Math.PI / 2;
        const grabLocalOffset = { x: 5, y: 0 };
        const lastPointer = { x: 0, y: 0 };

        const atFullSpeed = computeDragTransform(
            lastPointer, currentRotation, grabLocalOffset, { x: ROTATION_FULL_SPEED, y: 0 },
        );
        const wellBeyond = computeDragTransform(
            lastPointer, currentRotation, grabLocalOffset, { x: ROTATION_FULL_SPEED * 5, y: 0 },
        );
        expect(wellBeyond.rotation).toBeCloseTo(atFullSpeed.rotation, 10);
    });

    it('does not rotate an upright part during slow position fine-tuning (regression: drag-settle)', () => {
        // Grab the top edge (local angle -90deg) of a part already at rotation 0.
        const grabLocalOffset = { x: 0, y: -20 };
        const moves: Array<{ x: number; y: number; frames: number }> = [
            { x: 3, y: 0, frames: 5 }, // sideways 15px at 3px/move
            { x: 0, y: 2, frames: 3 }, // down 6px at 2px/move
        ];
        for (const move of moves) {
            let rotation = 0;
            let lastPointer = { x: 200, y: 200 };
            for (let i = 0; i < move.frames; i++) {
                const pointer = { x: lastPointer.x + move.x, y: lastPointer.y + move.y };
                const result = computeDragTransform(lastPointer, rotation, grabLocalOffset, pointer);
                expect(result.rotation).toBe(0);
                // The held point still sits exactly on the pointer.
                expect(result.center.x + grabLocalOffset.x).toBeCloseTo(pointer.x, 10);
                expect(result.center.y + grabLocalOffset.y).toBeCloseTo(pointer.y, 10);
                rotation = result.rotation;
                lastPointer = pointer;
            }
        }
    });

    it('still steers the part to face the pull direction during a slow 4px/move pull of 320px (hand-worked: -90deg * (1 - 0.95^80) ~= -88.5deg)', () => {
        const grabLocalOffset = { x: 20, y: 0 }; // grabbed at local angle 0 (right edge)
        let rotation = 0;
        let lastPointer = { x: 200, y: 600 };
        for (let i = 0; i < 80; i++) {
            const pointer = { x: lastPointer.x, y: lastPointer.y - 4 }; // straight up
            rotation = computeDragTransform(lastPointer, rotation, grabLocalOffset, pointer).rotation;
            lastPointer = pointer;
        }
        const degrees = (rotation * 180) / Math.PI;
        expect(Math.abs(degrees - -90)).toBeLessThan(3);
        expect(degrees).toBeCloseTo(-88.5, 0);
    });

    it('converges within 5 degrees of a new 90-degree heading in about 88px of travel at ROTATION_FULL_SPEED', () => {
        const grabLocalOffset = { x: 0, y: -20 }; // local angle -90deg: upright means moving up (-90deg)
        let rotation = 0;
        let lastPointer = { x: 0, y: 0 };
        let moves = 0;
        // Heading changes from "up" to "right" (0deg), target rotation = 0 - (-90deg) = 90deg.
        const target = Math.PI / 2;
        while (Math.abs(target - rotation) > (5 * Math.PI) / 180 && moves < 200) {
            const pointer = { x: lastPointer.x + ROTATION_FULL_SPEED, y: lastPointer.y };
            rotation = computeDragTransform(lastPointer, rotation, grabLocalOffset, pointer).rotation;
            lastPointer = pointer;
            moves++;
        }
        expect(moves).toBe(11);
        expect(moves * ROTATION_FULL_SPEED).toBe(88);
    });

    it('places the held point (grabLocalOffset rotated by the new rotation, added to the new center) exactly on the pointer', () => {
        const cases: Array<[{ x: number; y: number }, { x: number; y: number }, number, { x: number; y: number }]> = [
            [{ x: 10, y: 10 }, { x: 12, y: -6 }, 0.4, { x: 25, y: 40 }],
            [{ x: 0, y: 0 }, { x: -8, y: 3 }, -1.2, { x: -50, y: 12 }],
        ];
        for (const [lastPointer, grabLocalOffset, currentRotation, pointer] of cases) {
            const { center, rotation } = computeDragTransform(lastPointer, currentRotation, grabLocalOffset, pointer);
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            const heldPoint = {
                x: center.x + grabLocalOffset.x * cos - grabLocalOffset.y * sin,
                y: center.y + grabLocalOffset.x * sin + grabLocalOffset.y * cos,
            };
            expect(heldPoint.x).toBeCloseTo(pointer.x, 8);
            expect(heldPoint.y).toBeCloseTo(pointer.y, 8);
        }
    });

    it('does not keep spinning when the pointer stops moving, even for a grab point on the far side of the part (regression: 不採用案5/6)', () => {
        const grabLocalOffset = { x: -20, y: 2 }; // local angle near 180deg — the worst case from 不採用案6
        let lastPointer = { x: 0, y: 0 };
        let rotation = 0;
        const pointer = { x: 10, y: 0 };

        const first = computeDragTransform(lastPointer, rotation, grabLocalOffset, pointer);
        rotation = first.rotation;
        lastPointer = { ...pointer };

        for (let i = 0; i < 5; i++) {
            const next = computeDragTransform(lastPointer, rotation, grabLocalOffset, pointer);
            expect(next.rotation).toBeCloseTo(rotation, 10);
            expect(next.center.x).toBeCloseTo(first.center.x, 10);
            expect(next.center.y).toBeCloseTo(first.center.y, 10);
            rotation = next.rotation;
            lastPointer = { ...pointer };
        }
    });

    it('takes the shorter path around the circle when the raw gap between current and target rotation exceeds 180 degrees in either direction', () => {
        const grabLocalOffset = { x: 5, y: 0 }; // local angle 0, so targetRotation == raw movement angle
        const distance = ROTATION_FULL_SPEED; // full lerp factor, no speed scaling to account for

        // current ~170deg, movement direction ~-170deg: the raw gap is
        // -340deg, which must wrap to the +20deg short way around the
        // circle rather than turning the long way.
        const currentA = (170 * Math.PI) / 180;
        const targetA = (-170 * Math.PI) / 180;
        const resultA = computeDragTransform(
            { x: 0, y: 0 }, currentA, grabLocalOffset,
            { x: distance * Math.cos(targetA), y: distance * Math.sin(targetA) },
        );
        const expectedDiffA = (20 * Math.PI) / 180;
        expect(resultA.rotation).toBeCloseTo(currentA + expectedDiffA * ROTATION_LERP_FACTOR, 10);

        // Mirror case: current ~-170deg, movement direction ~170deg. The raw
        // gap is +340deg, which must wrap to the -20deg short way.
        const currentB = -currentA;
        const targetB = -targetA;
        const resultB = computeDragTransform(
            { x: 0, y: 0 }, currentB, grabLocalOffset,
            { x: distance * Math.cos(targetB), y: distance * Math.sin(targetB) },
        );
        const expectedDiffB = (-20 * Math.PI) / 180;
        expect(resultB.rotation).toBeCloseTo(currentB + expectedDiffB * ROTATION_LERP_FACTOR, 10);
    });

    it('normalizes a current rotation beyond a full turn when taking the shorter path (3pi - 0.2 is the same heading as pi - 0.2)', () => {
        const grabLocalOffset = { x: 5, y: 0 };
        const current = 3 * Math.PI - 0.2;
        const target = -Math.PI + 0.2; // short way from pi - 0.2 is +0.4 rad
        const result = computeDragTransform(
            { x: 0, y: 0 }, current, grabLocalOffset,
            { x: ROTATION_FULL_SPEED * Math.cos(target), y: ROTATION_FULL_SPEED * Math.sin(target) },
        );
        expect(result.rotation).toBeCloseTo(current + 0.4 * ROTATION_LERP_FACTOR, 10);
    });

    it('converges to a part center trailing behind the pointer during a straight drag, regardless of which side of the part was grabbed (regression: 不採用案6 "pushing" bug)', () => {
        const grabAngles = [
            { x: 20, y: 2 }, // local angle near 0
            { x: -20, y: 2 }, // local angle near 180deg — previously caused the part to push ahead of the pointer
            { x: 2, y: 20 }, // local angle near 90deg
        ];
        for (const grabLocalOffset of grabAngles) {
            let lastPointer = { x: 0, y: 0 };
            let rotation = 0;
            let pointer = { x: 0, y: 0 };
            for (let i = 0; i < 40; i++) {
                pointer = { x: pointer.x + 10, y: pointer.y };
                const result = computeDragTransform(lastPointer, rotation, grabLocalOffset, pointer);
                rotation = result.rotation;
                lastPointer = { ...pointer };
                if (i === 39) {
                    // Trailing behind a rightward drag means the center ends
                    // up to the left of (behind) the pointer.
                    expect(result.center.x).toBeLessThan(pointer.x);
                }
            }
        }
    });
});
