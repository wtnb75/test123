import { describe, it, expect } from 'vitest';
import { CONFIRM_FLASH_MS, GAME_WIDTH, GAME_HEIGHT, TRAY_TOP_Y, PLACEMENT_CENTER, SCORE_CANVAS_SIZE, SCORE_BLUR_RADIUS_PX } from './constants';

// Regression pins from docs/spec.md 完了条件: adding the drop-target display
// must not move the existing layout or scoring parameters.
describe('existing layout and scoring parameters', () => {
    it('keeps the logical size and the tray boundary', () => {
        expect(GAME_WIDTH).toBe(540);
        expect(GAME_HEIGHT).toBe(960);
        expect(TRAY_TOP_Y).toBe(700);
    });

    it('keeps the confirm ring shorter than 0.3 seconds', () => {
        expect(CONFIRM_FLASH_MS).toBe(250);
    });

    it('keeps the face center and the scoring canvas settings', () => {
        expect(PLACEMENT_CENTER).toEqual({ x: 270, y: 380 });
        expect(SCORE_CANVAS_SIZE).toBe(400);
        expect(SCORE_BLUR_RADIUS_PX).toBe(6);
    });
});
