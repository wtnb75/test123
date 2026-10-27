import { describe, it, expect } from 'vitest';
import {
    addMine, advanceBarrier, advanceItemY, createBarrierState, graceAlpha, isItemGone, itemSpawnX,
    isGraceActive, itemTouchesPlayer, mineDots, pickUpBarrier, resolveFailure, rollItemDrop, type BarrierState
} from './powerup';
import { createMineState, placeMine, replenishMine } from './mine';
import {
    BARRIER_BREAK_SEC, GAME_HEIGHT, ITEM_BARRIER_RATE, ITEM_DROP_RATE, ITEM_FALL_SPEED, ITEM_OFFSCREEN_MARGIN, ITEM_RADIUS,
    MINE_INITIAL_COUNT, MINE_ITEM_MAX, PLAYER_RADIUS
} from './constants';

// docs/spec/power-ups.md "テスト観点". Numbers in the names are hand-worked from the spec.

/** A rand() that returns the given values in order, counts its calls and fails when asked for more. */
function seq(values: number[]): { rand: () => number; calls: () => number } {
    let i = 0;
    return {
        rand: () => {
            if (i >= values.length) throw new Error(`rand() called more than ${values.length} times`);
            return values[i++];
        },
        calls: () => i
    };
}

describe('アイテムの値（仕様のパラメータ表）', () => {
    it('初期値が仕様どおり', () => {
        expect(ITEM_DROP_RATE).toBe(0.3);
        expect(ITEM_BARRIER_RATE).toBe(0.4);
        expect(ITEM_FALL_SPEED).toBe(60);
        expect(ITEM_RADIUS).toBe(10);
        expect(ITEM_OFFSCREEN_MARGIN).toBe(20);
        expect(MINE_ITEM_MAX).toBe(5);
        expect(BARRIER_BREAK_SEC).toBe(1.0);
    });
});

describe('落とす判定 rollItemDrop', () => {
    it('乱数 0.2999（ITEM_DROP_RATE 未満）は落とす。乱数は 2 回引く（落とす判定と種類）', () => {
        const r = seq([0.2999, 0.5]);
        expect(rollItemDrop(r.rand)).toBe('mine');
        expect(r.calls()).toBe(2);
    });

    it('乱数 0.3 ちょうど・0.9 は落とさず、種類の乱数は引かない（引いた回数 1）', () => {
        for (const v of [0.3, 0.9]) {
            const r = seq([v]);
            expect(rollItemDrop(r.rand)).toBeNull();
            expect(r.calls()).toBe(1);
        }
    });

    it('種類: 乱数 0.3999 はバリア、0.4 ちょうど・0.9 は地雷 +1', () => {
        expect(rollItemDrop(seq([0, 0.3999]).rand)).toBe('barrier');
        expect(rollItemDrop(seq([0, 0.4]).rand)).toBe('mine');
        expect(rollItemDrop(seq([0, 0.9]).rand)).toBe('mine');
    });

    it('敵機が 3 機消えたとき、敵機ごとに「落とす判定 →（落とすなら）種類」の順に引く: [0.1, 0.5, 0.9, 0.2, 0.1]', () => {
        const r = seq([0.1, 0.5, 0.9, 0.2, 0.1]);
        // enemy 1: 0.1 drops, kind 0.5 -> mine; enemy 2: 0.9 no drop; enemy 3: 0.2 drops, kind 0.1 -> barrier
        const drops = [rollItemDrop(r.rand), rollItemDrop(r.rand), rollItemDrop(r.rand)];
        expect(drops).toEqual(['mine', null, 'barrier']);
        expect(r.calls()).toBe(5);
    });
});

describe('出現位置と落下', () => {
    it('x を画面の内側（ITEM_RADIUS）に収める: 240 → 240、3 → 10、10 → 10、475 → 470', () => {
        expect(itemSpawnX(240)).toBe(240);
        expect(itemSpawnX(3)).toBe(10);
        expect(itemSpawnX(10)).toBe(10);
        expect(itemSpawnX(475)).toBe(470);
    });

    it('1 秒で 60 px、0.5 秒で 30 px 落ちる（y が画面の上端の外でもそのまま）', () => {
        expect(advanceItemY(100, 1)).toBe(160);
        expect(advanceItemY(100, 0.5)).toBe(130);
        expect(advanceItemY(-14, 1)).toBe(46);
    });

    it('y が GAME_HEIGHT + 20（740）ちょうどでは消えず、740.01 で消える', () => {
        expect(GAME_HEIGHT + ITEM_OFFSCREEN_MARGIN).toBe(740);
        expect(isItemGone(740)).toBe(false);
        expect(isItemGone(740.01)).toBe(true);
        expect(isItemGone(-14)).toBe(false);
    });
});

describe('取る判定 itemTouchesPlayer', () => {
    it('距離 21.99 は取る、22 ちょうどは取らない、30 は取らない', () => {
        expect(ITEM_RADIUS + PLAYER_RADIUS).toBe(22);
        expect(itemTouchesPlayer(100, 100, 100 + 21.99, 100)).toBe(true);
        expect(itemTouchesPlayer(100, 100, 100 + 22, 100)).toBe(false);
        expect(itemTouchesPlayer(100, 100, 100, 100 + 30)).toBe(false);
    });
});

describe('地雷 +1 の残弾', () => {
    it('addMine: 0 → 1、2 → 3、3 → 4、4 → 5、5 → 5（増えない）', () => {
        const mine = (count: number) => ({ ...createMineState(MINE_INITIAL_COUNT), count });
        expect(addMine(mine(0)).count).toBe(1);
        expect(addMine(mine(2)).count).toBe(3);
        expect(addMine(mine(3)).count).toBe(4);
        expect(addMine(mine(4)).count).toBe(5);
        expect(addMine(mine(5)).count).toBe(5);
    });

    it('爆発で戻るのは 3 まで: 2 → 3、3 → 3、4 → 4、5 → 5。残弾 4 で設置すると 3', () => {
        const mine = (count: number) => ({ ...createMineState(MINE_INITIAL_COUNT), count });
        expect(replenishMine(mine(2)).count).toBe(3);
        expect(replenishMine(mine(3)).count).toBe(3);
        expect(replenishMine(mine(4)).count).toBe(4);
        expect(replenishMine(mine(5)).count).toBe(5);
        expect(placeMine(mine(4)).count).toBe(3);
    });

    it('addMine は maxCount（3）を変えない', () => {
        expect(addMine(createMineState(MINE_INITIAL_COUNT)).maxCount).toBe(3);
    });
});

describe('HUD の MINE の点 mineDots', () => {
    it('残弾 0 → ○○○、1 → ●○○、3 → ●●●、4 → ●●●●、5 → ●●●●●', () => {
        expect(mineDots(0)).toBe('○○○');
        expect(mineDots(1)).toBe('●○○');
        expect(mineDots(3)).toBe('●●●');
        expect(mineDots(4)).toBe('●●●●');
        expect(mineDots(5)).toBe('●●●●●');
    });
});

describe('バリアの状態遷移', () => {
    const owned: BarrierState = { owned: true, graceElapsed: null };

    it('なしで取る → あり。ありで取る → ありのまま（変わらない）', () => {
        expect(pickUpBarrier(createBarrierState())).toEqual({ owned: true, graceElapsed: null });
        const same = pickUpBarrier(owned);
        expect(same).toBe(owned);
    });

    it('なしで原因が起きる → ゲームオーバー（状態は変わらない）', () => {
        const r = resolveFailure(createBarrierState());
        expect(r.outcome).toBe('gameover');
        expect(r.state).toEqual({ owned: false, graceElapsed: null });
    });

    it('ありで原因が起きる → 防ぐ（バリアが壊れ、猶予が 0 から始まる）。ゲームオーバーでない', () => {
        const r = resolveFailure(owned);
        expect(r.outcome).toBe('absorbed');
        expect(r.state).toEqual({ owned: false, graceElapsed: 0 });
    });

    it('同じフレームに原因が複数（被弾と爆風）でも、1 回で壊れ、2 つ目は無視される', () => {
        const first = resolveFailure(owned);
        const second = resolveFailure(first.state);
        const third = resolveFailure(second.state);
        expect([first.outcome, second.outcome, third.outcome]).toEqual(['absorbed', 'ignored', 'ignored']);
        expect(third.state).toEqual({ owned: false, graceElapsed: 0 });
    });

    it('猶予は 0.99 秒まで続き（原因は無視）、ちょうど 1.0 秒で終わる（原因はゲームオーバー）', () => {
        let s = resolveFailure(owned).state;
        s = advanceBarrier(s, 0.99);
        expect(s.graceElapsed).toBeCloseTo(0.99, 10);
        expect(resolveFailure(s).outcome).toBe('ignored');
        s = advanceBarrier(s, 0.01);
        expect(s).toEqual({ owned: false, graceElapsed: null });
        expect(resolveFailure(s).outcome).toBe('gameover');
    });

    it('猶予の経過は dt を足していく（0.5 + 0.5 = 1.0 で終わる）', () => {
        let s = resolveFailure(owned).state;
        s = advanceBarrier(s, 0.5);
        expect(s.graceElapsed).toBe(0.5);
        s = advanceBarrier(s, 0.5);
        expect(s.graceElapsed).toBeNull();
    });

    it('実フレームの dt（1/60 秒）を足していくと、59 回目まではまだ猶予で、60 回目（足した経過 ≥ 1.0）で終わる', () => {
        let s = resolveFailure(owned).state;
        for (let i = 1; i <= 59; i++) {
            s = advanceBarrier(s, 1 / 60);
            expect(s.graceElapsed).not.toBeNull();
        }
        s = advanceBarrier(s, 1 / 60); // the 60th sum is 1.0000000000000013 in floating point: >= 1.0
        expect(s.graceElapsed).toBeNull();
    });

    it('0.1 秒のフレームを 10 回足すと 0.9999999999999999 になるが、10 回目で猶予が終わる（誤差で 1 フレーム延びない）', () => {
        let s = resolveFailure(owned).state;
        let sum = 0;
        for (let i = 0; i < 10; i++) sum += 0.1;
        expect(sum).toBeLessThan(1);
        for (let i = 1; i <= 9; i++) {
            s = advanceBarrier(s, 0.1);
            expect(s.graceElapsed).not.toBeNull();
        }
        s = advanceBarrier(s, 0.1);
        expect(s.graceElapsed).toBeNull();
    });

    it('isGraceActive: 壊れた直後は猶予、猶予が終われば猶予でない、なしのときも猶予でない', () => {
        expect(isGraceActive(createBarrierState())).toBe(false);
        const broken = resolveFailure(owned).state;
        expect(isGraceActive(broken)).toBe(true);
        expect(isGraceActive(advanceBarrier(broken, 1))).toBe(false);
    });

    it('猶予がないとき advanceBarrier は何も変えない', () => {
        expect(advanceBarrier(owned, 1)).toBe(owned);
        const none = createBarrierState();
        expect(advanceBarrier(none, 5)).toBe(none);
    });

    it('猶予の間にバリアを取ると、ありになる。猶予の間の原因は防がれる（バリアは使われない）。猶予が終わったあとの原因で壊れる', () => {
        let s = resolveFailure(owned).state; // broke: grace running
        s = pickUpBarrier(s);
        expect(s).toEqual({ owned: true, graceElapsed: 0 });
        const during = resolveFailure(s);
        expect(during.outcome).toBe('ignored');
        expect(during.state.owned).toBe(true);
        s = advanceBarrier(s, BARRIER_BREAK_SEC);
        expect(s).toEqual({ owned: true, graceElapsed: null });
        const after = resolveFailure(s);
        expect(after.outcome).toBe('absorbed');
        expect(after.state).toEqual({ owned: false, graceElapsed: 0 });
    });

    it('バリアが壊れて猶予が終わったあと、取り直さなければ原因はゲームオーバー', () => {
        let s = resolveFailure(owned).state;
        s = advanceBarrier(s, 2);
        expect(resolveFailure(s).outcome).toBe('gameover');
    });
});

describe('猶予の間の自機の不透明度 graceAlpha', () => {
    it('0 秒 → 0.4、0.09 秒 → 0.4、0.1 秒 → 1.0、0.19 秒 → 1.0、0.2 秒 → 0.4、猶予の外（null）→ 1.0', () => {
        expect(graceAlpha(0)).toBe(0.4);
        expect(graceAlpha(0.09)).toBe(0.4);
        expect(graceAlpha(0.1)).toBe(1);
        expect(graceAlpha(0.19)).toBe(1);
        expect(graceAlpha(0.2)).toBe(0.4);
        expect(graceAlpha(0.3)).toBe(1);
        expect(graceAlpha(null)).toBe(1);
    });

    it('1/60 秒を 6 回足した 0.09999999999999999 でも、0.1 秒の切り替えが 1 フレーム遅れない（誤差の補正）', () => {
        let elapsed = 0;
        for (let i = 0; i < 6; i++) elapsed += 1 / 60;
        expect(elapsed).toBeLessThan(0.1);
        expect(graceAlpha(elapsed)).toBe(1);
    });
});
