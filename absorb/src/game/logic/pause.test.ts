import { describe, expect, it } from 'vitest';
import { MAX_DT } from './constants';
import { createPause } from './pause';
import { RETRY_KEY_CODES } from './retry';
import { World, type Input } from './world';

// The pause state itself is tested in shared/pause. Here: it is set to this game's cap and release keys,
// and a World stepped the way the Game scene does stands still while paused and plays on identically after.
// Expected values are worked out by hand from docs/spec/pause.md.
const FRAME_MS = 16;
const NONE: Input = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };

function pausedState() {
    const p = createPause();
    p.trigger();
    p.frame(FRAME_MS);
    return p;
}

describe('createPause', () => {
    it('caps a long frame at MAX_DT', () => {
        expect(createPause().frame(10000)).toBe(MAX_DT);
        expect(MAX_DT).toBe(0.05);
    });

    it.each(RETRY_KEY_CODES.map((code) => [code]))('resumes on a fresh press of release key %i', (code) => {
        const p = pausedState();
        expect(p.keyDown(code, false)).toBe(false); // taken by the pause, not a release
        expect(p.frame(FRAME_MS)).toBeGreaterThan(0);
    });

    it('does not resume on a key that does not release (R 82, ArrowUp 38)', () => {
        const p = pausedState();
        p.keyDown(82, false);
        p.keyDown(38, false);
        expect(p.frame(FRAME_MS)).toBe(0);
    });
});

describe('pause with the world', () => {
    it('holds the ready countdown at 1.5 s through a 10 s pause', () => {
        // Step a world the way the Game scene does: 1.5 s of ready, a 10 s pause at 60 fps, one resumed frame.
        const w = new World({ width: 1024, height: 768 }, () => 0.5);
        const p = createPause();
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
    function run(world: World, pause: ReturnType<typeof createPause>, frames: number, onFrame?: (i: number) => void): number {
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
        run(plain, createPause(), frames);

        const paused = new World({ width: 1024, height: 768 }, seeded(7));
        const pause = createPause();
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
