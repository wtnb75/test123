import { describe, expect, it } from 'vitest';
import { PauseState } from './pause';

// DOM key codes: Space 32, X 88, Enter 13, R 82, ArrowUp 38, W 87.
const SPACE = 32;
const X = 88;
const ENTER = 13;
const R = 82;
const UP = 38;
const W = 87;
const FRAME_MS = 16;

function pausedState(state = new PauseState()): PauseState {
    state.trigger();
    state.frame(FRAME_MS);
    return state;
}

describe('frame time', () => {
    it('advances by the frame delta while running', () => {
        expect(new PauseState().frame(16)).toBeCloseTo(0.016, 9);
    });

    it('caps a long frame at 0.05 s by default', () => {
        const p = new PauseState();
        expect(p.frame(50)).toBeCloseTo(0.05, 9);
        expect(p.frame(1000)).toBe(0.05);
    });

    it('caps a long frame at the given maxDt', () => {
        expect(new PauseState({ maxDt: 0.1 }).frame(1000)).toBe(0.1);
        expect(new PauseState({ maxDt: 0.1 }).frame(40)).toBeCloseTo(0.04, 9);
    });

    it('stops from the first frame after a trigger and stays stopped for any delta', () => {
        const p = new PauseState();
        p.trigger();
        expect(p.frame(FRAME_MS)).toBe(0);
        expect(p.isPaused).toBe(true);
        expect(p.frame(10000)).toBe(0);
    });

    it('does not pause before a trigger', () => {
        const p = new PauseState();
        p.frame(FRAME_MS);
        expect(p.isPaused).toBe(false);
    });

    it('advances by the capped delta in the frame it resumes, not by the paused time', () => {
        const p = pausedState();
        p.pointerDown();
        expect(p.frame(16)).toBeCloseTo(0.016, 9);
        expect(p.isPaused).toBe(false);
        const q = pausedState();
        q.pointerDown();
        expect(q.frame(10000)).toBe(0.05);
    });
});

describe('pause start', () => {
    it('reports the frame the pause began, once', () => {
        const p = new PauseState();
        p.trigger();
        p.frame(FRAME_MS);
        expect(p.pausedThisFrame).toBe(true);
        p.frame(FRAME_MS);
        expect(p.pausedThisFrame).toBe(false);
    });

    it('treats hidden and blur arriving together, or a trigger while paused, as one pause', () => {
        const p = new PauseState();
        p.trigger();
        p.trigger();
        p.frame(FRAME_MS);
        expect(p.pausedThisFrame).toBe(true);
        p.trigger();
        expect(p.frame(FRAME_MS)).toBe(0);
        expect(p.pausedThisFrame).toBe(false);
        expect(p.isPaused).toBe(true);
    });

    it('never reports a pause start while running', () => {
        const p = new PauseState();
        p.frame(FRAME_MS);
        expect(p.pausedThisFrame).toBe(false);
    });
});

describe('resume', () => {
    it.each([['Space', SPACE], ['X', X], ['Enter', ENTER]])('resumes on a fresh %s press', (_name, code) => {
        const p = pausedState();
        expect(p.keyDown(code, false)).toBe(false); // taken by the pause
        expect(p.frame(FRAME_MS)).toBeGreaterThan(0);
        expect(p.isPaused).toBe(false);
    });

    it('resumes on a click or tap, taking it so it neither acts nor drags', () => {
        const p = pausedState();
        expect(p.pointerDown()).toBe(true);
        p.frame(FRAME_MS);
        expect(p.isPaused).toBe(false);
    });

    it.each([['R', R], ['ArrowUp', UP], ['W', W]])('does not resume on %s', (_name, code) => {
        const p = pausedState();
        expect(p.keyDown(code, false)).toBe(false);
        expect(p.frame(FRAME_MS)).toBe(0);
        expect(p.isPaused).toBe(true);
    });

    it('resumes only on the given resumeKeyCodes', () => {
        const p = pausedState(new PauseState({ resumeKeyCodes: [R] }));
        p.keyDown(SPACE, false);
        expect(p.frame(FRAME_MS)).toBe(0);
        p.keyDown(R, false);
        expect(p.frame(FRAME_MS)).toBeGreaterThan(0);
    });

    it('does not resume on auto-repeat of a key held through the pause, only on pressing it again', () => {
        const p = pausedState();
        expect(p.keyDown(SPACE, true)).toBe(false);
        expect(p.frame(FRAME_MS)).toBe(0);
        p.keyDown(SPACE, false);
        expect(p.frame(FRAME_MS)).toBeGreaterThan(0);
    });

    it('ignores input that arrived before the trigger or in its frame', () => {
        const p = new PauseState();
        p.trigger();
        expect(p.pointerDown()).toBe(true); // taken: the pause is about to start
        expect(p.keyDown(SPACE, false)).toBe(false);
        expect(p.frame(FRAME_MS)).toBe(0);
        expect(p.frame(FRAME_MS)).toBe(0);
        expect(p.isPaused).toBe(true);
    });

    it('stays paused when a new trigger lands in the same frame as a resume tap', () => {
        const p = pausedState();
        p.pointerDown();
        p.trigger();
        expect(p.frame(FRAME_MS)).toBe(0);
        expect(p.frame(FRAME_MS)).toBe(0);
        expect(p.isPaused).toBe(true);
    });

    it('does not resume just because frames go by (page visible or focus back)', () => {
        const p = pausedState();
        for (let i = 0; i < 100; i++) expect(p.frame(FRAME_MS)).toBe(0);
        expect(p.isPaused).toBe(true);
    });

    it('resumes once when several resume inputs arrive in one frame', () => {
        const p = pausedState();
        p.pointerDown();
        p.keyDown(SPACE, false);
        p.keyDown(ENTER, false);
        expect(p.frame(FRAME_MS)).toBeGreaterThan(0);
        expect(p.pausedThisFrame).toBe(false);
        // Nothing is left over: the next pause needs its own resume.
        p.trigger();
        p.frame(FRAME_MS);
        expect(p.frame(FRAME_MS)).toBe(0);
    });
});

describe('keys while running', () => {
    it('passes a fresh press through', () => {
        expect(new PauseState().keyDown(SPACE, false)).toBe(true);
    });

    it('passes no auto-repeat through, e.g. a key held through a pause after resuming by tap', () => {
        const p = pausedState();
        p.pointerDown();
        p.frame(FRAME_MS);
        expect(p.keyDown(SPACE, true)).toBe(false);
        expect(p.keyDown(SPACE, false)).toBe(true);
    });

    it('lets clicks and taps through to the game', () => {
        expect(new PauseState().pointerDown()).toBe(false);
    });

    it('does not pass the key that resumed the game', () => {
        const p = pausedState();
        expect(p.keyDown(X, false)).toBe(false);
        p.frame(FRAME_MS);
        expect(p.isPaused).toBe(false);
    });
});
