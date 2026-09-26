import { describe, expect, it } from 'vitest';
import { getStage, pickEnemyKind } from './difficulty';

describe('getStage', () => {
    it.each([
        [0, 3.0, 180, 10, 1],
        [29.999, 3.0, 180, 10, 1],
        [30, 2.5, 200, 8, 1],
        [59.999, 2.5, 200, 8, 1],
        [60, 2.0, 230, 6, 2],
        [119.999, 2.0, 230, 6, 2],
        [120, 1.6, 260, 4, 3],
        [1000, 1.6, 260, 4, 3]
    ])('at %s s uses spawn interval %s, bullet speed %s, rammer interval %s, %s rammer(s) at once', (t, spawn, speed, rammer, count) => {
        const s = getStage(t);
        expect(s.spawnInterval).toBe(spawn);
        expect(s.bulletSpeed).toBe(speed);
        expect(s.rammerInterval).toBe(rammer);
        expect(s.rammerCount).toBe(count);
    });

    it('treats a negative time as the first stage', () => {
        expect(getStage(-1).spawnInterval).toBe(3.0);
    });

    it('uses the spec weights for each stage', () => {
        expect(getStage(0).weights).toEqual({ grunt: 100, shooter: 0, heavy: 0 });
        expect(getStage(30).weights).toEqual({ grunt: 60, shooter: 25, heavy: 15 });
        expect(getStage(60).weights).toEqual({ grunt: 40, shooter: 30, heavy: 30 });
        expect(getStage(120).weights).toEqual({ grunt: 30, shooter: 30, heavy: 40 });
    });
});

describe('pickEnemyKind', () => {
    it('only picks grunts in the first 30 seconds', () => {
        for (const r of [0, 0.5, 0.9999]) expect(pickEnemyKind(10, () => r)).toBe('grunt');
    });

    it('splits 30–60 s at 60 / 25 / 15', () => {
        expect(pickEnemyKind(30, () => 0.5999)).toBe('grunt');
        expect(pickEnemyKind(30, () => 0.6)).toBe('shooter');
        expect(pickEnemyKind(30, () => 0.8499)).toBe('shooter');
        expect(pickEnemyKind(30, () => 0.85)).toBe('heavy');
    });

    it('splits 60–120 s at 40 / 30 / 30', () => {
        expect(pickEnemyKind(60, () => 0.3999)).toBe('grunt');
        expect(pickEnemyKind(60, () => 0.4)).toBe('shooter');
        expect(pickEnemyKind(60, () => 0.6999)).toBe('shooter');
        expect(pickEnemyKind(60, () => 0.7)).toBe('heavy');
    });

    it('splits 120 s and later at 30 / 30 / 40', () => {
        expect(pickEnemyKind(200, () => 0.2999)).toBe('grunt');
        expect(pickEnemyKind(200, () => 0.3)).toBe('shooter');
        expect(pickEnemyKind(200, () => 0.5999)).toBe('shooter');
        expect(pickEnemyKind(200, () => 0.6)).toBe('heavy');
    });

    it('falls back to a grunt if the rng returns exactly 1', () => {
        expect(pickEnemyKind(10, () => 1)).toBe('grunt');
    });

    it('matches the stage weights over many seeded draws', () => {
        let seed = 12345;
        const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const counts = { grunt: 0, shooter: 0, heavy: 0 };
        const n = 20000;
        for (let i = 0; i < n; i++) counts[pickEnemyKind(60, rng)]++;
        expect(counts.grunt / n).toBeCloseTo(0.4, 1);
        expect(counts.shooter / n).toBeCloseTo(0.3, 1);
        expect(counts.heavy / n).toBeCloseTo(0.3, 1);
    });
});
