import { describe, it, expect } from 'vitest';
import {
    circlesOverlap,
    getTargetsInExplosion,
    clampPosition,
    inputToVelocity,
    joystickToVelocity,
    calcNWayAngles,
    calcScore,
    angleTo,
    calcChainExplosionRadius
} from '../core/physics';

describe('circlesOverlap', () => {
    it('重なっている場合 true を返す', () => {
        expect(circlesOverlap(0, 0, 10, 5, 0, 10)).toBe(true);
    });
    it('接触している場合 false を返す（境界は含まない）', () => {
        expect(circlesOverlap(0, 0, 10, 20, 0, 10)).toBe(false);
    });
    it('離れている場合 false を返す', () => {
        expect(circlesOverlap(0, 0, 5, 100, 0, 5)).toBe(false);
    });
    it('同じ座標の場合 true を返す', () => {
        expect(circlesOverlap(0, 0, 1, 0, 0, 1)).toBe(true);
    });
});

describe('getTargetsInExplosion', () => {
    it('爆発半径内の対象インデックスを返す', () => {
        const targets = [
            { x: 0, y: 0 },   // 0: 爆発点と同じ → 範囲内
            { x: 50, y: 0 },  // 1: 半径50以内 → 範囲内
            { x: 200, y: 0 }, // 2: 範囲外
        ];
        const result = getTargetsInExplosion(0, 0, 100, targets);
        expect(result).toContain(0);
        expect(result).toContain(1);
        expect(result).not.toContain(2);
    });
    it('対象が空の場合は空配列を返す', () => {
        expect(getTargetsInExplosion(0, 0, 100, [])).toEqual([]);
    });
    it('境界上の対象を含む', () => {
        const targets = [{ x: 100, y: 0 }];
        expect(getTargetsInExplosion(0, 0, 100, targets)).toContain(0);
    });
});

describe('clampPosition', () => {
    it('範囲内の場合そのまま返す', () => {
        const r = clampPosition(100, 100, 10, 480, 720);
        expect(r).toEqual({ x: 100, y: 100 });
    });
    it('左端を超えた場合クランプする', () => {
        const r = clampPosition(-5, 100, 10, 480, 720);
        expect(r.x).toBe(10);
    });
    it('右端を超えた場合クランプする', () => {
        const r = clampPosition(500, 100, 10, 480, 720);
        expect(r.x).toBe(470);
    });
    it('上端を超えた場合クランプする', () => {
        const r = clampPosition(100, -5, 10, 480, 720);
        expect(r.y).toBe(10);
    });
    it('下端を超えた場合クランプする', () => {
        const r = clampPosition(100, 750, 10, 480, 720);
        expect(r.y).toBe(710);
    });
});

describe('inputToVelocity', () => {
    it('入力なしで (0,0) を返す', () => {
        const v = inputToVelocity(false, false, false, false, 280);
        expect(v).toEqual({ x: 0, y: 0 });
    });
    it('右キーで正のvx を返す', () => {
        const v = inputToVelocity(false, true, false, false, 280);
        expect(v.x).toBe(280);
        expect(v.y).toBe(0);
    });
    it('斜め移動は正規化される（速度の大きさが speed になる）', () => {
        const v = inputToVelocity(false, true, true, false, 280);
        const mag = Math.sqrt(v.x * v.x + v.y * v.y);
        expect(mag).toBeCloseTo(280);
    });
    it('左右同時押しで (0,0) を返す', () => {
        const v = inputToVelocity(true, true, false, false, 280);
        expect(v).toEqual({ x: 0, y: 0 });
    });
});

describe('joystickToVelocity', () => {
    it('デッドゾーン内で (0,0) を返す', () => {
        const v = joystickToVelocity(3, 3, 8, 56, 280);
        expect(v).toEqual({ x: 0, y: 0 });
    });
    it('最大入力で speed と同じ大きさを返す', () => {
        const v = joystickToVelocity(56, 0, 8, 56, 280);
        expect(v.x).toBeCloseTo(280);
        expect(v.y).toBeCloseTo(0);
    });
    it('斜め入力で正規化された速度を返す', () => {
        const v = joystickToVelocity(56, 56, 8, 56, 280);
        const mag = Math.sqrt(v.x * v.x + v.y * v.y);
        expect(mag).toBeCloseTo(280);
    });
    it('ベース半径を超えた入力はクランプされる', () => {
        const v = joystickToVelocity(1000, 0, 8, 56, 280);
        expect(v.x).toBeCloseTo(280);
    });
});

describe('calcNWayAngles', () => {
    it('n=1 で baseAngle のみ返す', () => {
        const angles = calcNWayAngles(0, 1, Math.PI / 4);
        expect(angles).toHaveLength(1);
        expect(angles[0]).toBe(0);
    });
    it('n=3 で中央・左・右の3角度を返す', () => {
        const angles = calcNWayAngles(0, 3, Math.PI / 2);
        expect(angles).toHaveLength(3);
        expect(angles[1]).toBeCloseTo(0); // 中央
    });
    it('n=5 で5つの角度を返す', () => {
        const angles = calcNWayAngles(0, 5, Math.PI / 3);
        expect(angles).toHaveLength(5);
    });
    it('角度が等間隔に並ぶ', () => {
        const spread = Math.PI / 2;
        const angles = calcNWayAngles(0, 3, spread);
        const step = angles[1] - angles[0];
        expect(angles[2] - angles[1]).toBeCloseTo(step);
    });
});

describe('calcScore', () => {
    it('0ms で 0 を返す', () => {
        expect(calcScore(0, 10)).toBe(0);
    });
    it('1000ms で multiplier を返す', () => {
        expect(calcScore(1000, 10)).toBe(10);
    });
    it('30秒で300を返す', () => {
        expect(calcScore(30000, 10)).toBe(300);
    });
    it('切り捨て計算をする', () => {
        expect(calcScore(1500, 10)).toBe(15);
    });
});

describe('angleTo', () => {
    it('右方向は 0 ラジアン', () => {
        expect(angleTo(0, 0, 1, 0)).toBeCloseTo(0);
    });
    it('下方向は π/2 ラジアン', () => {
        expect(angleTo(0, 0, 0, 1)).toBeCloseTo(Math.PI / 2);
    });
    it('左方向は ±π ラジアン', () => {
        expect(Math.abs(angleTo(0, 0, -1, 0))).toBeCloseTo(Math.PI);
    });
});

describe('calcChainExplosionRadius', () => {
    it('chainCount=0 のとき baseRadius をそのまま返す', () => {
        expect(calcChainExplosionRadius(120, 1.5, 0)).toBeCloseTo(120);
    });
    it('chainCount=1 のとき baseRadius * multiplier を返す', () => {
        expect(calcChainExplosionRadius(120, 1.5, 1)).toBeCloseTo(180);
    });
    it('chainCount=2 のとき baseRadius * multiplier^2 を返す', () => {
        expect(calcChainExplosionRadius(120, 1.5, 2)).toBeCloseTo(270);
    });
    it('chainCount=3 のとき baseRadius * multiplier^3 を返す', () => {
        expect(calcChainExplosionRadius(120, 1.5, 3)).toBeCloseTo(405);
    });
    it('multiplier=1 のとき chainCount によらず baseRadius を返す', () => {
        expect(calcChainExplosionRadius(100, 1, 5)).toBeCloseTo(100);
    });
});
