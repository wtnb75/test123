import { STAGE_COUNT } from './constants';

export interface ProgressState {
    unlockedStage: number;
}

export function createInitialProgress(): ProgressState {
    return { unlockedStage: 1 };
}

export function isStageUnlocked(progress: ProgressState, stage: number): boolean {
    return stage >= 1 && stage <= progress.unlockedStage;
}

export function unlockNextStage(progress: ProgressState, clearedStage: number): ProgressState {
    const nextUnlocked = Math.min(clearedStage + 1, STAGE_COUNT);
    return { unlockedStage: Math.max(progress.unlockedStage, nextUnlocked) };
}

export function isFinalStage(stage: number): boolean {
    return stage >= STAGE_COUNT;
}
