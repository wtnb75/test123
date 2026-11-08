import { describe, expect, it } from 'vitest';
import {
    bulletSpeed,
    bulletsPerSpawn,
    diagonalChance,
    displayMeters,
    meters,
    pickBulletVx,
    scrollSpeed,
    spawnInterval,
} from './difficulty';

describe('meters / displayMeters', () => {
    it('is 0 at the start and counts 10 px per metre up to the highest point', () => {
        expect(meters(264, 264)).toBe(0);
        expect(meters(264, 164)).toBe(10);
        expect(meters(264, -1736)).toBe(200);
    });

    it('is never negative when the highest point is below the start', () => {
        expect(meters(264, 300)).toBe(0);
    });

    it('shows the truncated height capped at the goal (199.9 -> 199, 200 -> 200, 205 -> 200)', () => {
        expect(displayMeters(0)).toBe(0);
        expect(displayMeters(199.9)).toBe(199);
        expect(displayMeters(200)).toBe(200);
        expect(displayMeters(205.7)).toBe(200);
    });
});

describe('difficulty curves (values hand-worked from the spec table)', () => {
    it('scrollSpeed: 32 + 0.05 m, capped at 45 (reached at 260 m)', () => {
        expect(scrollSpeed(0)).toBe(32);
        expect(scrollSpeed(8)).toBeCloseTo(32.4, 10);
        expect(scrollSpeed(100)).toBeCloseTo(37, 10);
        expect(scrollSpeed(200)).toBeCloseTo(42, 10);
        expect(scrollSpeed(260)).toBeCloseTo(45, 10);
        expect(scrollSpeed(1000)).toBe(45);
    });

    it('bulletSpeed: 200 + 0.8 m, capped at 380 (reached at 225 m)', () => {
        expect(bulletSpeed(0)).toBe(200);
        expect(bulletSpeed(100)).toBeCloseTo(280, 10);
        expect(bulletSpeed(200)).toBeCloseTo(360, 10);
        expect(bulletSpeed(225)).toBeCloseTo(380, 10);
        expect(bulletSpeed(1000)).toBe(380);
    });

    it('spawnInterval: 1.2 - 0.004 m, floored at 0.45 (reached at 187.5 m)', () => {
        expect(spawnInterval(0)).toBe(1.2);
        expect(spawnInterval(100)).toBeCloseTo(0.8, 10);
        expect(spawnInterval(187.5)).toBeCloseTo(0.45, 10);
        expect(spawnInterval(200)).toBe(0.45);
    });

    it('bulletsPerSpawn: 1 below 90 m, 2 from 90 m', () => {
        expect(bulletsPerSpawn(89.99)).toBe(1);
        expect(bulletsPerSpawn(90)).toBe(2);
    });

    it('diagonalChance: 0 below 8 m, 0.25 at 8 m, growing 0.003 per metre, capped at 0.65 from 141.34 m', () => {
        expect(diagonalChance(7.99)).toBe(0);
        expect(diagonalChance(8)).toBe(0.25);
        expect(diagonalChance(50)).toBeCloseTo(0.376, 10);
        expect(diagonalChance(100)).toBeCloseTo(0.526, 10);
        expect(diagonalChance(141.33)).toBeLessThan(0.65);
        expect(diagonalChance(141.34)).toBe(0.65);
        expect(diagonalChance(200)).toBe(0.65);
    });
});

describe('the spec difficulty table, column by column', () => {
    // m, scrollSpeed, bulletSpeed, spawnInterval, diagonalChance, bulletsPerSpawn (hand-worked from the formulas)
    it.each([
        [0, 32, 200, 1.2, 0, 1],
        [8, 32.4, 206.4, 1.168, 0.25, 1],
        [50, 34.5, 240, 1.0, 0.376, 1],
        [90, 36.5, 272, 0.84, 0.496, 2],
        [100, 37, 280, 0.8, 0.526, 2],
        [141.3, 39.065, 313.04, 0.6348, 0.6499, 2],
        [200, 42, 360, 0.45, 0.65, 2],
    ])('at %f m', (m, scroll, speed, interval, diagonal, count) => {
        expect(scrollSpeed(m)).toBeCloseTo(scroll, 6);
        expect(bulletSpeed(m)).toBeCloseTo(speed, 6);
        expect(spawnInterval(m)).toBeCloseTo(interval, 6);
        expect(diagonalChance(m)).toBeCloseTo(diagonal, 6);
        expect(bulletsPerSpawn(m)).toBe(count);
    });
});

describe('pickBulletVx', () => {
    it('is always vertical below 8 m', () => {
        expect(pickBulletVx(7.99, 0, 0)).toBe(0);
    });

    it('is diagonal when randKind is below the chance and vertical at the chance exactly (m = 8: 0.25)', () => {
        expect(pickBulletVx(8, 0.249, 0.9)).toBe(110);
        expect(pickBulletVx(8, 0.25, 0.9)).toBe(0);
    });

    it('goes left for randSign < 0.5 and right otherwise', () => {
        expect(pickBulletVx(8, 0, 0.499)).toBe(-110);
        expect(pickBulletVx(8, 0, 0.5)).toBe(110);
    });
});
