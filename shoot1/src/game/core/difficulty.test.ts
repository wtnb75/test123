import { describe, it, expect } from 'vitest';
import { getDifficultyParams } from '../core/difficulty';
import { BULLET_BASE_SPEED } from '../core/constants';

describe('getDifficultyParams', () => {
    it('0秒: 弾速が基準値、弾種が2種', () => {
        const p = getDifficultyParams(0);
        expect(p.bulletSpeed).toBe(BULLET_BASE_SPEED);
        expect(p.bulletTypes).toContain('straight');
        expect(p.bulletTypes).toContain('aimed');
        expect(p.bulletTypes).toHaveLength(2);
    });

    it('29秒: 序盤パラメータを維持', () => {
        const p = getDifficultyParams(29);
        expect(p.bulletSpeed).toBe(BULLET_BASE_SPEED);
        expect(p.formationSize).toBe(3);
    });

    it('30秒: 中盤に切り替わる（弾速が上がる）', () => {
        const p = getDifficultyParams(30);
        expect(p.bulletSpeed).toBeGreaterThan(BULLET_BASE_SPEED);
        expect(p.bulletTypes).toContain('nway3');
        expect(p.formationSize).toBe(4);
    });

    it('60秒: 後半パラメータに切り替わる', () => {
        const p = getDifficultyParams(60);
        expect(p.bulletTypes).toContain('nway5');
        expect(p.bulletTypes).toContain('fast');
        expect(p.formationSize).toBe(5);
    });

    it('120秒: 最大難易度になる', () => {
        const p120 = getDifficultyParams(120);
        const p60  = getDifficultyParams(60);
        expect(p120.bulletSpeed).toBeGreaterThan(p60.bulletSpeed);
        expect(p120.fireIntervalSec).toBeLessThan(p60.fireIntervalSec);
    });

    it('経過時間が長くなるほど fireIntervalSec が短い（または同等）', () => {
        const p0   = getDifficultyParams(0);
        const p30  = getDifficultyParams(30);
        const p60  = getDifficultyParams(60);
        const p120 = getDifficultyParams(120);
        expect(p30.fireIntervalSec).toBeLessThanOrEqual(p0.fireIntervalSec);
        expect(p60.fireIntervalSec).toBeLessThanOrEqual(p30.fireIntervalSec);
        expect(p120.fireIntervalSec).toBeLessThanOrEqual(p60.fireIntervalSec);
    });
});
