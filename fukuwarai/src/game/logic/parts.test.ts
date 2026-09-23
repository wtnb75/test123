import { describe, it, expect } from 'vitest';
import { PART_IDS, PART_SHAPES, PART_ANSWERS, TRAY_SLOTS, hitRadius, HIT_AREA_PADDING, MIN_HIT_SIZE } from './parts';
import { GAME_WIDTH } from './constants';

describe('hitRadius', () => {
    it('uses MIN_HIT_SIZE / 2 as a floor when the padded shape is smaller than the minimum', () => {
        const radius = hitRadius({ kind: 'circle', size: { w: 4, h: 4 }, fill: 0 });
        expect(radius).toBe(MIN_HIT_SIZE / 2);
    });

    it('grows with the larger of width/height once the padded shape exceeds the minimum', () => {
        const radius = hitRadius({ kind: 'ellipse', size: { w: 200, h: 10 }, fill: 0 });
        expect(radius).toBe((200 + HIT_AREA_PADDING) / 2);
    });
});

describe('part data consistency', () => {
    it('every draggable part id has a shape, an answer transform, and a tray slot', () => {
        for (const id of PART_IDS) {
            expect(PART_SHAPES[id]).toBeDefined();
            expect(PART_ANSWERS[id]).toBeDefined();
            expect(TRAY_SLOTS[id]).toBeDefined();
        }
    });

    it('tray slots are spaced far enough apart that no two hit circles overlap', () => {
        for (let i = 0; i < PART_IDS.length; i++) {
            for (let j = i + 1; j < PART_IDS.length; j++) {
                const idA = PART_IDS[i];
                const idB = PART_IDS[j];
                const a = TRAY_SLOTS[idA];
                const b = TRAY_SLOTS[idB];
                const distance = Math.hypot(a.x - b.x, a.y - b.y);
                const minDistance = hitRadius(PART_SHAPES[idA]) + hitRadius(PART_SHAPES[idB]);
                expect(distance).toBeGreaterThanOrEqual(minDistance);
            }
        }
    });

    it('tray slot hit circles stay within the game width', () => {
        for (const id of PART_IDS) {
            const slot = TRAY_SLOTS[id];
            const r = hitRadius(PART_SHAPES[id]);
            expect(slot.x - r).toBeGreaterThanOrEqual(0);
            expect(slot.x + r).toBeLessThanOrEqual(GAME_WIDTH);
        }
    });
});
