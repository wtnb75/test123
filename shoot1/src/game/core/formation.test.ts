import { describe, it, expect } from 'vitest';
import { advanceFormationTimer, calcRowFormation, calcVFormation, pickFormationType } from '../core/formation';
import { getDifficultyParams } from '../core/difficulty';
import { FORMATION_INTERVAL_EARLY_SEC } from '../core/constants';

describe('advanceFormationTimer', () => {
    it('間隔に達していなければ出現せず、タイマーが進む', () => {
        expect(advanceFormationTimer(1, 0.5, 4)).toEqual({ timer: 1.5, spawn: false });
    });

    it('間隔ちょうどで出現し、タイマーは0に戻る', () => {
        expect(advanceFormationTimer(3.5, 0.5, 4)).toEqual({ timer: 0, spawn: true });
    });

    it('超過分は捨てて0に戻す', () => {
        expect(advanceFormationTimer(3.9, 1, 4)).toEqual({ timer: 0, spawn: true });
    });

    it('開始時のタイマー（無限大）では最初の更新で出現し、0に戻る', () => {
        const r = advanceFormationTimer(Infinity, 1 / 60, getDifficultyParams(0).formationIntervalSec);
        expect(r).toEqual({ timer: 0, spawn: true });
    });

    // 0.25 秒刻み（2 進数で正確）で時間割を回し、出現時刻を集める（期待値は spec の例: 0, 4, ..., 28, 34）
    function spawnTimes(untilSec: number): number[] {
        const dt = 0.25;
        const times: number[] = [];
        let timer = FORMATION_INTERVAL_EARLY_SEC;
        for (let t = 0; t <= untilSec; t += dt) {
            const r = advanceFormationTimer(timer, t === 0 ? 0 : dt, getDifficultyParams(t).formationIntervalSec);
            timer = r.timer;
            if (r.spawn) times.push(t);
        }
        return times;
    }

    it('0〜28秒は4秒おき、28秒の次は6秒後の34秒（32秒ではない）', () => {
        expect(spawnTimes(40)).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 34, 40]);
    });
});

describe('pickFormationType', () => {
    it('候補が横一列のみなら、乱数によらず横一列', () => {
        expect(pickFormationType(['row'], 0)).toBe('row');
        expect(pickFormationType(['row'], 0.999)).toBe('row');
    });

    it('横一列・V字が候補なら、乱数0.5未満は横一列、0.5以上はV字', () => {
        expect(pickFormationType(['row', 'v'], 0.49)).toBe('row');
        expect(pickFormationType(['row', 'v'], 0.5)).toBe('v');
    });

    it('乱数が1に等しくても範囲外にならず最後の候補を返す', () => {
        expect(pickFormationType(['row', 'v'], 1)).toBe('v');
    });

    it('0〜10秒の時間割では、どの乱数でも横一列', () => {
        const shapes = getDifficultyParams(5).formationShapes;
        expect(pickFormationType(shapes, 0.9)).toBe('row');
    });
});

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
