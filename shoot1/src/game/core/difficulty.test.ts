import { describe, it, expect } from 'vitest';
import { getDifficultyParams } from '../core/difficulty';
import { BULLET_BASE_SPEED } from '../core/constants';

describe('getDifficultyParams', () => {
    it('0秒: 弾速が基準値、弾種は直下弾のみ', () => {
        const p = getDifficultyParams(0);
        expect(p.bulletSpeed).toBe(BULLET_BASE_SPEED);
        expect(p.bulletTypes).toEqual(['straight']);
    });

    it('9.99秒: 1段階目（横一列のみ・撃つ間隔2.0秒・出現間隔4秒）', () => {
        const p = getDifficultyParams(9.99);
        expect(p.bulletTypes).toEqual(['straight']);
        expect(p.formationShapes).toEqual(['row']);
        expect(p.fireIntervalSec).toBe(2.0);
        expect(p.formationIntervalSec).toBe(4);
    });

    it('10秒ちょうど: 2段階目（自機狙い弾とV字が加わり、撃つ間隔1.8秒）', () => {
        const p = getDifficultyParams(10);
        expect(p.bulletTypes).toEqual(['straight', 'aimed']);
        expect(p.formationShapes).toEqual(['row', 'v']);
        expect(p.fireIntervalSec).toBe(1.8);
        expect(p.formationIntervalSec).toBe(4);
    });

    it('19.99秒: まだ3-way弾は出ない', () => {
        const p = getDifficultyParams(19.99);
        expect(p.bulletTypes).toEqual(['straight', 'aimed']);
        expect(p.fireIntervalSec).toBe(1.8);
    });

    it('20秒ちょうど: 3-way弾が加わり、撃つ間隔1.6秒', () => {
        const p = getDifficultyParams(20);
        expect(p.bulletTypes).toEqual(['straight', 'aimed', 'nway3']);
        expect(p.fireIntervalSec).toBe(1.6);
    });

    it('0〜30秒: 弾速は基準値、機数は3、出現間隔は4秒（29.99秒まで）', () => {
        for (const t of [0, 10, 20, 29.99]) {
            const p = getDifficultyParams(t);
            expect(p.bulletSpeed).toBe(BULLET_BASE_SPEED);
            expect(p.formationSize).toBe(3);
            expect(p.formationIntervalSec).toBe(4);
        }
    });

    it('30秒以降: 出現間隔は6秒で、形は横一列・V字（回帰）', () => {
        for (const t of [30, 60, 120, 300]) {
            const p = getDifficultyParams(t);
            expect(p.formationIntervalSec).toBe(6);
            expect(p.formationShapes).toEqual(['row', 'v']);
        }
    });

    it('30秒以降の弾速・弾種・機数・撃つ間隔は従来のまま（回帰）', () => {
        const p30 = getDifficultyParams(30);
        expect(p30.bulletSpeed).toBeCloseTo(BULLET_BASE_SPEED * 1.3);
        expect(p30.bulletTypes).toEqual(['straight', 'aimed', 'nway3', 'spread8']);
        expect(p30.formationSize).toBe(4);
        expect(p30.fireIntervalSec).toBe(1.4);

        const p60 = getDifficultyParams(60);
        expect(p60.bulletSpeed).toBeCloseTo(BULLET_BASE_SPEED * 1.6);
        expect(p60.bulletTypes).toEqual(['straight', 'aimed', 'nway3', 'nway5', 'spread8', 'fast']);
        expect(p60.formationSize).toBe(5);
        expect(p60.fireIntervalSec).toBe(1.1);

        const p120 = getDifficultyParams(120);
        expect(p120.bulletSpeed).toBeCloseTo(BULLET_BASE_SPEED * 2.0);
        expect(p120.bulletTypes).toEqual(p60.bulletTypes);
        expect(p120.formationSize).toBe(5);
        expect(p120.fireIntervalSec).toBe(0.8);
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
