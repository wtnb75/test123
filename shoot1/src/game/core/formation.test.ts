import { describe, it, expect } from 'vitest';
import { calcRowFormation, calcVFormation } from '../core/formation';

describe('calcRowFormation', () => {
    it('指定した機数の座標を返す', () => {
        const pos = calcRowFormation(3, 240, -20, 52);
        expect(pos).toHaveLength(3);
    });

    it('横一列に並ぶ（y座標が全て同じ）', () => {
        const pos = calcRowFormation(4, 240, -20, 52);
        const ys = pos.map(p => p.y);
        expect(ys.every(y => y === -20)).toBe(true);
    });

    it('中心が centerX になる', () => {
        const pos = calcRowFormation(3, 240, -20, 52);
        const xs = pos.map(p => p.x);
        const center = (Math.min(...xs) + Math.max(...xs)) / 2;
        expect(center).toBeCloseTo(240);
    });

    it('機数1の場合は中心座標1点を返す', () => {
        const pos = calcRowFormation(1, 240, -20, 52);
        expect(pos).toHaveLength(1);
        expect(pos[0]).toEqual({ x: 240, y: -20 });
    });
});

describe('calcVFormation', () => {
    it('指定した機数の座標を返す', () => {
        const pos = calcVFormation(5, 240, -20, 52);
        expect(pos).toHaveLength(5);
    });

    it('奇数機数の場合、先頭機が中心x に来る', () => {
        const pos = calcVFormation(3, 240, -20, 52);
        const top = pos[0];
        expect(top.x).toBeCloseTo(240);
        expect(top.y).toBeCloseTo(-20);
    });

    it('翼機が頂点より後ろ（y が大きい）に来る', () => {
        const pos = calcVFormation(3, 240, -20, 52);
        const topY = pos[0].y;
        const wingYs = pos.slice(1).map(p => p.y);
        expect(wingYs.every(y => y > topY)).toBe(true);
    });

    it('左右対称に配置される', () => {
        const centerX = 240;
        const pos = calcVFormation(5, centerX, -20, 52);
        // x座標が centerX を中心に対称かチェック
        const xs = pos.map(p => p.x);
        const left  = xs.filter(x => x < centerX).sort();
        const right = xs.filter(x => x > centerX).sort((a, b) => b - a);
        for (let i = 0; i < left.length; i++) {
            expect(Math.abs(left[i] - centerX)).toBeCloseTo(Math.abs(right[i] - centerX));
        }
    });
});
