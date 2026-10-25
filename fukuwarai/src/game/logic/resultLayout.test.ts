import { describe, it, expect } from 'vitest';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    RESULT_FACE_CENTER_Y,
    RESULT_OVERLAY_LINE_PX,
    RESULT_RETRY_HEIGHT_PX,
    RESULT_RETRY_Y,
    RESULT_TOGGLE_HEIGHT_PX,
    RESULT_TOGGLE_Y,
} from './constants';

// Result overlay layout, checked by hand (docs/spec.md「Result の重ね表示」):
// the small correct face's outer edge ends at y 529 (center 500, scale 0.4,
// radius 70 + half the 4px stroke = 72 -> 28.8px), and the retry button starts
// at RESULT_RETRY_Y - RESULT_RETRY_HEIGHT_PX / 2 = 620.
describe('result overlay layout', () => {
    it('places the toggle between the small correct face and the retry button', () => {
        const toggleTop = RESULT_TOGGLE_Y - RESULT_TOGGLE_HEIGHT_PX / 2;
        const toggleBottom = RESULT_TOGGLE_Y + RESULT_TOGGLE_HEIGHT_PX / 2;
        const retryTop = RESULT_RETRY_Y - RESULT_RETRY_HEIGHT_PX / 2;
        expect(toggleTop).toBe(534);
        expect(toggleBottom).toBe(614);
        expect(retryTop).toBe(620);
        expect(toggleTop).toBeGreaterThan(529);
        expect(toggleBottom).toBeLessThan(retryTop);
    });

    it('keeps the toggle tap target at least 44 real px tall at 375 x 550', () => {
        const scale = Math.min(375 / GAME_WIDTH, 550 / GAME_HEIGHT);
        expect(RESULT_TOGGLE_HEIGHT_PX * scale).toBeGreaterThanOrEqual(44);
    });

    it('keeps the overlay on the face, which is centered at y 210', () => {
        expect(RESULT_FACE_CENTER_Y).toBe(210);
        expect(RESULT_OVERLAY_LINE_PX).toBe(3);
    });
});
