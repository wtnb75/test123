import { describe, it, expect } from 'vitest';
import {
    toLocalOffset,
    computeDragTransform,
    ROTATION_UPDATE_THRESHOLD,
    ROTATION_LERP_FACTOR,
    CONFIDENT_ROTATION_DISTANCE,
} from './dragTransform';

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
    it('keeps rotation unchanged and re-derives the center from the unchanged rotation when movement is below the threshold', () => {
        const dx = ROTATION_UPDATE_THRESHOLD - 0.5;
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
    });

    it('faces the grabbed point itself (not the local +x axis) toward this frame\'s movement direction, once past the threshold and at full speed confidence', () => {
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
            const distance = CONFIDENT_ROTATION_DISTANCE; // full speed confidence
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

    it('scales the effective lerp factor down for movement below CONFIDENT_ROTATION_DISTANCE, so slow drags change rotation less than fast ones', () => {
        const currentRotation = Math.PI / 2;
        const grabLocalOffset = { x: 5, y: 0 }; // local angle 0
        const lastPointer = { x: 0, y: 0 };

        const halfSpeedResult = computeDragTransform(
            lastPointer,
            currentRotation,
            grabLocalOffset,
            { x: CONFIDENT_ROTATION_DISTANCE / 2, y: 0 },
        );
        const fullSpeedResult = computeDragTransform(
            lastPointer,
            currentRotation,
            grabLocalOffset,
            { x: CONFIDENT_ROTATION_DISTANCE, y: 0 },
        );

        // Target rotation is 0 in both cases (moving right, grabbed at local
        // angle 0). Half speed -> effective lerp 0.125, full speed -> 0.25.
        expect(halfSpeedResult.rotation).toBeCloseTo(currentRotation * (1 - 0.125), 10);
        expect(fullSpeedResult.rotation).toBeCloseTo(currentRotation * (1 - 0.25), 10);
        // Half-speed rotation should have moved less far from currentRotation
        // than full-speed rotation did.
        expect(Math.abs(halfSpeedResult.rotation - currentRotation))
            .toBeLessThan(Math.abs(fullSpeedResult.rotation - currentRotation));
    });

    it('clamps the effective lerp factor at ROTATION_LERP_FACTOR for movement beyond CONFIDENT_ROTATION_DISTANCE (does not keep accelerating)', () => {
        const currentRotation = Math.PI / 2;
        const grabLocalOffset = { x: 5, y: 0 };
        const lastPointer = { x: 0, y: 0 };

        const atConfidentDistance = computeDragTransform(
            lastPointer, currentRotation, grabLocalOffset, { x: CONFIDENT_ROTATION_DISTANCE, y: 0 },
        );
        const wellBeyond = computeDragTransform(
            lastPointer, currentRotation, grabLocalOffset, { x: CONFIDENT_ROTATION_DISTANCE * 5, y: 0 },
        );
        expect(wellBeyond.rotation).toBeCloseTo(atConfidentDistance.rotation, 10);
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
        const distance = CONFIDENT_ROTATION_DISTANCE; // full lerp factor, no speed scaling to account for

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
