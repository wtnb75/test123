import { describe, it, expect } from 'vitest';
import { createInitialProgress, isStageUnlocked, unlockNextStage, isFinalStage } from './progress';
import { STAGE_COUNT } from './constants';

describe('progress', () => {
    it('starts with only stage 1 unlocked', () => {
        const progress = createInitialProgress();
        expect(isStageUnlocked(progress, 1)).toBe(true);
        expect(isStageUnlocked(progress, 2)).toBe(false);
    });

    it('unlocks the next stage after clearing the current one', () => {
        const progress = unlockNextStage(createInitialProgress(), 1);
        expect(isStageUnlocked(progress, 2)).toBe(true);
        expect(isStageUnlocked(progress, 3)).toBe(false);
    });

    it('never reduces the unlocked stage (monotonic)', () => {
        const advanced = unlockNextStage(createInitialProgress(), 3);
        const regressed = unlockNextStage(advanced, 1);
        expect(regressed.unlockedStage).toBe(advanced.unlockedStage);
    });

    it('does not unlock past STAGE_COUNT when clearing the final stage', () => {
        const progress = unlockNextStage(createInitialProgress(), STAGE_COUNT);
        expect(progress.unlockedStage).toBe(STAGE_COUNT);
        expect(isStageUnlocked(progress, STAGE_COUNT + 1)).toBe(false);
    });

    it('identifies the final stage', () => {
        expect(isFinalStage(STAGE_COUNT)).toBe(true);
        expect(isFinalStage(STAGE_COUNT - 1)).toBe(false);
    });

    it('a failed attempt does not unlock anything (GameOver never calls unlockNextStage)', () => {
        const progress = createInitialProgress();
        expect(progress).toEqual({ unlockedStage: 1 });
    });
});
