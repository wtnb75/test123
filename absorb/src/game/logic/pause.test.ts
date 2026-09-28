import { describe, expect, it } from 'vitest';
import { PauseState } from './pause';
import { World, type Input } from './world';

// Expected values are worked out by hand from docs/spec/pause.md: a trigger pauses from the next frame,
// frames advance 0 s while paused and the frame delta capped at 0.05 s otherwise; only a fresh press of
// Space / X / Enter or a click/tap made while paused resumes, from that frame on.
// PauseState knows no phase: the Game scene feeds every phase (ready, playing, ending) through frame(),
// so pausing works the same in each; the phases themselves are checked in the browser (game-qa).
// DOM key codes: Space 32, X 88, Enter 13, R 82, ArrowUp 38, W 87.
const SPACE = 32;
const X = 88;
const ENTER = 13;
const R = 82;
const UP = 38;
const W = 87;
const FRAME_MS = 16;

function pausedState(): PauseState {
    const p = new PauseState();
    p.trigger();
    p.frame(FRAME_MS);
    return p;
}

describe('pause frame time', () => {
    it('advances by the frame delta while running', () => {
        expect(new PauseState().frame(16)).toBeCloseTo(0.016, 9);
    });

    it('caps a long frame at 0.05 s', () => {
        const p = new PauseState();
        expect(p.frame(50)).toBeCloseTo(0.05, 9);
        expect(p.frame(1000)).toBe(0.05);
    });

    it('stops from the first frame after a trigger and stays stopped for any delta', () => {
        const p = new PauseState();
        p.trigger();
        expect(p.frame(FRAME_MS)).toBe(0);
        expect(p.isPaused).toBe(true);
        expect(p.frame(10000)).toBe(0);
        expect(p.frame(FRAME_MS)).toBe(0);
    });

    it('does not pause before a trigger', () => {
        const p = new PauseState();
        expect(p.isPaused).toBe(false);
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

    it('holds the ready countdown at 1.5 s through a 10 s pause', () => {
        // Step a world the way the Game scene does: 1.5 s of ready, a 10 s pause at 60 fps, one resumed frame.
        const NONE: Input = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };
        const w = new World({ width: 1024, height: 768 }, () => 0.5);
        const p = new PauseState();
        const frame = (ms: number) => {
            const dt = p.frame(ms);
            if (!p.isPaused) w.step(dt, NONE);
        };
        for (let i = 0; i < 30; i++) frame(50);
        expect(w.phase).toBe('ready');
        expect(w.phaseTime).toBeCloseTo(1.5, 9);
        p.trigger();
        for (let i = 0; i < 600; i++) frame(1000 / 60);
        expect(w.phase).toBe('ready');
        expect(w.phaseTime).toBeCloseTo(1.5, 9);
        p.pointerDown();
        frame(16);
        expect(w.phase).toBe('ready');
        expect(w.phaseTime).toBeCloseTo(1.516, 9);
    });
});

describe('a run with a pause', () => {
    const NONE: Input = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };
    /** A small deterministic LCG so both runs see the same random sequence. */
    function seeded(seed: number): () => number {
        let s = seed;
        return () => {
            s = (s * 1664525 + 1013904223) % 4294967296;
            return s / 4294967296;
        };
    }
    /**
     * Steps the world the way the Game scene does, only when the pause hands out time, until it has played
     * `frames` frames. Returns how many frames were spent paused.
     */
    function run(world: World, pause: PauseState, frames: number, onFrame?: (i: number) => void): number {
        let played = 0;
        let idle = 0;
        for (let i = 0; played < frames; i++) {
            onFrame?.(i);
            const dt = pause.frame(1000 / 60);
            if (pause.isPaused) {
                idle++;
                continue;
            }
            world.step(dt, NONE);
            played++;
        }
        return idle;
    }
    const snapshot = (w: World) => JSON.stringify({
        phase: w.phase, score: w.score, lives: w.player.lives, stock: w.stock, player: [w.player.x, w.player.y],
        enemies: w.enemies.map((e) => [e.kind, e.x, e.y, e.hp]), bullets: w.enemyBullets.map((b) => [b.x, b.y])
    });

    it('plays out exactly like a run without it, just later (same random numbers, same input)', () => {
        // 40 s of play covers the ready countdown, spawns of several kinds, enemy fire and hits.
        const frames = 40 * 60;
        const plain = new World({ width: 1024, height: 768 }, seeded(7));
        run(plain, new PauseState(), frames);

        const paused = new World({ width: 1024, height: 768 }, seeded(7));
        const pause = new PauseState();
        const idle = run(paused, pause, frames, (i) => {
            if (i === 90 || i === 1500) pause.trigger(); // once in ready, once mid-play
            if (i === 400 || i === 1800) pause.pointerDown(); // resume after 5+ s of pause
        });
        // Both pauses really happened (frame 91 to 400 and 1501 to 1800), and the screen compared is busy.
        expect(idle).toBe(310 + 300);
        expect(plain.enemies.length).toBeGreaterThan(0);
        expect(snapshot(paused)).toBe(snapshot(plain));
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

    it('treats hidden and blur arriving together, or a trigger while paused, as the same pause', () => {
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
        expect(p.releaseKeyDown(code, false)).toBe(false); // taken by the pause, not a release
        expect(p.frame(FRAME_MS)).toBeGreaterThan(0);
        expect(p.isPaused).toBe(false);
    });

    it('resumes on a click or tap, taking it so it neither releases nor drags', () => {
        const p = pausedState();
        expect(p.pointerDown()).toBe(true);
        p.frame(FRAME_MS);
        expect(p.isPaused).toBe(false);
    });

    it.each([['R', R], ['ArrowUp', UP], ['W', W]])('does not resume on %s', (_name, code) => {
        const p = pausedState();
        expect(p.releaseKeyDown(code, false)).toBe(false);
        expect(p.frame(FRAME_MS)).toBe(0);
        expect(p.isPaused).toBe(true);
    });

    it('does not resume on auto-repeat of a key held through the pause, only on pressing it again', () => {
        const p = pausedState();
        expect(p.releaseKeyDown(SPACE, true)).toBe(false);
        expect(p.frame(FRAME_MS)).toBe(0);
        expect(p.releaseKeyDown(SPACE, true)).toBe(false);
        expect(p.frame(FRAME_MS)).toBe(0);
        p.releaseKeyDown(SPACE, false);
        expect(p.frame(FRAME_MS)).toBeGreaterThan(0);
    });

    it('ignores input that arrived before the trigger or in its frame', () => {
        const p = new PauseState();
        p.trigger();
        expect(p.pointerDown()).toBe(true); // taken: the pause is about to start
        expect(p.releaseKeyDown(SPACE, false)).toBe(false);
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
        p.releaseKeyDown(SPACE, false);
        p.releaseKeyDown(ENTER, false);
        expect(p.frame(FRAME_MS)).toBeGreaterThan(0);
        expect(p.pausedThisFrame).toBe(false);
        // Nothing is left over: the next pause needs its own resume.
        p.trigger();
        p.frame(FRAME_MS);
        expect(p.frame(FRAME_MS)).toBe(0);
    });
});

describe('release keys while running', () => {
    it('releases on a fresh press', () => {
        expect(new PauseState().releaseKeyDown(SPACE, false)).toBe(true);
    });

    it('never releases on auto-repeat, e.g. a key held through a pause after resuming by tap', () => {
        const p = pausedState();
        p.pointerDown();
        p.frame(FRAME_MS);
        expect(p.releaseKeyDown(SPACE, true)).toBe(false);
        expect(p.releaseKeyDown(SPACE, false)).toBe(true);
    });

    it('lets clicks and taps through to the game', () => {
        expect(new PauseState().pointerDown()).toBe(false);
    });

    it('does not release with the key that resumed the game', () => {
        const p = pausedState();
        expect(p.releaseKeyDown(X, false)).toBe(false);
        p.frame(FRAME_MS);
        expect(p.isPaused).toBe(false);
    });
});
