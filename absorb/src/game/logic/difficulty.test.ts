import { describe, expect, it } from 'vitest';
import { getStage, pickEnemyKind } from './difficulty';

describe('getStage', () => {
    it.each([
        [0, 3.0, 180, 10],
        [29.999, 3.0, 180, 10],
        [30, 2.5, 200, 8],
        [59.999, 2.5, 200, 8],
        [60, 2.0, 230, 6],
        [119.999, 2.0, 230, 6],
        [120, 1.6, 260, 4],
        [1000, 1.6, 260, 4]
    ])('at %s s uses spawn interval %s, bullet speed %s, rammer interval %s', (t, spawn, speed, rammer) => {
        const s = getStage(t);
        expect(s.spawnInterval).toBe(spawn);
        expect(s.bulletSpeed).toBe(speed);
        expect(s.rammerInterval).toBe(rammer);
    });

    it('treats a negative time as the first stage', () => {
        expect(getStage(-1).spawnInterval).toBe(3.0);
    });

    it('uses the spec weights for each stage', () => {
        expect(getStage(0).weights).toEqual({ grunt: 100, shooter: 0, heavy: 0 });
        expect(getStage(30).weights).toEqual({ grunt: 70, shooter: 30, heavy: 0 });
        expect(getStage(60).weights).toEqual({ grunt: 50, shooter: 30, heavy: 20 });
        expect(getStage(120).weights).toEqual({ grunt: 35, shooter: 30, heavy: 35 });
    });
});

describe('pickEnemyKind', () => {
    it('only picks grunts in the first 30 seconds', () => {
        for (const r of [0, 0.5, 0.9999]) expect(pickEnemyKind(10, () => r)).toBe('grunt');
    });

    it('splits 30–60 s at 70% grunt / 30% shooter', () => {
        expect(pickEnemyKind(30, () => 0.6999)).toBe('grunt');
        expect(pickEnemyKind(30, () => 0.7)).toBe('shooter');
        expect(pickEnemyKind(30, () => 0.9999)).toBe('shooter');
    });

    it('splits 60–120 s at 50 / 30 / 20', () => {
        expect(pickEnemyKind(60, () => 0.4999)).toBe('grunt');
        expect(pickEnemyKind(60, () => 0.5)).toBe('shooter');
        expect(pickEnemyKind(60, () => 0.7999)).toBe('shooter');
        expect(pickEnemyKind(60, () => 0.8)).toBe('heavy');
    });

    it('splits 120 s and later at 35 / 30 / 35', () => {
        expect(pickEnemyKind(200, () => 0.3499)).toBe('grunt');
        expect(pickEnemyKind(200, () => 0.35)).toBe('shooter');
        expect(pickEnemyKind(200, () => 0.65)).toBe('heavy');
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
        expect(counts.grunt / n).toBeCloseTo(0.5, 1);
        expect(counts.shooter / n).toBeCloseTo(0.3, 1);
        expect(counts.heavy / n).toBeCloseTo(0.2, 1);
    });
});
