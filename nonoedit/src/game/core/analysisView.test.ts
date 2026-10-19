import { describe, expect, it } from 'vitest';
import {
    INITIAL_ANALYSIS,
    MESSAGE_ANALYSIS_STARTED,
    MESSAGE_ANALYSIS_UPDATED,
    MESSAGE_COPY_BLOCKED,
    MESSAGE_PLAY_STARTED,
    MESSAGE_PLAY_WARNING,
    PENDING_COUNT,
    PENDING_VALUE,
    TECHNIQUES,
    analysisPanelModel,
    arrivalMessage,
    canCopy,
    copyBlockedMessage,
    playStartMessage,
    playWarningOnArrival,
} from './analysisView';
import type { AnalysisResult } from './types';

const finished: AnalysisResult = {
    solvable: true,
    unique: true,
    logical: true,
    remainingCells: 3,
    techniquesUsed: { 'full-line-fill': 4, 'probe-consistency': 2 },
    score: 18,
    difficulty: 'normal',
    timedOut: false,
};

describe('constants', () => {
    it('the messages and markers are the ones the spec gives', () => {
        expect(PENDING_VALUE).toBe('…');
        expect(PENDING_COUNT).toBe('-');
        expect(MESSAGE_ANALYSIS_STARTED).toBe('Analysis started');
        expect(MESSAGE_ANALYSIS_UPDATED).toBe('Analysis updated');
        expect(MESSAGE_COPY_BLOCKED).toBe('Analysis running: copy after it finishes');
        expect(MESSAGE_PLAY_STARTED).toBe('Play mode started');
        expect(MESSAGE_PLAY_WARNING).toBe('Warning: puzzle is not unique/solvable but play is allowed');
    });

    it('all eight techniques are listed', () => {
        expect(TECHNIQUES).toHaveLength(8);
    });
});

describe('analysisPanelModel', () => {
    it('pending: the six values are …, every technique count is -, and no timeout row', () => {
        const model = analysisPanelModel(finished, true);
        expect([model.solvable, model.unique, model.logical, model.difficulty, model.score, model.remaining]).toEqual(['…', '…', '…', '…', '…', '…']);
        for (const technique of TECHNIQUES) {
            expect(model.techniques[technique]).toBe('-');
        }
        expect(model.timeoutShown).toBe(false);
    });

    it('pending: a timed-out previous result still shows no timeout row', () => {
        expect(analysisPanelModel({ ...finished, timedOut: true }, true).timeoutShown).toBe(false);
    });

    it('idle: the values and counts come from the result', () => {
        const model = analysisPanelModel(finished, false);
        expect(model.solvable).toBe('true');
        expect(model.unique).toBe('true');
        expect(model.logical).toBe('true');
        expect(model.difficulty).toBe('normal');
        expect(model.score).toBe('18');
        expect(model.remaining).toBe('3');
        expect(model.techniques['full-line-fill']).toBe('4');
        expect(model.techniques['probe-consistency']).toBe('2');
        expect(model.techniques['edge-overlap']).toBe('0');
        expect(model.timeoutShown).toBe(false);
    });

    it('idle: a timed-out result shows the timeout row', () => {
        const model = analysisPanelModel({ ...finished, solvable: false, logical: false, difficulty: 'unsolved', timedOut: true }, false);
        expect(model.timeoutShown).toBe(true);
        expect(model.difficulty).toBe('unsolved');
        expect(model.solvable).toBe('false');
    });
});

describe('canCopy', () => {
    it('is false while pending and true otherwise', () => {
        expect(canCopy(true)).toBe(false);
        expect(canCopy(false)).toBe(true);
    });
});

describe('playStartMessage', () => {
    it('pending: no warning, whatever the old result says', () => {
        expect(playStartMessage(true, { ...finished, unique: false })).toBe('Play mode started');
    });

    it('idle: a warning for a non-unique or non-solvable puzzle, none otherwise', () => {
        expect(playStartMessage(false, { ...finished, unique: false })).toBe(MESSAGE_PLAY_WARNING);
        expect(playStartMessage(false, { ...finished, solvable: false })).toBe(MESSAGE_PLAY_WARNING);
        expect(playStartMessage(false, finished)).toBe('Play mode started');
    });
});

describe('playWarningOnArrival', () => {
    it('in play mode, a non-unique or non-solvable result warns', () => {
        expect(playWarningOnArrival('play', { ...finished, unique: false })).toBe(MESSAGE_PLAY_WARNING);
        expect(playWarningOnArrival('play', { ...finished, solvable: false })).toBe(MESSAGE_PLAY_WARNING);
    });

    it('in play mode, a unique solvable result leaves the message alone (null)', () => {
        expect(playWarningOnArrival('play', finished)).toBeNull();
    });

    it('in edit mode, nothing is said whatever the result', () => {
        expect(playWarningOnArrival('edit', { ...finished, unique: false })).toBeNull();
        expect(playWarningOnArrival('edit', finished)).toBeNull();
    });
});

describe('arrivalMessage', () => {
    it('the [Analyze] button\'s result says "Analysis updated" (edit mode, healthy result)', () => {
        expect(arrivalMessage('edit', finished, true)).toBe('Analysis updated');
    });

    it('a result from any other request (key D, an edit, Import) leaves the message alone', () => {
        expect(arrivalMessage('edit', finished, false)).toBeNull();
        expect(arrivalMessage('play', finished, false)).toBeNull();
    });

    it('in play mode the warning wins over "Analysis updated", and it comes for any request', () => {
        const bad = { ...finished, unique: false };
        expect(arrivalMessage('play', bad, true)).toBe(MESSAGE_PLAY_WARNING);
        expect(arrivalMessage('play', bad, false)).toBe(MESSAGE_PLAY_WARNING);
    });

    it('in play mode a healthy result from the button is still "Analysis updated"', () => {
        expect(arrivalMessage('play', finished, true)).toBe('Analysis updated');
    });
});

describe('copyBlockedMessage', () => {
    it('while pending, a Copy attempt gets the "copy after it finishes" message', () => {
        expect(copyBlockedMessage(true)).toBe('Analysis running: copy after it finishes');
    });

    it('when idle, Copy may go ahead (null)', () => {
        expect(copyBlockedMessage(false)).toBeNull();
    });
});

describe('INITIAL_ANALYSIS', () => {
    it('is an unsolved placeholder that is never shown (the first display is pending)', () => {
        expect(INITIAL_ANALYSIS.difficulty).toBe('unsolved');
        expect(analysisPanelModel(INITIAL_ANALYSIS, true).score).toBe('…');
    });
});
