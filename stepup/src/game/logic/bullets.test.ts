import { describe, expect, it } from 'vitest';
import {
    bulletHitsPlayer,
    createBulletField,
    createWarn,
    stepBullets,
    warnTilt,
    warnTriangle,
    type Bullet,
    type BulletField,
} from './bullets';
import type { Player } from './physics';

/** An rng that returns the given values in order (then 0). */
const seq = (...values: number[]) => {
    let i = 0;
    return () => values[i++] ?? 0;
};
const idle = () => 0;
const bullet = (over: Partial<Bullet> = {}): Bullet => ({ x: 100, y: 0, vx: 0, vy: 200, ...over });
const field = (over: Partial<BulletField> = {}): BulletField => ({ ...createBulletField(), spawnTimer: 99, ...over });
const standing = (x: number, y: number): Player => ({ x, y, vy: 0, onGround: true, lock: 0 });

describe('createWarn', () => {
    it('draws x, kind and direction in that order; a diagonal at m = 8 flies left for 0.4', () => {
        const w = createWarn(8, seq(0, 0.249, 0.4));
        expect(w).toEqual({ x: 14, vx: -110, vy: 206.4, t: 0.8 });
    });

    it('draws a vertical bullet when kind is at the chance (0.25 at 8 m)', () => {
        expect(createWarn(8, seq(0.5, 0.25, 0.9)).vx).toBe(0);
    });

    it('keeps x inside [14, 346] for the extreme random values', () => {
        expect(createWarn(0, seq(0, 0, 0)).x).toBe(14);
        const high = createWarn(0, seq(0.9999999, 0, 0)).x;
        expect(high).toBeLessThanOrEqual(346);
        expect(high).toBeGreaterThan(345.9);
    });

    it('fixes the speed by the height now', () => {
        expect(createWarn(100, seq(0, 0.99, 0)).vy).toBeCloseTo(280, 10);
    });
});

describe('stepBullets: spawning', () => {
    it('shows the first warning after 1.0 s: not yet at 0.99 s, there by 1.01 s', () => {
        const f = createBulletField();
        stepBullets(f, 0.5, 0, 528, 0, idle);
        stepBullets(f, 0.49, 0, 528, 0, idle);
        expect(f.warns).toHaveLength(0);
        stepBullets(f, 0.02, 0, 528, 0, idle);
        expect(f.warns).toHaveLength(1);
    });

    it('shows the first warning exactly when 1.0 s has run out (0.5 s + 0.5 s)', () => {
        const f = createBulletField();
        stepBullets(f, 0.5, 0, 528, 0, idle);
        expect(f.warns).toHaveLength(0);
        stepBullets(f, 0.5, 0, 528, 0, idle);
        expect(f.warns).toHaveLength(1);
    });

    it('resets the timer to spawnInterval(m) without carrying the remainder, and does not tick the new warning', () => {
        const f = field({ spawnTimer: 0.1 });
        stepBullets(f, 0.5, 0, 528, 0, idle);
        expect(f.spawnTimer).toBe(1.2);
        expect(f.warns).toHaveLength(1);
        expect(f.warns[0].t).toBe(0.8);
    });

    it('spawns 2 warnings from 90 m, drawing x, kind, direction for each in turn', () => {
        const f = field({ spawnTimer: 0 });
        stepBullets(f, 0.01, 0, 528, 90, seq(0, 0, 0, 1 - 1e-9, 0.99, 0.9));
        expect(f.warns).toHaveLength(2);
        expect(f.warns[0]).toMatchObject({ x: 14, vx: -110 });
        expect(f.warns[1].x).toBeGreaterThan(345.9);
        expect(f.warns[1].vx).toBe(0);
    });

    it('spawns 1 warning below 90 m', () => {
        const f = field({ spawnTimer: 0 });
        stepBullets(f, 0.01, 0, 528, 89.99, idle);
        expect(f.warns).toHaveLength(1);
    });
});

describe('stepBullets: warnings become bullets', () => {
    it('turns a warning into a bullet after WARN_TIME, at the top edge, not moved that frame', () => {
        const f = field();
        f.warns.push({ x: 120, vx: 110, vy: 206.4, t: 0.8 });
        stepBullets(f, 0.4, -50, 528, 0, idle);
        expect(f.bullets).toHaveLength(0);
        stepBullets(f, 0.4, -50, 528, 0, idle);
        expect(f.warns).toHaveLength(0);
        expect(f.bullets).toEqual([{ x: 120, y: -57, vx: 110, vy: 206.4 }]);
    });

    it('keeps the speed fixed at warning time even when the height changed since', () => {
        const f = field();
        f.warns.push({ x: 120, vx: 0, vy: 200, t: 0.1 });
        stepBullets(f, 0.1, 0, 528, 200, idle);
        expect(f.bullets[0].vy).toBe(200);
    });

    it('moves a bullet by its speed', () => {
        const f = field();
        f.bullets.push(bullet({ x: 100, y: 0, vx: 110, vy: 200 }));
        stepBullets(f, 0.5, 0, 528, 0, idle);
        expect(f.bullets[0]).toMatchObject({ x: 155, y: 100 });
    });
});

describe('stepBullets: leaving the view', () => {
    const run = (b: Bullet) => {
        const f = field();
        f.bullets.push(b);
        stepBullets(f, 0, 100, 528, 0, idle);
        return f.bullets.length;
    };

    it('removes a bullet more than 20 px below the bottom edge, keeps one exactly 20 px below', () => {
        expect(run(bullet({ y: 100 + 528 + 20 }))).toBe(1);
        expect(run(bullet({ y: 100 + 528 + 20.01 }))).toBe(0);
    });

    it('removes a bullet more than 20 px outside the left or right edge', () => {
        expect(run(bullet({ x: -20 }))).toBe(1);
        expect(run(bullet({ x: -20.01 }))).toBe(0);
        expect(run(bullet({ x: 380 }))).toBe(1);
        expect(run(bullet({ x: 380.01 }))).toBe(0);
    });
});

describe('bulletHitsPlayer (circle r = 7 against a 20 x 28 box; touching counts)', () => {
    const p = standing(100, 200); // box x 90..110, y 172..200

    it('hits at a distance of exactly 7 from a side, misses at 7.01', () => {
        expect(bulletHitsPlayer(bullet({ x: 117, y: 190 }), p)).toBe(true);
        expect(bulletHitsPlayer(bullet({ x: 117.01, y: 190 }), p)).toBe(false);
        expect(bulletHitsPlayer(bullet({ x: 100, y: 207 }), p)).toBe(true);
        expect(bulletHitsPlayer(bullet({ x: 100, y: 207.01 }), p)).toBe(false);
        expect(bulletHitsPlayer(bullet({ x: 100, y: 165 }), p)).toBe(true);
        expect(bulletHitsPlayer(bullet({ x: 82.99, y: 190 }), p)).toBe(false);
    });

    it('hits at exactly 7 from the left and top sides and misses just beyond', () => {
        expect(bulletHitsPlayer(bullet({ x: 83, y: 190 }), p)).toBe(true);
        expect(bulletHitsPlayer(bullet({ x: 82.99, y: 190 }), p)).toBe(false);
        expect(bulletHitsPlayer(bullet({ x: 100, y: 165 }), p)).toBe(true);
        expect(bulletHitsPlayer(bullet({ x: 100, y: 164.99 }), p)).toBe(false);
    });

    it('measures from the corner diagonally (dx 4, dy 5.74 -> 6.996 hits; dy 5.75 -> 7.005 misses)', () => {
        expect(bulletHitsPlayer(bullet({ x: 114, y: 172 - 5.74 }), p)).toBe(true);
        expect(bulletHitsPlayer(bullet({ x: 114, y: 172 - 5.75 }), p)).toBe(false);
    });

    it('measures from the lower-left corner too', () => {
        expect(bulletHitsPlayer(bullet({ x: 86, y: 200 + 5.74 }), p)).toBe(true);
        expect(bulletHitsPlayer(bullet({ x: 86, y: 200 + 5.75 }), p)).toBe(false);
    });

    it('hits with the bullet centre inside the box', () => {
        expect(bulletHitsPlayer(bullet({ x: 100, y: 186 }), p)).toBe(true);
    });
});

describe('warn marks', () => {
    it('tilts by atan2(vx, vy): 0 for a vertical bullet, and less as the bullet gets faster', () => {
        expect(warnTilt({ vx: 0, vy: 200 })).toBe(0);
        expect(warnTilt({ vx: 110, vy: 200 })).toBeCloseTo(0.5028, 4); // 28.8 deg
        expect(warnTilt({ vx: 110, vy: 280 })).toBeCloseTo(0.3743, 4); // 21.4 deg
        expect(warnTilt({ vx: 110, vy: 360 })).toBeCloseTo(0.2965, 4); // 17.0 deg
        expect(warnTilt({ vx: -110, vy: 200 })).toBeCloseTo(-0.5028, 4);
    });

    it('draws a vertical triangle pointing down at WARN_Y', () => {
        const [a, b, c] = warnTriangle(100, 0);
        expect(a[0]).toBeCloseTo(91, 10);
        expect(a[1]).toBeCloseTo(35, 10);
        expect(b[0]).toBeCloseTo(109, 10);
        expect(b[1]).toBeCloseTo(35, 10);
        expect(c[0]).toBeCloseTo(100, 10);
        expect(c[1]).toBeCloseTo(55, 10);
    });

    it('tips the apex toward the flight direction and stays within 14 px of the centre', () => {
        const tilt = warnTilt({ vx: 110, vy: 200 });
        const pts = warnTriangle(100, tilt);
        expect(pts[2][0]).toBeGreaterThan(100); // pointing right-down
        const spread = Math.max(...pts.map((q) => Math.abs(q[0] - 100)));
        expect(spread).toBeGreaterThan(12.1);
        expect(spread).toBeLessThan(12.3);
        const left = warnTriangle(100, -tilt);
        expect(left[2][0]).toBeLessThan(100);
    });
});
