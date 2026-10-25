import { describe, it, expect } from 'vitest';
import {
    advanceStopper, isRushGone, isStopperGone, rushTouchesPlayer, rushVelocity,
    soloKindOf, soloSpawnDue, soloSpawnX, type StopState
} from './soloEnemy';
import { GAME_HEIGHT, GAME_WIDTH, RUSH_SPEED, SOLO_STOP_SEC, SOLO_STOP_Y } from './constants';

describe('soloKindOf', () => {
    it('最初は突進する敵、以後は突進と停止を交互に出す', () => {
        expect([0, 1, 2, 3].map(soloKindOf)).toEqual(['rush', 'stop', 'rush', 'stop']);
    });
});

describe('soloSpawnDue', () => {
    it('30 秒より前は、最初の単体の敵は出ない（29.99 秒）', () => {
        expect(soloSpawnDue(29.99, 0)).toBe(false);
    });

    it('30 秒ちょうどで最初の単体の敵が出る', () => {
        expect(soloSpawnDue(30, 0)).toBe(true);
    });

    it('2 体目は 42 秒ちょうどで出る（41.99 秒では出ない）', () => {
        expect(soloSpawnDue(41.99, 1)).toBe(false);
        expect(soloSpawnDue(42, 1)).toBe(true);
    });

    it('一度出した分より前の時刻では、次の 1 体は出ない', () => {
        expect(soloSpawnDue(30, 1)).toBe(false);
    });
});

describe('soloSpawnX', () => {
    it('乱数 0 は左端（半径の分だけ内側）、乱数の上限は右端の手前', () => {
        expect(soloSpawnX(0)).toBe(14);
        expect(soloSpawnX(0.5)).toBe(240);
        expect(soloSpawnX(0.999999)).toBeLessThan(GAME_WIDTH - 14);
    });
});

describe('rushVelocity', () => {
    it('真下にいる自機へは真下へ RUSH_SPEED で進む', () => {
        const v = rushVelocity(240, -14, 240, 706);
        expect(v.vx).toBeCloseTo(0);
        expect(v.vy).toBeCloseTo(RUSH_SPEED);
    });

    it('斜め下の自機へは、速さ RUSH_SPEED のまま自機の方向へ向かう', () => {
        const v = rushVelocity(240, -14, 100, 300);
        expect(Math.hypot(v.vx, v.vy)).toBeCloseTo(RUSH_SPEED);
        expect(v.vx / v.vy).toBeCloseTo(-140 / 314);
    });

    it('出現位置と自機が同じ位置でも、速度は有限（真下へ進む）', () => {
        const v = rushVelocity(10, 10, 10, 10);
        expect(v).toEqual({ vx: 0, vy: RUSH_SPEED });
    });
});

describe('advanceStopper', () => {
    it('降下中は ENEMY_SPEED（80 px/s）で下へ進む', () => {
        const s: StopState = { y: 0, phase: 'descend', holdLeft: 0 };
        advanceStopper(s, 0.5);
        expect(s).toEqual({ y: 40, phase: 'descend', holdLeft: 0 });
    });

    it('止まる線（SOLO_STOP_Y）ちょうどに届いた瞬間に停止に入り、停止時間を積む', () => {
        const s: StopState = { y: SOLO_STOP_Y - 10, phase: 'descend', holdLeft: 0 };
        advanceStopper(s, 0.125);
        expect(s).toEqual({ y: SOLO_STOP_Y, phase: 'hold', holdLeft: SOLO_STOP_SEC });
    });

    it('越えた分は線に戻し、停止に入る', () => {
        const s: StopState = { y: SOLO_STOP_Y - 10, phase: 'descend', holdLeft: 0 };
        advanceStopper(s, 0.25);
        expect(s.y).toBe(SOLO_STOP_Y);
        expect(s.phase).toBe('hold');
    });

    it('停止に入った瞬間だけ true を返す（降下中・停止中・上昇中は false）', () => {
        const s: StopState = { y: SOLO_STOP_Y - 10, phase: 'descend', holdLeft: 0 };
        expect(advanceStopper(s, 0.125)).toBe(true);
        expect(advanceStopper(s, 1)).toBe(false);
        expect(advanceStopper(s, 3)).toBe(false);
        expect(advanceStopper({ y: 100, phase: 'descend', holdLeft: 0 }, 0.1)).toBe(false);
    });

    it('停止中は y が変わらず、停止時間が 3 秒で切れたら上昇に移る', () => {
        const s: StopState = { y: SOLO_STOP_Y, phase: 'hold', holdLeft: SOLO_STOP_SEC };
        advanceStopper(s, 1);
        advanceStopper(s, 1);
        expect(s).toEqual({ y: SOLO_STOP_Y, phase: 'hold', holdLeft: 1 });
        advanceStopper(s, 1);
        expect(s).toEqual({ y: SOLO_STOP_Y, phase: 'ascend', holdLeft: 0 });
    });

    it('上昇中は ENEMY_SPEED で上へ進む', () => {
        const s: StopState = { y: SOLO_STOP_Y, phase: 'ascend', holdLeft: 0 };
        advanceStopper(s, 0.5);
        expect(s.y).toBe(SOLO_STOP_Y - 40);
    });
});

describe('isRushGone', () => {
    it('左・右・下へ 40 px 出たら消え、ちょうど 40 px では残る', () => {
        expect(isRushGone(-41, 300)).toBe(true);
        expect(isRushGone(-40, 300)).toBe(false);
        expect(isRushGone(GAME_WIDTH + 41, 300)).toBe(true);
        expect(isRushGone(GAME_WIDTH + 40, 300)).toBe(false);
        expect(isRushGone(240, GAME_HEIGHT + 41)).toBe(true);
        expect(isRushGone(240, GAME_HEIGHT + 40)).toBe(false);
    });

    it('画面の中にいる間は消えない', () => {
        expect(isRushGone(240, 300)).toBe(false);
    });
});

describe('isStopperGone', () => {
    it('上昇中に上へ 40 px 出たら消え、ちょうど 40 px では残る', () => {
        expect(isStopperGone({ y: -41, phase: 'ascend', holdLeft: 0 })).toBe(true);
        expect(isStopperGone({ y: -40, phase: 'ascend', holdLeft: 0 })).toBe(false);
    });

    it('降下中・停止中は、画面の上にあっても消えない', () => {
        expect(isStopperGone({ y: -50, phase: 'descend', holdLeft: 0 })).toBe(false);
        expect(isStopperGone({ y: -50, phase: 'hold', holdLeft: 1 })).toBe(false);
    });
});

describe('rushTouchesPlayer', () => {
    it('中心間の距離が 26 px より小さいと、自機に触れている（ゲームオーバー）', () => {
        expect(rushTouchesPlayer(0, 0, 25.99, 0)).toBe(true);
    });

    it('中心間の距離がちょうど 26 px では触れていない（猶予なし・境界は外）', () => {
        expect(rushTouchesPlayer(0, 0, 26, 0)).toBe(false);
    });
});
