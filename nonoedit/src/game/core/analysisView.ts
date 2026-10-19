import type { AnalysisResult, SolveTechnique } from './types';

// What the analysis panel, Copy and Test Play do while an analysis is pending (docs/spec/analysis-async.md).

export const PENDING_VALUE = '…';
export const PENDING_COUNT = '-';
export const MESSAGE_ANALYSIS_STARTED = 'Analysis started';
export const MESSAGE_ANALYSIS_UPDATED = 'Analysis updated';
export const MESSAGE_COPY_BLOCKED = 'Analysis running: copy after it finishes';
export const MESSAGE_PLAY_STARTED = 'Play mode started';
export const MESSAGE_PLAY_WARNING = 'Warning: puzzle is not unique/solvable but play is allowed';

export const TECHNIQUES: readonly SolveTechnique[] = [
    'full-line-fill',
    'full-line-empty',
    'edge-overlap',
    'candidate-common',
    'cross-constraint',
    'region-split',
    'box-reduction',
    'probe-consistency',
];

/** A result to show before the first analysis has finished; it is never displayed (the panel is pending) */
export const INITIAL_ANALYSIS: AnalysisResult = {
    solvable: false,
    unique: false,
    logical: false,
    remainingCells: 0,
    techniquesUsed: {},
    score: 0,
    difficulty: 'unsolved',
    timedOut: false,
};

export type AnalysisPanelModel = {
    solvable: string;
    unique: string;
    logical: string;
    difficulty: string;
    score: string;
    remaining: string;
    /** the count of each technique, or "-" while pending */
    techniques: Record<SolveTechnique, string>;
    /** the "timeout: 3s" row: only for a finished, timed-out result */
    timeoutShown: boolean;
};

/** The texts of the analysis panel: "…" and "-" while pending, the latest result otherwise */
export const analysisPanelModel = (analysis: AnalysisResult, pending: boolean): AnalysisPanelModel => {
    const techniques = {} as Record<SolveTechnique, string>;
    for (const technique of TECHNIQUES) {
        techniques[technique] = pending ? PENDING_COUNT : String(analysis.techniquesUsed[technique] ?? 0);
    }
    if (pending) {
        return {
            solvable: PENDING_VALUE,
            unique: PENDING_VALUE,
            logical: PENDING_VALUE,
            difficulty: PENDING_VALUE,
            score: PENDING_VALUE,
            remaining: PENDING_VALUE,
            techniques,
            timeoutShown: false,
        };
    }
    return {
        solvable: String(analysis.solvable),
        unique: String(analysis.unique),
        logical: String(analysis.logical),
        difficulty: analysis.difficulty,
        score: String(analysis.score),
        remaining: String(analysis.remainingCells),
        techniques,
        timeoutShown: analysis.timedOut,
    };
};

/** Copy is possible only when no analysis is pending (the PBM comments must match the board) */
export const canCopy = (pending: boolean): boolean => !pending;

/** The message shown when Play starts: no warning while the result is still pending */
export const playStartMessage = (pending: boolean, analysis: AnalysisResult): string =>
    !pending && (!analysis.unique || !analysis.solvable) ? MESSAGE_PLAY_WARNING : MESSAGE_PLAY_STARTED;

/** The warning for a result that arrives while playing; null means leave the message as it is */
export const playWarningOnArrival = (mode: 'edit' | 'play', analysis: AnalysisResult): string | null =>
    mode === 'play' && (!analysis.unique || !analysis.solvable) ? MESSAGE_PLAY_WARNING : null;

/**
 * The message line when a result arrives: the play warning (any request), otherwise "Analysis updated"
 * for the [Analyze] button's request only; null leaves the message as it is.
 */
export const arrivalMessage = (mode: 'edit' | 'play', analysis: AnalysisResult, fromButton: boolean): string | null =>
    playWarningOnArrival(mode, analysis) ?? (fromButton ? MESSAGE_ANALYSIS_UPDATED : null);

/** The message for a Copy attempt while an analysis is pending; null when Copy may go ahead */
export const copyBlockedMessage = (pending: boolean): string | null => (canCopy(pending) ? null : MESSAGE_COPY_BLOCKED);
