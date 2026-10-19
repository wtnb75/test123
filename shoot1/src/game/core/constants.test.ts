import { describe, it, expect } from 'vitest';
import * as C from './constants';

// Pins the values a presentation-only change must leave alone (spec: 完了条件「変えないもの」)
describe('変えない定数', () => {
    it('当たり半径は 自機 12・敵弾 5・敵機 14・地雷 12・爆風 120', () => {
        expect(C.PLAYER_RADIUS).toBe(12);
        expect(C.BULLET_RADIUS).toBe(5);
        expect(C.ENEMY_RADIUS).toBe(14);
        expect(C.MINE_RADIUS).toBe(12);
        expect(C.MINE_EXPLODE_RADIUS).toBe(120);
    });

    it('地雷の規則の数値は 3 発・連鎖 1.5 倍・自爆 10 秒・点滅 3 秒・猶予 0.5 秒', () => {
        expect(C.MINE_INITIAL_COUNT).toBe(3);
        expect(C.MINE_CHAIN_RADIUS_MULTIPLIER).toBe(1.5);
        expect(C.MINE_TIMEOUT_SEC).toBe(10);
        expect(C.MINE_BLINK_SEC).toBe(3);
        expect(C.MINE_PLACE_GRACE_SEC).toBe(0.5);
    });

    it('自機速度 280・敵機の降下速度 80・スコア係数 10', () => {
        expect(C.PLAYER_SPEED).toBe(280);
        expect(C.ENEMY_SPEED).toBe(80);
        expect(C.SCORE_MULTIPLIER).toBe(10);
    });
});
