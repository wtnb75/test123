import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { applyStrike } from './pop';
import { announcedMultiplier, nextStreak, resolveStrike, streakMultiplier, type StrikeOutcome } from './streak';

/** Plays a list of strikes through `resolveStrike`, the same call the Game scene makes for every strike. */
const play = (outcomes: StrikeOutcome[], startScore = 0) => {
    let score = startScore;
    let streak = 0;
    const gains: number[] = [];
    const announced: number[] = [];
    for (const outcome of outcomes) {
        const r = resolveStrike(score, streak, outcome);
        score = r.score;
        streak = r.streak;
        if (outcome !== 'miss') gains.push(r.applied);
        if (r.announce !== null) announced.push(r.announce);
    }
    return { score, streak, gains, announced };
};

const moles = (n: number): StrikeOutcome[] => Array<StrikeOutcome>(n).fill('mole');

describe('streak parameters', () => {
    it('既定は 5 回ごとに +1 倍、上限 3 倍', () => {
        expect(PARAMS.streakStep).toBe(5);
        expect(PARAMS.streakMaxMultiplier).toBe(3);
        expect(PARAMS.scoreMole).toBe(10);
        expect(PARAMS.scoreFriend).toBe(-20);
    });
});

describe('streakMultiplier', () => {
    it.each([
        [0, 1],
        [4, 1],
        [5, 2],
        [9, 2],
        [10, 3],
        [11, 3],
        [100, 3],
    ])('叩く直前の連続が %i のとき ×%i', (streak, expected) => {
        expect(streakMultiplier(streak)).toBe(expected);
    });

    it.each([
        [3, 3, 4, 2],
        [2, 3, 4, 1],
        [9, 3, 4, 4],
        [12, 3, 4, 4],
    ])('連続 %i（step %i・上限 %i）のとき ×%i', (streak, step, max, expected) => {
        expect(streakMultiplier(streak, step, max)).toBe(expected);
    });
});

describe('nextStreak', () => {
    it('モグラを叩くと 1 増える', () => {
        expect(nextStreak(0, 'mole')).toBe(1);
        expect(nextStreak(12, 'mole')).toBe(13);
    });

    it('ネコを叩くと 0 に戻る', () => {
        expect(nextStreak(7, 'cat')).toBe(0);
    });

    it('空振りで 0 に戻る', () => {
        expect(nextStreak(7, 'miss')).toBe(0);
    });
});

describe('announcedMultiplier', () => {
    it.each([
        [5, 2],
        [10, 3],
    ])('連続が %i になったら ×%i を知らせる', (streak, expected) => {
        expect(announcedMultiplier(streak)).toBe(expected);
    });

    it.each([0, 1, 4, 6, 9, 11, 15, 20])('連続が %i では知らせない', (streak) => {
        expect(announcedMultiplier(streak)).toBeNull();
    });

    it('step 3・上限 4 なら 3→2、6→3、9→4、12 は上限を超えるので知らせない', () => {
        expect(announcedMultiplier(3, 3, 4)).toBe(2);
        expect(announcedMultiplier(6, 3, 4)).toBe(3);
        expect(announcedMultiplier(9, 3, 4)).toBe(4);
        expect(announcedMultiplier(12, 3, 4)).toBeNull();
        expect(announcedMultiplier(4, 3, 4)).toBeNull();
    });

    it('連続が 0 に戻ったあと、また 5 に達したら再び ×2 を知らせる', () => {
        let streak = 0;
        const announced: Array<number | null> = [];
        for (const o of [...moles(5), 'miss', ...moles(5)] as StrikeOutcome[]) {
            streak = nextStreak(streak, o);
            if (o === 'mole') announced.push(announcedMultiplier(streak));
        }
        expect(announced.filter((a) => a !== null)).toEqual([2, 2]);
    });
});

describe('applyStrike の倍率', () => {
    it('モグラは scoreMole × 倍率を加算する', () => {
        expect(applyStrike(0, 'mole', 3)).toEqual({ score: 30, applied: 30 });
        expect(applyStrike(15, 'mole', 2)).toEqual({ score: 35, applied: 20 });
    });

    it('倍率を省くと ×1（従来どおり）', () => {
        expect(applyStrike(15, 'mole')).toEqual({ score: 25, applied: 10 });
    });

    it('ネコの減点は倍率をかけない（0 未満にもならない）', () => {
        expect(applyStrike(50, 'cat', 3)).toEqual({ score: 30, applied: -20 });
        expect(applyStrike(5, 'cat', 3)).toEqual({ score: 0, applied: -5 });
    });
});

describe('スコアの流れ（連続と applyStrike の組み合わせ）', () => {
    it('途切れずに 12 匹叩くと +10 を 5 回、+20 を 5 回、+30 を 2 回で合計 210', () => {
        const r = play(moles(12));
        expect(r.gains).toEqual([10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 30, 30]);
        expect(r.score).toBe(210);
        expect(r.streak).toBe(12);
    });

    it('連続 7 で空振りすると、スコアは変わらず連続が 0 に戻り、次のモグラは +10', () => {
        const r = play([...moles(7), 'miss', 'mole']);
        // 5 x10 + 2 x20 = 90, then the next mole is x1
        expect(r.gains.slice(0, 7)).toEqual([10, 10, 10, 10, 10, 20, 20]);
        expect(r.gains[7]).toBe(10);
        expect(r.score).toBe(100);
    });

    it('連続 7 でネコを叩くと −20（倍率なし）で、連続が 0 に戻る', () => {
        const r = play([...moles(7), 'cat']);
        expect(r.gains[7]).toBe(-20);
        expect(r.score).toBe(90 - 20);
        expect(r.streak).toBe(0);
    });

    it('連続 12（×3）でネコを叩いても −20 のまま', () => {
        const r = play([...moles(12), 'cat']);
        expect(r.gains[12]).toBe(-20);
        expect(r.score).toBe(210 - 20);
    });

    it('スコアが足りないときのネコは 0 までで、連続は戻る', () => {
        const r = play(['mole', 'cat'], 0);
        expect(r.score).toBe(0);
        expect(r.gains).toEqual([10, -10]);
        expect(r.streak).toBe(0);
    });

    it('スコア 0・連続 0 でネコを叩いても、スコア 0 のまま連続は 0', () => {
        const r = play(['cat']);
        expect(r.score).toBe(0);
        expect(r.gains).toEqual([0]);
        expect(r.streak).toBe(0);
    });

    it('連続 5 でちょうど次のモグラから ×2（5 匹目までは +10、6 匹目から +20）', () => {
        const r = play(moles(6));
        expect(r.gains).toEqual([10, 10, 10, 10, 10, 20]);
    });

    it('連続 10 匹目の次から ×3（11 匹目から +30）', () => {
        const r = play(moles(11));
        expect(r.gains[9]).toBe(20);
        expect(r.gains[10]).toBe(30);
    });

    it('予告は、連続が 5 と 10 になった叩きで 1 回ずつ（×2、×3）。ネコや空振りでは出ない', () => {
        expect(play(moles(4)).announced).toEqual([]);
        expect(play(moles(5)).announced).toEqual([2]);
        expect(play(moles(10)).announced).toEqual([2, 3]);
        expect(play(moles(15)).announced).toEqual([2, 3]);
        expect(play([...moles(4), 'cat', ...moles(4)]).announced).toEqual([]);
        expect(play([...moles(4), 'miss', ...moles(4)]).announced).toEqual([]);
    });

    it('resolveStrike: 空振りはスコアを変えず、連続を 0 に戻し、予告も出さない', () => {
        expect(resolveStrike(40, 9, 'miss')).toEqual({ score: 40, streak: 0, applied: 0, announce: null });
    });

    it('resolveStrike: 連続 4 のモグラは ×1（+10）で連続 5 になり ×2 を予告する', () => {
        expect(resolveStrike(40, 4, 'mole')).toEqual({ score: 50, streak: 5, applied: 10, announce: 2 });
    });

    it('resolveStrike: ネコは −20 で連続を 0 に戻し、予告しない', () => {
        expect(resolveStrike(40, 9, 'cat')).toEqual({ score: 20, streak: 0, applied: -20, announce: null });
    });

    it('基本の加点: 連続 0〜4 のうちは従来どおり 1 匹 +10', () => {
        expect(play(moles(1)).score).toBe(10);
        expect(play(moles(5)).score).toBe(50);
    });
});
