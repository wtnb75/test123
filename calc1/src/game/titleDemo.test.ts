import { describe, expect, it } from 'vitest';
import { DemoDirector, type DemoGame } from 'title-demo';
import { OPERATION_POOL, evaluateProgress, type Operation, type TurnSlot } from './logic';
import {
    computeDemoBoardLayout,
    createDemoGame,
    createDemoPuzzle,
    DEMO_ATTEMPTS,
    DEMO_COLORS,
    DEMO_OPTIONS,
    DEMO_TURNS,
    describeDemo,
    type DemoDetail,
    type DemoState
} from './titleDemo';

const op = (label: string): Operation => {
    const found = OPERATION_POOL.find((candidate) => candidate.label === label);

    if (found === undefined) {
        throw new Error(`no operation ${label}`);
    }

    return found;
};

/** mulberry32: a small seeded random source. */
const seeded = (seed: number): (() => number) => {
    let state = seed >>> 0;

    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** Five turns of four options each; the three given turns are the solution. */
const handState = (initial: number, target: number, picks: Array<[number, string]>): DemoState => {
    const slots: TurnSlot[] = Array.from({ length: DEMO_TURNS }, () => ({
        options: [op('+1'), op('+2'), op('×2'), op('×3')],
        selected: null
    }));
    const path = Array.from({ length: Math.max(...picks.map(([turn]) => turn)) + 1 }, (_, turn) => {
        const pick = picks.find(([index]) => index === turn);
        return { operation: pick ? op(pick[1]) : null, resultValue: 0, options: slots[turn].options };
    });

    return { initial, target, slots, path, progress: evaluateProgress(initial, target, slots), result: 'playing', wrong: false };
};

describe('createDemoPuzzle', () => {
    it('採用される問題は、解があり、スキップでない手が 2 個以上で、初期値・目標値が Lv.1 の範囲にある（多数のシード。フォールバックの空振りも数える）', () => {
        let normal = 0;
        let fallback = 0;
        let fallbackOnly = 0;

        for (let seed = 1; seed <= 150; seed += 1) {
            const puzzle = createDemoPuzzle(seeded(seed));
            const ops = puzzle.path.filter((entry) => entry.operation !== null).length;

            if (puzzle.slots.length !== DEMO_TURNS) {
                expect.fail(`seed ${seed}: ${puzzle.slots.length} rows`);
            }

            if (puzzle.initial < 1 || puzzle.initial > 5) {
                expect.fail(`seed ${seed}: initial ${puzzle.initial}`);
            }

            let value = puzzle.initial;

            puzzle.path.forEach((entry) => {
                value = entry.operation === null ? value : entry.operation.apply(value);
            });

            if (value !== puzzle.target) {
                expect.fail(`seed ${seed}: the path gives ${value}, not ${puzzle.target}`);
            }

            const last = puzzle.path[puzzle.path.length - 1];

            if (last.resultValue !== puzzle.target) {
                expect.fail(`seed ${seed}: the path ends at ${last.resultValue}, not ${puzzle.target}`);
            }

            if (ops >= 2) {
                normal += 1;

                if (puzzle.target < 20 || puzzle.target > 50) {
                    expect.fail(`seed ${seed}: target ${puzzle.target} is out of 20..50`);
                }
            } else {
                fallback += 1;
                if (puzzle.path.length === 1 && puzzle.path[0].operation === puzzle.slots[0].options[0]) {
                    fallbackOnly += 1;
                }
            }
        }

        expect(normal).toBeGreaterThan(0);
        expect(normal + fallback).toBe(150);
        expect(fallbackOnly).toBe(fallback);
    });

    it('同じ種なら同じ問題になる（再現できる）', () => {
        expect(createDemoPuzzle(seeded(42))).toEqual(createDemoPuzzle(seeded(42)));
    });

    it('試行の上限は 200 回で、Game と同じ値', () => {
        expect(DEMO_ATTEMPTS).toBe(200);
    });
});

describe('createDemoGame: the bot', () => {
    it('plan: 正しい選択（pick と fix）は最短の解のスキップでない手を 1 回ずつ含み、スキップの手を含まない', () => {
        const game = createDemoGame(seeded(3));
        const state = game.start();
        const turns = state.path.flatMap((entry, turn) => (entry.operation === null ? [] : [turn]));
        const plan = game.plan(state);

        if (plan === null || plan === 'pending') {
            expect.fail('no plan');
        }

        const correct = plan.filter((action) => action.kind === 'pick' || action.kind === 'fix');
        expect(correct.map((action) => action.turn).sort((x, y) => x - y)).toEqual(turns);
        expect(correct.every((action) => state.path[action.turn].operation === action.operation)).toBe(true);
    });

    it('Fisher–Yates と間違いの手計算: 乱数 [0, 0.99（シャッフル）, 0.9, 0.9, 0.9（候補なし）, 0（強制は先頭）, 0（誤った演算は先頭）] で、手 3 が mistake(+2) → hold → fix(+1)、続いて手 2・手 0 の pick', () => {
        const state = handState(4, 37, [[0, '×3'], [2, '×3'], [3, '+1']]);
        const rolls = [0, 0.99, 0.9, 0.9, 0.9, 0, 0];
        const game = createDemoGame(() => rolls.shift() ?? 0);

        expect(game.plan(state)).toEqual([
            { kind: 'mistake', turn: 3, operation: op('+2') },
            { kind: 'hold', turn: 3, operation: null },
            { kind: 'fix', turn: 3, operation: op('+1') },
            { kind: 'pick', turn: 2, operation: op('×3') },
            { kind: 'pick', turn: 0, operation: op('×3') }
        ]);
    });

    it('間違える候補は先頭から 2 個まで（乱数が全部 0 なら、3 つの選択のうち先頭の 2 つだけが mistake になる）', () => {
        const state = handState(4, 37, [[0, '×3'], [2, '×3'], [3, '+1']]);
        const game = createDemoGame(() => 0);
        const plan = game.plan(state);

        if (plan === null || plan === 'pending') {
            expect.fail('no plan');
        }

        expect(plan.filter((action) => action.kind === 'mistake')).toHaveLength(2);
        expect(plan.filter((action) => action.kind === 'pick')).toHaveLength(1);
    });

    it('誤った選択が目標値に一致してしまう演算は選ばない（初期値 4・目標 8・手 0 と手 1 が +2: 手 0 の ×2 は 8 で一致するので、誤りは +1 になる）', () => {
        const state = handState(4, 8, [[0, '+2'], [1, '+2']]);
        const plan = createDemoGame(() => 0).plan(state);

        expect(plan).toEqual([
            { kind: 'mistake', turn: 1, operation: op('+1') },
            { kind: 'hold', turn: 1, operation: null },
            { kind: 'fix', turn: 1, operation: op('+2') },
            { kind: 'mistake', turn: 0, operation: op('+1') },
            { kind: 'hold', turn: 0, operation: null },
            { kind: 'fix', turn: 0, operation: op('+2') }
        ]);
    });

    it('誤った選択が全て一致してしまう手は、間違えない（その手は pick のまま）', () => {
        // every wrong option would reach the target (8) at once, so the bot has nothing to get wrong
        const winning: Operation = { label: 'w', apply: () => 8 };
        const slots: TurnSlot[] = Array.from({ length: DEMO_TURNS }, () => ({
            options: [op('×2'), winning, { label: 'w2', apply: () => 8 }, { label: 'w3', apply: () => 8 }],
            selected: null
        }));
        const path = [{ operation: op('×2'), resultValue: 8, options: slots[0].options }];
        const state: DemoState = { initial: 4, target: 8, slots, path, progress: evaluateProgress(4, 8, slots), result: 'playing', wrong: false };
        const plan = createDemoGame(() => 0).plan(state);

        expect(plan).toEqual([{ kind: 'pick', turn: 0, operation: op('×2') }]);
    });

    it('多数のシードで、plan は mistake を 0〜2 個含み、どの mistake も hold・同じ手の fix が続き、ほぼ全ての計画に mistake がある（空振りの検査つき）', () => {
        let withMistake = 0;

        for (let seed = 1; seed <= 150; seed += 1) {
            const game = createDemoGame(seeded(seed));
            const state = game.start();
            const plan = game.plan(state);

            if (plan === null || plan === 'pending') {
                expect.fail(`seed ${seed}: no plan`);
            }

            const mistakes = plan.filter((action) => action.kind === 'mistake');

            if (mistakes.length > 2) {
                expect.fail(`seed ${seed}: ${mistakes.length} mistakes`);
            }

            plan.forEach((action, index) => {
                if (action.kind !== 'mistake') {
                    return;
                }

                const hold = plan[index + 1];
                const fix = plan[index + 2];

                if (hold?.kind !== 'hold' || fix?.kind !== 'fix' || hold.turn !== action.turn || fix.turn !== action.turn) {
                    expect.fail(`seed ${seed}: the mistake at ${index} is not followed by hold and fix`);
                }

                if (action.operation === null || action.operation.label === fix.operation?.label) {
                    expect.fail(`seed ${seed}: the mistake is the right operation`);
                }
            });

            // no mistake wins: apply the plan step by step and stop at the first win
            const slots = state.slots.map((slot) => ({ options: slot.options, selected: null as Operation | null }));

            for (const action of plan) {
                if (action.kind === 'hold') {
                    continue;
                }

                slots[action.turn].selected = action.operation;
                const won = evaluateProgress(state.initial, state.target, slots).won;

                if (won) {
                    if (action.kind === 'mistake') {
                        expect.fail(`seed ${seed}: a mistake won the round`);
                    }

                    break;
                }
            }

            if (mistakes.length > 0) {
                withMistake += 1;
            }
        }

        expect(withMistake).toBeGreaterThan(142);
    });

    it('play: 手 2 → 手 0 の順に選ぶと、手 0 の選択で目標値に一致し（4 → 12 → 12 → 36）、一致するまでは roundDone ではない', () => {
        const state = handState(4, 36, [[0, '×3'], [2, '×3']]);
        const game = createDemoGame(() => 0.5);

        const first = game.play(state, { kind: 'pick', turn: 2, operation: op('×3') });
        expect(first).toEqual({ moved: true, roundDone: false, detail: { kind: 'pick', turn: 2, won: false } });
        expect(state.progress.rows.map((row) => row.value)).toEqual([4, 4, 12, 12, 12]);

        const second = game.play(state, { kind: 'pick', turn: 0, operation: op('×3') });
        expect(second).toEqual({ moved: true, roundDone: true, detail: { kind: 'pick', turn: 0, won: true } });
        expect(state.progress.rows.map((row) => row.value)).toEqual([12, 12, 36, 36, 36]);
        expect(state.result).toBe('won');
        expect(state.progress.rows.map((row) => row.isAutoSkip)).toEqual([false, false, false, true, true]);
    });

    it('mistake で「間違い中」になり、hold は何も変えず、fix で戻る（誤った +1 で 4 → 5、直して ×3 で 12）', () => {
        const state = handState(4, 36, [[0, '×3'], [2, '×3']]);
        const game = createDemoGame(() => 0.5);

        game.play(state, { kind: 'mistake', turn: 0, operation: op('+1') });
        expect([state.wrong, state.progress.currentValue]).toEqual([true, 5]);
        expect(describeDemo(state).headerCurrentColor).toBe(DEMO_COLORS.wrong);

        const hold = game.play(state, { kind: 'hold', turn: 0, operation: null });
        expect(hold).toEqual({ moved: true, roundDone: false, detail: { kind: 'hold', turn: 0, won: false } });
        expect([state.wrong, state.progress.currentValue]).toEqual([true, 5]);

        game.play(state, { kind: 'fix', turn: 0, operation: op('×3') });
        expect([state.wrong, state.progress.currentValue]).toEqual([false, 12]);
        expect(describeDemo(state).headerCurrentColor).toBe(DEMO_COLORS.text);
    });

    it('順不同の途中で目標値に一致したら、残りの手を選ぶ前にラウンドが終わる（目標 12: 手 0 の ×3 だけで一致）', () => {
        const state = handState(4, 12, [[0, '×3'], [1, '+1'], [2, '+2']]);
        const game = createDemoGame(() => 0.5);

        expect(game.play(state, { kind: 'pick', turn: 0, operation: op('×3') }).roundDone).toBe(true);
        expect(state.progress.wonAtTurn).toBe(1);
    });

    it('勝利のあとの play は何も変えない（moved: false）', () => {
        const state = handState(4, 12, [[0, '×3']]);
        const game = createDemoGame(() => 0.5);
        game.play(state, { kind: 'pick', turn: 0, operation: op('×3') });

        expect(game.play(state, { kind: 'pick', turn: 1, operation: op('+1') }).moved).toBe(false);
        expect(state.slots[1].selected).toBeNull();
    });

    it('advance は新しい問題にして、選択を空に戻し、結果を playing にする', () => {
        const game = createDemoGame(seeded(8));
        const state = game.start();
        const before = { initial: state.initial, target: state.target };
        const action = game.plan(state);

        if (action === null || action === 'pending') {
            expect.fail('no plan');
        }

        game.play(state, action[0]);
        state.result = 'won';
        game.advance?.(state);

        expect(state.result).toBe('playing');
        expect(state.slots.every((slot) => slot.selected === null)).toBe(true);
        expect([state.initial, state.target]).not.toEqual([before.initial, before.target]);
    });
});

describe('describeDemo', () => {
    it('初期状態: ヘッダーの 2 行、全行でスキップが青・演算は未選択の色、状態の文字は空', () => {
        const state = handState(4, 36, [[0, '×3'], [2, '×3']]);
        const view = describeDemo(state);

        expect(view.headerTop).toBe('目標: 36  初期値: 4');
        expect(view.headerCurrent).toBe('現在値: 4');
        expect(view.headerCurrentColor).toBe(DEMO_COLORS.text);
        expect(view.status).toBe('');
        expect(view.rows).toHaveLength(DEMO_TURNS);

        for (const row of view.rows) {
            expect(row.buttons.map((button) => button.fill)).toEqual([
                DEMO_COLORS.unselected, DEMO_COLORS.unselected, DEMO_COLORS.unselected, DEMO_COLORS.unselected,
                DEMO_COLORS.selected
            ]);
            expect(row.buttons.map((button) => button.label)).toEqual(['+1', '+2', '×2', '×3', '-']);
        }
    });

    it('行が演算を選ぶと、その演算が青、その行のスキップは選ばれていない色（0x475569）になる', () => {
        const state = handState(4, 36, [[0, '×3'], [2, '×3']]);
        state.slots[2].selected = op('×3');
        state.progress = evaluateProgress(state.initial, state.target, state.slots);
        const row = describeDemo(state).rows[2];

        expect(row.buttons.map((button) => button.fill)).toEqual([
            DEMO_COLORS.unselected, DEMO_COLORS.unselected, DEMO_COLORS.unselected, DEMO_COLORS.selected, DEMO_COLORS.skip
        ]);
        expect(row.value).toBe(12);
    });

    it('勝利: 「クリア!」と、現在値の緑。勝利した行より後ろは 5 個とも無効色で、選んであった演算も強調しない', () => {
        const state = handState(4, 12, [[0, '×3']]);
        state.slots[0].selected = op('×3');
        state.slots[2].selected = op('+2');
        state.progress = evaluateProgress(state.initial, state.target, state.slots);
        state.result = 'won';
        const view = describeDemo(state);

        expect(view.status).toBe('クリア!');
        expect(view.headerCurrentColor).toBe(DEMO_COLORS.win);
        expect(view.rows[0].buttons[3].fill).toBe(DEMO_COLORS.selected);
        expect(view.rows[2].buttons.every((button) => button.fill === DEMO_COLORS.disabled)).toBe(true);
        expect(view.rows[2].buttons.every((button) => button.labelColor === DEMO_COLORS.disabledText)).toBe(true);
    });
});

describe('computeDemoBoardLayout', () => {
    it('領域 300〜780 の中央に高さ 350 のブロック: blockTop 365、表の上端 425、行の中心 450 + 50 i、状態の文字 701', () => {
        expect(computeDemoBoardLayout()).toEqual({
            blockTop: 365,
            tableTop: 425,
            panelHeight: 250,
            rowCenters: [450, 500, 550, 600, 650],
            statusY: 701
        });
    });
});

describe('DemoDirector with the demo options', () => {
    it('オプションは 1 走り 2 ラウンド、選択の間隔 700 ms、待ち 1500 ms、透明化 400 ms', () => {
        expect(DEMO_OPTIONS).toEqual({ rounds: 2, timing: { stepMs: 700, waitMs: 1500, fadeMs: 400 } });
    });

    it('各ラウンドが 3 回目の選択で終わるとき、時刻列は spec の表どおり（1500・2200・2900・4400・5900・6600・7300・8800・9200）', () => {
        const stub: DemoGame<{ played: number }, number, DemoDetail> = {
            start: () => ({ played: 0 }),
            plan: () => [1, 2, 3],
            play: (state, action) => {
                state.played += 1;
                return { moved: true, roundDone: action === 3, detail: { kind: 'pick', turn: action, won: action === 3 } };
            },
            advance: () => undefined
        };
        const director = new DemoDirector(stub, DEMO_OPTIONS, 0);
        const events: [number, string][] = [];
        let midFade = -1;

        for (let now = 1; now <= 11100; now += 1) {
            const event = director.tick(now);

            if (now === 9000) {
                midFade = director.opacity(now);
            }

            if (event !== null) {
                events.push([now, event.kind]);
            }
        }

        expect(events).toEqual([
            [1500, 'action'],
            [2200, 'action'],
            [2900, 'action'],
            [4400, 'advance'],
            [5900, 'action'],
            [6600, 'action'],
            [7300, 'action'],
            [8800, 'fade-out'],
            [9200, 'fade-in'],
            [11100, 'action']
        ]);
        expect(midFade).toBeCloseTo(0.5, 5);
    });
});
