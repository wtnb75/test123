import { describe, expect, it } from 'vitest';
import { GOAL_H, JUMP_LOCK, JUMP_SPEED, MAX_FALL, PLATFORM_H, PLATFORM_LIFE, PLATFORM_W } from '../params';
import {
    clampToView,
    createBuiltPlatform,
    createPlayer,
    createWidePlatform,
    platformAlpha,
    pressAction,
    stepPlayer,
    tickTimers,
    type Platform,
    type Player,
} from './physics';

const player = (over: Partial<Player> = {}): Player => ({ x: 150, y: 300, vy: 0, onGround: false, lock: 0, ...over });
const plat = (x: number, y: number, over: Partial<Platform> = {}): Platform => ({
    kind: 'built',
    x,
    y,
    w: PLATFORM_W,
    h: PLATFORM_H,
    age: 0,
    ...over,
});

describe('createPlayer / platforms', () => {
    it('starts standing at the screen centre with no jump lock', () => {
        expect(createPlayer(264)).toEqual({ x: 180, y: 264, vy: 0, onGround: true, lock: 0 });
    });

    it('makes the start ground and the goal wider than the screen', () => {
        const g = createWidePlatform('goal', -1736, GOAL_H);
        expect(g).toMatchObject({ kind: 'goal', x: 180, y: -1736, w: 720, h: 14, age: 0 });
    });

    it('builds an 80 x 10 platform', () => {
        expect(createBuiltPlatform(120, 200)).toEqual({ kind: 'built', x: 120, y: 200, w: 80, h: 10, age: 0 });
    });
});

describe('pressAction', () => {
    it('jumps on the ground: upward speed, jump lock, no longer on the ground', () => {
        const p = player({ onGround: true });
        const platforms: Platform[] = [];
        expect(pressAction(p, platforms)).toBe('jump');
        expect(p).toMatchObject({ vy: -JUMP_SPEED, lock: JUMP_LOCK, onGround: false });
        expect(platforms).toHaveLength(0);
    });

    it('builds a platform under the feet in the air', () => {
        const p = player({ x: 120, y: 222 });
        const platforms: Platform[] = [];
        expect(pressAction(p, platforms)).toBe('platform');
        expect(platforms).toEqual([{ kind: 'built', x: 120, y: 222, w: 80, h: 10, age: 0 }]);
    });

    it('does nothing in the air while the jump lock runs', () => {
        const p = player({ lock: 0.05 });
        const platforms: Platform[] = [];
        expect(pressAction(p, platforms)).toBe('none');
        expect(platforms).toHaveLength(0);
    });

    it('locks for 0.3 s after a jump: nothing at 0.25 s (and 0.283 s), a platform from 0.317 s', () => {
        const at = (frames: number) => {
            const p = player({ onGround: true });
            const platforms: Platform[] = [];
            pressAction(p, platforms); // the jump
            for (let i = 0; i < frames; i++) tickTimers(p, platforms, 1 / 60);
            return pressAction(p, platforms);
        };
        expect(at(15)).toBe('none'); // 0.25 s
        expect(at(17)).toBe('none'); // 0.283 s
        expect(at(19)).toBe('platform'); // 0.317 s
        expect(at(21)).toBe('platform'); // 0.35 s
    });

    it('builds as soon as the lock is 0 (e.g. after walking off a platform edge)', () => {
        const p = player({ lock: 0 });
        expect(pressAction(p, [])).toBe('platform');
    });

    it('keeps at most 2 built platforms, removing the oldest first, and never the ground or goal', () => {
        const ground = createWidePlatform('ground', 264, PLATFORM_H);
        const goal = createWidePlatform('goal', -1736, GOAL_H);
        const platforms: Platform[] = [ground, goal];
        const p = player();
        p.y = 200;
        pressAction(p, platforms);
        p.y = 190;
        pressAction(p, platforms);
        p.y = 180;
        pressAction(p, platforms);
        const built = platforms.filter((q) => q.kind === 'built');
        expect(built.map((q) => q.y)).toEqual([190, 180]);
        expect(platforms).toContain(ground);
        expect(platforms).toContain(goal);
    });
});

describe('tickTimers', () => {
    it('counts the jump lock down and stops at 0', () => {
        const p = player({ lock: 0.3 });
        tickTimers(p, [], 0.1);
        expect(p.lock).toBeCloseTo(0.2, 10);
        tickTimers(p, [], 1);
        expect(p.lock).toBe(0);
    });

    it('ages built platforms and removes one that reaches its lifetime', () => {
        const a = plat(100, 100, { age: 2.5 });
        const platforms = [a];
        tickTimers(player(), platforms, PLATFORM_LIFE - 2.5 - 0.01);
        expect(platforms).toHaveLength(1);
        tickTimers(player(), platforms, 0.01);
        expect(platforms).toHaveLength(0);
    });

    it('removes a platform whose age hits the lifetime exactly (3.0 s)', () => {
        const platforms = [plat(100, 100, { age: 2 })];
        tickTimers(player(), platforms, 1);
        expect(platforms).toHaveLength(0);
    });

    it('never ages or removes the start ground and the goal', () => {
        const platforms = [createWidePlatform('ground', 264, PLATFORM_H), createWidePlatform('goal', 0, GOAL_H)];
        tickTimers(player(), platforms, 100);
        expect(platforms.map((q) => q.age)).toEqual([0, 0]);
        expect(platforms).toHaveLength(2);
    });
});

describe('platformAlpha', () => {
    it('fades a built platform from 1 to 0.3 in proportion to its age', () => {
        expect(platformAlpha(plat(0, 0, { age: 0 }))).toBe(1);
        expect(platformAlpha(plat(0, 0, { age: 1.5 }))).toBeCloseTo(0.65, 10);
        expect(platformAlpha(plat(0, 0, { age: 3 }))).toBeCloseTo(0.3, 10);
    });

    it('does not go below 0.3 for an age past the lifetime', () => {
        expect(platformAlpha(plat(0, 0, { age: 9 }))).toBeCloseTo(0.3, 10);
    });

    it('keeps ground and goal fully opaque', () => {
        expect(platformAlpha(createWidePlatform('ground', 0, PLATFORM_H))).toBe(1);
        expect(platformAlpha(createWidePlatform('goal', 0, GOAL_H))).toBe(1);
    });
});

describe('stepPlayer: jump', () => {
    it('reaches a peak of 99-101 px at dt = 1/60 (semi-implicit Euler; the continuous 104.5 px is 4.6 px higher)', () => {
        const ground = plat(180, 300, { kind: 'ground', w: 720 });
        const p = player({ y: 300, onGround: true });
        pressAction(p, [ground]);
        let top = p.y;
        for (let i = 0; i < 200 && !p.onGround; i++) {
            stepPlayer(p, 0, 1 / 60, [ground], -10000);
            top = Math.min(top, p.y);
        }
        expect(300 - top).toBeGreaterThanOrEqual(99);
        expect(300 - top).toBeLessThanOrEqual(101);
        expect(p.onGround).toBe(true);
        expect(p.y).toBe(300);
    });
});

describe('stepPlayer: one-way platforms', () => {
    it('passes through a platform while rising', () => {
        const p = player({ y: 105, vy: -300 });
        stepPlayer(p, 0, 0.1, [plat(150, 100)], -10000);
        expect(p.y).toBeCloseTo(90, 10);
        expect(p.onGround).toBe(false);
    });

    it('lands on the top surface when falling through it', () => {
        const p = player({ y: 95, vy: 100 });
        stepPlayer(p, 0, 0.1, [plat(150, 100)], -10000);
        expect(p).toMatchObject({ y: 100, vy: 0, onGround: true });
    });

    it('lands when the feet arrive exactly at the top surface', () => {
        const p = player({ y: 85, vy: 0 });
        stepPlayer(p, 0, 0.1, [plat(150, 100)], -10000); // vy 150, feet 85 + 15 = 100
        expect(p).toMatchObject({ y: 100, vy: 0, onGround: true });
    });

    it('lands when the feet start exactly at the top surface', () => {
        const p = player({ y: 100, vy: 0 });
        stepPlayer(p, 0, 1 / 60, [plat(150, 100)], -10000);
        expect(p).toMatchObject({ y: 100, vy: 0, onGround: true });
    });

    it('lands right away on a platform just built under the feet', () => {
        const p = player({ y: 222, vy: 50 });
        const platforms: Platform[] = [];
        pressAction(p, platforms);
        stepPlayer(p, 0, 1 / 60, platforms, -10000);
        expect(p).toMatchObject({ y: 222, onGround: true });
    });

    it('does not land when the feet were already below the top surface', () => {
        const p = player({ y: 101, vy: 100 });
        stepPlayer(p, 0, 0.1, [plat(150, 100)], -10000);
        expect(p.onGround).toBe(false);
        expect(p.y).toBeGreaterThan(101);
    });

    it('lands only when x overlaps: |dx| = 50 misses, 49.9 lands', () => {
        const miss = player({ x: 150, y: 95, vy: 100 });
        stepPlayer(miss, 0, 0.1, [plat(100, 100)], -10000);
        expect(miss.onGround).toBe(false);
        const hit = player({ x: 149.9, y: 95, vy: 100 });
        stepPlayer(hit, 0, 0.1, [plat(100, 100)], -10000);
        expect(hit.onGround).toBe(true);
    });

    it('lands on the highest surface when two platforms are crossed in one step', () => {
        const p = player({ y: 95, vy: 200 });
        stepPlayer(p, 0, 0.1, [plat(150, 105), plat(150, 100)], -10000);
        expect(p.y).toBe(100);
        expect(p.onGround).toBe(true);
    });

    it('lands on a platform it passed through rising, when it falls back', () => {
        const platform = plat(150, 100);
        const p = player({ y: 140, vy: -560 });
        let landedAt = NaN;
        for (let i = 0; i < 300; i++) {
            stepPlayer(p, 0, 1 / 60, [platform], -10000);
            if (p.onGround) {
                landedAt = p.y;
                break;
            }
        }
        expect(landedAt).toBe(100);
    });
});

describe('stepPlayer: movement and limits', () => {
    it('moves sideways at 190 px/s and stops at the screen edges (x in [10, 350])', () => {
        const p = player({ x: 100 });
        stepPlayer(p, 1, 0.1, [], -10000);
        expect(p.x).toBeCloseTo(119, 10);
        const left = player({ x: 15 });
        stepPlayer(left, -1, 1, [], -10000);
        expect(left.x).toBe(10);
        const right = player({ x: 345 });
        stepPlayer(right, 1, 1, [], -10000);
        expect(right.x).toBe(350);
    });

    it('caps the fall speed at 900 px/s', () => {
        const p = player({ vy: 890 });
        stepPlayer(p, 0, 1 / 30, [], -10000);
        expect(p.vy).toBe(MAX_FALL);
    });

    it('is not on the ground without a platform below', () => {
        const p = player({ onGround: true });
        stepPlayer(p, 0, 1 / 60, [], -10000);
        expect(p.onGround).toBe(false);
    });
});

describe('clampToView (the head never goes above the top edge)', () => {
    it('puts the head on the top edge and stops the upward speed', () => {
        const p = player({ y: 110, vy: -100 });
        clampToView(p, 100);
        expect(p).toMatchObject({ y: 128, vy: 0 });
    });

    it('keeps a downward speed', () => {
        const p = player({ y: 110, vy: 50 });
        clampToView(p, 100);
        expect(p).toMatchObject({ y: 128, vy: 50 });
    });

    it('leaves a player whose head is exactly on the edge or below', () => {
        const edge = player({ y: 128, vy: -10 });
        clampToView(edge, 100);
        expect(edge).toMatchObject({ y: 128, vy: -10 });
    });

    it('is applied by stepPlayer after the move', () => {
        const p = player({ y: 130, vy: -560 });
        stepPlayer(p, 0, 1 / 60, [], 100); // vy -535, feet 121.08 -> pushed back to 128
        expect(p.y).toBe(128);
        expect(p.vy).toBe(0);
    });
});
