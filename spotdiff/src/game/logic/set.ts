import { generateStage } from './generate';
import type { Stage } from './generate';
import { mulberry32, seedFor } from './random';
import type { RunSummary } from './run';

export interface SetStart {
    date: number;
    setNo: number;
}

/** Starting a game from the Title: set 1 of the given (already fixed) date. */
export const firstSet = (date: number): SetStart => ({ date, setNo: 1 });

/** The set to play after a Result: the next number when cleared, the same set (same pictures) when it failed. */
export const setAfter = (summary: Pick<RunSummary, 'date' | 'setNo' | 'won'>): SetStart => ({
    date: summary.date,
    setNo: summary.won ? summary.setNo + 1 : summary.setNo,
});

/** Stage generator of one set: the pictures depend only on (date, set number, stage). */
export const makeStageFor =
    (date: number, setNo: number) =>
    (stage: number): Stage =>
        generateStage(stage, mulberry32(seedFor(date, setNo, stage)));
