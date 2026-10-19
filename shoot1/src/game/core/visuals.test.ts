import { describe, it, expect } from 'vitest';
import { BULLET_TYPES, bulletVisual, bulletRotation, countdownRingRadius, isInBlastWarning, rippleState } from './visuals';
import type { BulletType } from './difficulty';

const ALL_TYPES: BulletType[] = ['straight', 'aimed', 'nway3', 'nway5', 'spread8', 'fast'];

describe('bulletVisual', () => {
    it.each([
        ['straight', 'circle', 0xff8800],
        ['aimed', 'diamond', 0xff44ff],
        ['nway3', 'triangle', 0xaaff00],
        ['nway5', 'triangle', 0xaaff00],
        ['spread8', 'circle', 0xc9b8ff],
        ['fast', 'tailed', 0xffffff]
    ] as const)('%s は形 %s で描く', (type, shape, color) => {
        expect(bulletVisual(type)).toEqual({ shape, color });
    });

    it('テクスチャを作る対象の弾種一覧が、すべての弾種を含む', () => {
        expect([...BULLET_TYPES].sort()).toEqual([...ALL_TYPES].sort());
    });

    it('nway3 と nway5 は同じ見た目になる', () => {
        expect(bulletVisual('nway3')).toEqual(bulletVisual('nway5'));
    });

    it('nway3 と nway5 を 1 つとみなすと、弾種ごとの形か色が互いに違う', () => {
        const kinds: BulletType[] = ['straight', 'aimed', 'nway3', 'spread8', 'fast'];
        const keys = kinds.map(t => `${bulletVisual(t).shape}:${bulletVisual(t).color}`);
        expect(new Set(keys).size).toBe(kinds.length);
    });

    it('straight と spread8 は同じ円で、色だけが違う', () => {
        expect(bulletVisual('straight').shape).toBe(bulletVisual('spread8').shape);
        expect(bulletVisual('straight').color).not.toBe(bulletVisual('spread8').color);
    });

    it('どの弾の色も自機の水色・地雷の黄色・敵機の赤と違う', () => {
        const reserved = [0x00e5ff, 0xffdd00, 0xff4444];
        for (const t of ALL_TYPES) {
            expect(reserved).not.toContain(bulletVisual(t).color);
        }
    });
});

describe('bulletRotation', () => {
    it('右向きの速度は 0', () => {
        expect(bulletRotation(180, 0)).toBe(0);
    });

    it('下向きの速度は π/2', () => {
        expect(bulletRotation(0, 360)).toBeCloseTo(Math.PI / 2, 10);
    });

    it('左向きの速度は π', () => {
        expect(bulletRotation(-100, 0)).toBeCloseTo(Math.PI, 10);
    });

    it('上向きの速度は -π/2', () => {
        expect(bulletRotation(0, -100)).toBeCloseTo(-Math.PI / 2, 10);
    });

    it('速さを変えても向きの角度は変わらない', () => {
        expect(bulletRotation(30, 40)).toBeCloseTo(bulletRotation(300, 400), 10);
    });
});

describe('countdownRingRadius', () => {
    it('経過 6.99 秒（残り 3 秒より前）は輪を出さない', () => {
        expect(countdownRingRadius(6.99)).toBeNull();
    });

    it('経過 0 秒（設置直後）は輪を出さない', () => {
        expect(countdownRingRadius(0)).toBeNull();
    });

    it('経過 7 秒ちょうどで半径 120 の輪が出る', () => {
        expect(countdownRingRadius(7)).toBeCloseTo(120, 10);
    });

    it('経過 8.5 秒（残り 1.5 秒）で半径 66', () => {
        expect(countdownRingRadius(8.5)).toBeCloseTo(66, 10);
    });

    it('経過 9.99 秒で半径 12.36', () => {
        expect(countdownRingRadius(9.99)).toBeCloseTo(12.36, 6);
    });

    it('経過 10 秒（爆発の瞬間）で半径 12（地雷の大きさ）', () => {
        expect(countdownRingRadius(10)).toBeCloseTo(12, 10);
    });

    it('10 秒を超えても半径は 12 を下回らない', () => {
        expect(countdownRingRadius(10.5)).toBeCloseTo(12, 10);
    });

    it('時間が進むほど半径は小さくなる', () => {
        expect(countdownRingRadius(8)!).toBeGreaterThan(countdownRingRadius(9)!);
    });
});

describe('isInBlastWarning', () => {
    it('距離 100 は警告輪が出る', () => {
        expect(isInBlastWarning(100, 100, 200, 100)).toBe(true);
    });

    it('距離 131.99 は警告輪が出る', () => {
        expect(isInBlastWarning(100, 100, 231.99, 100)).toBe(true);
    });

    it('距離 132 ちょうど（爆風半径 120 + 自機半径 12）は警告輪が出ない', () => {
        expect(isInBlastWarning(100, 100, 232, 100)).toBe(false);
    });

    it('距離 140 は警告輪が出ない', () => {
        expect(isInBlastWarning(100, 100, 240, 100)).toBe(false);
    });

    it('縦方向でも同じ距離で判定する', () => {
        expect(isInBlastWarning(100, 100, 100, 231.99)).toBe(true);
        expect(isInBlastWarning(100, 100, 100, 232)).toBe(false);
    });

    it('地雷と同じ位置にいれば警告輪が出る', () => {
        expect(isInBlastWarning(50, 60, 50, 60)).toBe(true);
    });
});

describe('rippleState', () => {
    it('設置の瞬間は半径 12・透明度 0.8', () => {
        const s = rippleState(0);
        expect(s!.radius).toBeCloseTo(12, 10);
        expect(s!.alpha).toBeCloseTo(0.8, 10);
    });

    it('0.15 秒（中間）は半径 21・透明度 0.4', () => {
        const s = rippleState(0.15);
        expect(s!.radius).toBeCloseTo(21, 10);
        expect(s!.alpha).toBeCloseTo(0.4, 10);
    });

    it('0.3 秒ちょうどで終わる（null）', () => {
        expect(rippleState(0.3)).toBeNull();
    });

    it('0.3 秒の直前はまだ出ていて、半径は 30 に近く透明度は 0 に近い', () => {
        const s = rippleState(0.299);
        expect(s!.radius).toBeGreaterThan(29.9);
        expect(s!.alpha).toBeLessThan(0.01);
    });

    it('負の経過時間は 0 秒として扱う', () => {
        expect(rippleState(-1)!.radius).toBeCloseTo(12, 10);
    });
});
