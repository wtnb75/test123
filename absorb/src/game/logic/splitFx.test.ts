import { describe, expect, it } from 'vitest';
import { fadeAlpha } from './effects';
import { createEnemy, createSplitterChildren, setState, updateEnemy, type Enemy } from './enemy';
import { SplitEffects, childFlashesWhite, splitRingProgress, splitRingRadius } from './splitFx';
import { World, type Input } from './world';

const S = { width: 1024, height: 768 };
const DT = 1 / 60;
const NONE: Input = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };

// Expected values are worked out by hand from spec/splitter.md: the blink covers the last 0.15 s of a
// 0.4 s scatter (s ≥ 0.25), white / body / white in 0.05 s bands; the ring grows from 18 px to 40 px and
// fades out over 0.2 s.

const scatter = (stateTime: number) => ({ state: 'scatter' as const, stateTime });

describe('child dash warning', () => {
    it.each([
        [0, false],
        [0.249, false],
        [0.25, true],
        [0.299, true],
        [0.3, false],
        [0.349, false],
        [0.35, true],
        [0.399, true]
    ])('at %s s into the scatter is white: %s', (s, white) => {
        expect(childFlashesWhite(scatter(s))).toBe(white);
    });

    it('never flashes once the child is dashing', () => {
        expect(childFlashesWhite({ state: 'dash', stateTime: 0.25 })).toBe(false);
        expect(childFlashesWhite({ state: 'dash', stateTime: 0 })).toBe(false);
    });

    it('lines up with 60 fps frames: 14 body, 15–17 white, 18–20 body, 21–23 white, 24 dash', () => {
        const [k] = createSplitterChildren({ x: 500, y: 300 }, 0, 1, S);
        const ctx = { player: { x: 500, y: 700 }, elapsed: 40, rng: () => 0.5, screen: S };
        const seen: string[] = [];
        for (let frame = 1; frame <= 24; frame++) {
            updateEnemy(k, DT, ctx);
            seen.push(k.state === 'dash' ? 'D' : childFlashesWhite(k) ? 'W' : '.');
        }
        expect(seen.join('')).toBe('..............WWW...WWWD');
    });
});

describe('split ring', () => {
    it('grows from the splitter radius to 40 px and fades out over 0.2 s', () => {
        expect(splitRingProgress(0)).toBe(0);
        expect(splitRingRadius(splitRingProgress(0))).toBe(18);
        expect(splitRingProgress(0.1)).toBeCloseTo(0.5);
        expect(splitRingRadius(splitRingProgress(0.1))).toBeCloseTo(29);
        expect(splitRingRadius(splitRingProgress(0.2 - 1e-9))).toBeCloseTo(40);
        expect(splitRingProgress(0.2)).toBe(-1);
    });

    it('fades from opacity 1 at the split to 0.5 at 0.1 s', () => {
        expect(fadeAlpha(splitRingProgress(0))).toBe(1);
        expect(fadeAlpha(splitRingProgress(0.1))).toBeCloseTo(0.5);
    });

    it('starts one ring per split at its position, each aging on its own and dropped once done', () => {
        const fx = new SplitEffects();
        fx.update(DT, [{ x: 10, y: 20 }, { x: 30, y: 40 }]);
        expect(fx.rings).toEqual([{ x: 10, y: 20, age: 0 }, { x: 30, y: 40, age: 0 }]);
        fx.update(0.1, [{ x: 50, y: 60 }]);
        expect(fx.rings.map((r) => r.age)).toEqual([0.1, 0.1, 0]);
        fx.update(0.1, []);
        // The first two reached exactly 0.2 s and are gone; the third is at 0.1 s.
        expect(fx.rings).toEqual([{ x: 50, y: 60, age: 0.1 }]);
    });

    it('keeps its own copy of the position', () => {
        const fx = new SplitEffects();
        const split = { x: 10, y: 20 };
        fx.update(DT, [split]);
        split.x = 999;
        expect(fx.rings[0].x).toBe(10);
    });

    it('clears everything on restart', () => {
        const fx = new SplitEffects();
        fx.update(DT, [{ x: 1, y: 2 }]);
        fx.clear();
        expect(fx.rings).toHaveLength(0);
    });
});

/** A world already in the playing phase with spawning paused. */
function playingWorld(): World {
    const w = new World(S, () => 0.5);
    w.step(3, NONE);
    w.spawnTimer = Infinity;
    w.rammerTimer = Infinity;
    return w;
}

function addParent(w: World, x: number, y: number, hp = 1): Enemy {
    const e = createEnemy('splitter', 500 + w.enemies.length, () => 0.1, S);
    e.x = x;
    e.y = y;
    e.hp = hp;
    setState(e, 'drift');
    w.enemies.push(e);
    return e;
}

function shotAt(w: World, x: number, y: number): void {
    w.releaseBullets.push({
        x: x - 5, y, heading: 0, age: 0,
        group: { id: 0, pending: 1, kills: [], lastX: 0, lastY: 0, lastIsBoss: false }, target: null, removed: false
    });
}

describe('splits listed by the world for the split ring', () => {
    it('lists a parent killed by a release bullet at where it died, before clamping', () => {
        const w = playingWorld();
        const p = addParent(w, 2, 300);
        shotAt(w, 2, 300);
        w.step(DT, NONE);
        expect(w.splits).toHaveLength(1);
        expect(w.splits[0].x).toBe(p.x);
        expect(w.splits[0].y).toBe(p.y);
        expect(w.splits[0].x).toBeLessThan(8); // really outside the children's range, so clamping would show
        expect(w.enemies.every((e) => e.x >= 8)).toBe(true); // the children themselves were clamped
    });

    it('lists two parents killed in the same step', () => {
        const w = playingWorld();
        addParent(w, 300, 300);
        addParent(w, 700, 300);
        shotAt(w, 300, 300);
        shotAt(w, 700, 300);
        w.step(DT, NONE);
        expect(w.splits).toHaveLength(2);
    });

    it('lists nothing for a hit that leaves the parent alive, a rammed parent or a killed child', () => {
        const w = playingWorld();
        const damaged = addParent(w, 300, 300, 2);
        shotAt(w, 300, 300);
        const shot = w.releaseBullets[w.releaseBullets.length - 1];
        addParent(w, w.player.x, w.player.y);
        const [k] = createSplitterChildren({ x: 700, y: 300 }, 0, 900, S);
        w.enemies.push(k);
        w.releaseBullets.push({
            x: 700, y: 300 - 5 + 2, heading: Math.PI / 2, age: 0,
            group: { id: 0, pending: 1, kills: [], lastX: 0, lastY: 0, lastIsBoss: false }, target: null, removed: false
        });
        w.step(DT, NONE);
        expect(damaged.hp).toBe(1); // the shot really hit it
        expect(w.releaseBullets).not.toContain(shot);
        expect(w.player.lives).toBe(2);
        expect(w.enemies).not.toContain(k);
        expect(w.splits).toHaveLength(0);
    });

    it("forgets the previous step's splits", () => {
        const w = playingWorld();
        addParent(w, 300, 300);
        shotAt(w, 300, 300);
        w.step(DT, NONE);
        expect(w.splits).toHaveLength(1);
        w.step(DT, NONE);
        expect(w.splits).toHaveLength(0);
    });

    it('still lists a split made in the step a ram ends the run, and nothing during ending', () => {
        const w = playingWorld();
        w.player.lives = 1;
        addParent(w, 300, 300);
        shotAt(w, 300, 300);
        const grunt = createEnemy('grunt', 900, () => 0.5, S);
        grunt.x = w.player.x;
        grunt.y = w.player.y;
        grunt.state = 'dash';
        w.enemies.push(grunt);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        expect(w.splits).toHaveLength(1);
        addParent(w, 600, 300);
        shotAt(w, 600, 300);
        w.step(DT, NONE);
        expect(w.splits).toHaveLength(0);
    });

    it('lists nothing during ready', () => {
        const w = new World(S, () => 0.5);
        addParent(w, 300, 300);
        shotAt(w, 300, 300);
        w.step(DT, NONE);
        expect(w.phase).toBe('ready');
        expect(w.splits).toHaveLength(0);
    });
});
