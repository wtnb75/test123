import { describe, expect, it } from 'vitest';
import { boxCapacityFor, createEmptyBoxes, resolvePlacement } from './primtris';
import { chooseDemoMove, createTitleDemoGame } from './titleDemo';

// A draw sequence for the demo's rng; the last value repeats when the sequence runs out.
const scripted = (values: number[]): (() => number) => {
    let i = 0;
    return () => {
        const v = values[Math.min(i, values.length - 1)];
        i += 1;
        return v;
    };
};

describe('boxCapacityFor（桁数ごとの容量）', () => {
    it('2 桁は 9、3 桁は 8、4 桁は 7', () => {
        expect(boxCapacityFor(2)).toBe(9);
        expect(boxCapacityFor(3)).toBe(8);
        expect(boxCapacityFor(4)).toBe(7);
    });

    it('2 桁より小さい桁数は 2 桁と同じ 9 になる（1 桁の数字はゲームに出ない）', () => {
        expect(boxCapacityFor(1)).toBe(9);
    });
});

describe('容量超過（桁数 4 は容量 7）', () => {
    const fourDigitsInX2 = (residual: number): number[] => Array.from({ length: residual }, () => 1);

    it('x2 に 3 桁残っていて 4 桁を入れると、3 + 4 = 7 は超えないのでゲームオーバーにならない', () => {
        const boxes = createEmptyBoxes();
        boxes.x2 = fourDigitsInX2(3);
        expect(resolvePlacement(3003, 'x2', boxes, boxCapacityFor(4)).gameOver).toBe(false);
    });

    it('x2 に 4 桁残っていて 4 桁を入れると、4 + 4 = 8 > 7 で容量超過（ゲームオーバー）', () => {
        const boxes = createEmptyBoxes();
        boxes.x2 = fourDigitsInX2(4);
        expect(resolvePlacement(3003, 'x2', boxes, boxCapacityFor(4)).gameOver).toBe(true);
    });

    it('デモで、x2 に 4 桁残っているとき、4 桁の 3003 は x2 を避けて正しい箱 x3 になる（spec のガードの例）', () => {
        const boxes = createEmptyBoxes();
        boxes.x2 = fourDigitsInX2(4);
        // r1 = 0 misses; r2 = 0 picks the first wrong box x2, which would overflow, so the same r2 picks x3
        expect(chooseDemoMove(3003, 4, boxes, boxCapacityFor(4), scripted([0, 0, 0.9])).box).toBe('x3');
    });

    it('デモで、x2 が空のときは 4 桁の 3003 を x2 へ誤投入する（4 桁は 7 以内に収まる）', () => {
        expect(chooseDemoMove(3003, 4, createEmptyBoxes(), boxCapacityFor(4), scripted([0, 0, 0.9])).box).toBe('x2');
    });
});

describe('タイトルのデモの容量は、選んだ桁数の容量になる', () => {
    it.each([[2, 9], [3, 8], [4, 7]])('桁数 %i のデモは容量 %i で始まる', (digitCount, capacity) => {
        const state = createTitleDemoGame(digitCount, scripted([0.5])).start();
        expect(state.capacity).toBe(capacity);
    });
});
