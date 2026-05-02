import { describe, it, expect } from 'vitest';
import { createMineState, canPlaceMine, placeMine, replenishMine } from '../core/mine';
import { MINE_INITIAL_COUNT } from '../core/constants';

describe('mine state', () => {
    it('初期残弾数が MINE_INITIAL_COUNT になる', () => {
        const s = createMineState(MINE_INITIAL_COUNT);
        expect(s.count).toBe(MINE_INITIAL_COUNT);
        expect(s.maxCount).toBe(MINE_INITIAL_COUNT);
    });

    it('残弾数 > 0 のとき canPlaceMine は true', () => {
        const s = createMineState(3);
        expect(canPlaceMine(s)).toBe(true);
    });

    it('残弾数 0 のとき canPlaceMine は false', () => {
        const s = createMineState(0);
        expect(canPlaceMine(s)).toBe(false);
    });

    it('placeMine で残弾数が 1 減る', () => {
        const s = createMineState(3);
        const s2 = placeMine(s);
        expect(s2.count).toBe(2);
    });

    it('残弾数 0 のとき placeMine は状態を変えない', () => {
        const s = createMineState(0);
        const s2 = placeMine(s);
        expect(s2.count).toBe(0);
    });

    it('placeMine を繰り返すと 0 になる', () => {
        let s = createMineState(3);
        s = placeMine(s);
        s = placeMine(s);
        s = placeMine(s);
        expect(s.count).toBe(0);
        expect(canPlaceMine(s)).toBe(false);
    });

    it('replenishMine で残弾数が 1 増える', () => {
        let s = createMineState(3);
        s = placeMine(s); // count=2
        s = replenishMine(s);
        expect(s.count).toBe(3);
    });

    it('replenishMine は maxCount を超えない', () => {
        const s = createMineState(3);
        const s2 = replenishMine(s); // すでに満タン
        expect(s2.count).toBe(3);
    });

    it('placeMine して replenishMine すると元の数に戻る', () => {
        let s = createMineState(3);
        s = placeMine(s);
        s = placeMine(s);
        s = replenishMine(s);
        s = replenishMine(s);
        expect(s.count).toBe(3);
    });
});
