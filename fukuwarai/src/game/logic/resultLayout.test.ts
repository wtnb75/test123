import { describe, it, expect } from 'vitest';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    RESULT_FACE_CENTER_Y,
    RESULT_FACE_LABEL_Y,
    RESULT_FADE_MS,
    RESULT_HOLD_MS,
    RESULT_RETRY_HEIGHT_PX,
    RESULT_RETRY_Y,
    RESULT_TOGGLE_HEIGHT_PX,
    RESULT_TOGGLE_Y,
} from './constants';

// Result crossfade layout, checked by hand (docs/spec.md「Result の見比べ表示」):
// the small correct face's outer edge ends at y 529 (center 500, scale 0.4,
// radius 70 + half the 4px stroke = 72 -> 28.8px), the retry button starts
// at RESULT_RETRY_Y - RESULT_RETRY_HEIGHT_PX / 2 = 620, the big face's outer
// edge ends at 210 + 72 = 282, and the 64px score (center 355) starts at about 323.
describe('result crossfade layout', () => {
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

    it('keeps the faces centered at y 210', () => {
        expect(RESULT_FACE_CENTER_Y).toBe(210);
    });

    it('puts the face label between the big face (bottom 282) and the score (top about 323)', () => {
        expect(RESULT_FACE_LABEL_Y).toBe(298);
        expect(RESULT_FACE_LABEL_Y).toBeGreaterThan(282);
        expect(RESULT_FACE_LABEL_Y).toBeLessThan(323);
    });

    it('fades for a positive time and holds at least as long as one fade', () => {
        expect(RESULT_FADE_MS).toBeGreaterThan(0);
        expect(RESULT_HOLD_MS).toBeGreaterThanOrEqual(RESULT_FADE_MS);
        expect(2 * (RESULT_FADE_MS + RESULT_HOLD_MS)).toBe(4000);
    });
});
