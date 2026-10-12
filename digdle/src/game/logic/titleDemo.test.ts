import { describe, expect, it } from 'vitest';
import { DemoDirector, type DemoGame } from 'title-demo';
import { CELL_FILL, cellLabelSize, COLORS } from './boardStyle';
import { judgeGuess } from './judge';
import { createRng, generateNDigitPrimes } from './primes';
import {
    createDemoGame,
    createTypeSchedule,
    DEMO_ATTEMPTS,
    DEMO_FADE_MS,
    DEMO_OPTIONS,
    DEMO_WAIT_MS,
    isJudged,
    typedDigits,
    type DemoDetail,
    type DemoState
} from './titleDemo';

/** A "random" source that returns the given values in order, then keeps returning the last one. */
const scripted = (values: number[]): (() => number) => {
    let index = 0;

    return () => values[Math.min(index++, values.length - 1)];
};

const PRIMES = generateNDigitPrimes(4);

describe('createTypeSchedule', () => {
    it('乱数が常に 0 なら全ての間隔が 150 で、色は 750 ms に付く', () => {
        expect(createTypeSchedule(() => 0, 4)).toEqual({ typeAt: [0, 150, 300, 450], judgeAt: 750 });
    });

    it('乱数が 1 未満の最大なら全ての間隔が 400 で、色は 1500 ms に付く', () => {
        expect(createTypeSchedule(() => 0.9999999, 4)).toEqual({ typeAt: [0, 400, 800, 1200], judgeAt: 1500 });
    });

    it('乱数 0・0.5・0.9999999 の順なら間隔は 150・275・400（0.5 x 251 の切り捨て = 125）', () => {
        expect(createTypeSchedule(scripted([0, 0.5, 0.9999999]), 4)).toEqual({ typeAt: [0, 150, 425, 825], judgeAt: 1125 });
    });

    it('桁数 − 1 回だけ乱数を引く（4 桁なら 3 回）', () => {
        let calls = 0;
        createTypeSchedule(() => {
            calls += 1;
            return 0;
        }, 4);
        expect(calls).toBe(3);
    });

    it('どのシードでも、間隔は 150〜400、色の時刻は待ち（1800 ms）より短い', () => {
        for (let seed = 1; seed <= 200; seed += 1) {
            const { typeAt, judgeAt } = createTypeSchedule(createRng(seed), 4);

            for (let index = 1; index < typeAt.length; index += 1) {
                const gap = typeAt[index] - typeAt[index - 1];

                if (gap < 150 || gap > 400) {
                    expect.fail(`seed ${seed}: gap ${gap} is out of 150..400`);
                }
            }

            if (judgeAt >= DEMO_WAIT_MS) {
                expect.fail(`seed ${seed}: judgeAt ${judgeAt} is not below ${DEMO_WAIT_MS}`);
            }
        }
    });
});

describe('typedDigits / isJudged', () => {
    // gaps (200, 150, 400): digits appear at 0, 200, 350, 750; the colours at 750 + 300 = 1050
    const row = { typeAt: [0, 200, 350, 750], judgeAt: 1050 };

    it('推測の前（−1 ms）はまだ何も現れない', () => {
        expect([typedDigits(row, -1), isJudged(row, -1)]).toEqual([0, false]);
    });

    it('桁は 0・200・350・750 ms で 1 つずつ増え、その直前は増えず、4 桁そろっても色はまだ付かない', () => {
        const elapsedList = [0, 199, 200, 349, 350, 749, 750];
        expect(elapsedList.map((elapsed) => typedDigits(row, elapsed))).toEqual([1, 1, 2, 2, 3, 3, 4]);
        expect(elapsedList.map((elapsed) => isJudged(row, elapsed))).toEqual([false, false, false, false, false, false, false]);
    });

    it('色は 1050 ms で付く（1049 ms では付かず、4 桁とも入っている）', () => {
        expect([typedDigits(row, 1049), isJudged(row, 1049)]).toEqual([4, false]);
        expect([typedDigits(row, 1050), isJudged(row, 1050)]).toEqual([4, true]);
        expect(isJudged(row, 5000)).toBe(true);
    });
});

describe('createDemoGame: the bot', () => {
    // all primes are 4-digit: the answer is 1021, the first guess 1013 (green, green, yellow, gray)
    const small = ['1013', '1019', '1021', '1031'];

    it('4 桁の試行回数は 5 回で、素数を渡さないときは 4 桁の素数の全体から始める', () => {
        expect(DEMO_ATTEMPTS).toBe(5);

        const state = createDemoGame({ rng: createRng(1) }).start();
        expect(state.candidates).toHaveLength(PRIMES.length);
        expect(state.candidates.every((prime) => prime.length === 4)).toBe(true);
        expect(state.candidates).toContain(state.answer);
    });

    it('start は一様な乱数で正解を選び、履歴は空・候補は全ての素数', () => {
        const game = createDemoGame({ rng: scripted([0.5]), primes: small });
        const state = game.start();
        expect(state).toEqual({ answer: '1021', rows: [], candidates: small, result: 'playing' });
    });

    it('最初の推測は全ての素数から選ぶ（乱数 0 なら先頭の 1013）', () => {
        const game = createDemoGame({ rng: scripted([0.5, 0]), primes: small });
        const state = game.start();
        expect(game.plan(state)).toEqual(['1013']);
    });

    it('1013 の結果（green, green, yellow, gray）と矛盾しない候補は 1021 だけになる（手計算）', () => {
        const game = createDemoGame({ rng: scripted([0.5, 0, 0, 0, 0]), primes: small });
        const state = game.start();
        const result = game.play(state, '1013');

        expect(state.rows[0].colors).toEqual(['green', 'green', 'yellow', 'gray']);
        expect(state.candidates).toEqual(['1021']);
        expect(result).toEqual({ moved: true, roundDone: false, detail: { row: 0 } });
    });

    it('候補が 1 つなら次の推測はその素数で、正解（全桁 green）なら won・roundDone になる', () => {
        const game = createDemoGame({ rng: scripted([0.5, 0, 0, 0, 0, 0.7, 0, 0, 0]), primes: small });
        const state = game.start();
        game.play(state, '1013');
        const plan = game.plan(state);
        expect(plan).toEqual(['1021']);

        const result = game.play(state, '1021');
        expect(state.result).toBe('won');
        expect(result).toEqual({ moved: true, roundDone: true, detail: { row: 1 } });
    });

    it('play は推測のあとに桁の間隔を 3 つ引き、履歴の行に typeAt と judgeAt を持つ', () => {
        const game = createDemoGame({ rng: scripted([0.5, 0, 0.5, 0.9999999]), primes: small });
        const state = game.start();
        game.play(state, '1013');
        expect(state.rows[0]).toMatchObject({ guess: '1013', typeAt: [0, 0 + 150, 150 + 275, 425 + 400], judgeAt: 1125 });
    });

    it('5 回使い切ると lost・roundDone になり、4 回目までは playing', () => {
        const game = createDemoGame({ rng: createRng(7), primes: PRIMES });
        const state = game.start();
        const wrong = PRIMES.filter((prime) => prime !== state.answer).slice(0, DEMO_ATTEMPTS);

        for (let index = 0; index < DEMO_ATTEMPTS - 1; index += 1) {
            const result = game.play(state, wrong[index]);
            expect([state.result, result.roundDone]).toEqual(['playing', false]);
        }

        const last = game.play(state, wrong[DEMO_ATTEMPTS - 1]);
        expect([state.result, last.roundDone, last.detail.row]).toEqual(['lost', true, DEMO_ATTEMPTS - 1]);

        const previous = state.answer;
        game.advance?.(state);
        expect(state.result).toBe('playing');
        expect(state.rows).toEqual([]);
        expect(state.answer).not.toBe(previous);
    });

    it('lost のあと plan は null、play は動かない（moved: false）', () => {
        const game = createDemoGame({ rng: createRng(3), primes: PRIMES });
        const state = game.start();
        state.result = 'lost';
        expect(game.plan(state)).toBeNull();
        expect(game.play(state, PRIMES[0])).toEqual({ moved: false, roundDone: false, detail: { row: 0 } });
    });

    it('advance は履歴を空にし、直前と異なる正解を選び、候補を全ての素数に戻す', () => {
        const game = createDemoGame({ rng: createRng(11), primes: PRIMES });
        const state = game.start();
        const previous = state.answer;
        game.play(state, PRIMES.find((prime) => prime !== previous) ?? '');
        state.result = 'lost';

        game.advance?.(state);
        expect(state.answer).not.toBe(previous);
        expect(PRIMES).toContain(state.answer);
        expect(state.rows).toEqual([]);
        expect(state.candidates).toEqual(PRIMES);
        expect(state.candidates).not.toBe(PRIMES);
        expect(state.result).toBe('playing');
    });

    it('advance の乱数が直前の正解と同じ素数を指しても、別の素数になる（1021 の次も乱数 0.5）', () => {
        const small = ['1013', '1019', '1021', '1031'];
        const game = createDemoGame({ rng: scripted([0.5, 0.5]), primes: small });
        const state = game.start();
        expect(state.answer).toBe('1021');

        game.advance?.(state);
        expect(state.answer).not.toBe('1021');
        expect(small).toContain(state.answer);
    });

    it('多数のシードで、どの推測も 4 桁の素数・過去の全ての色と矛盾せず・繰り返さず、ラウンドは 5 回以内に終わる', () => {
        let won = 0;
        let lost = 0;

        for (let seed = 1; seed <= 120; seed += 1) {
            const game = createDemoGame({ rng: createRng(seed), primes: PRIMES });
            const state = game.start();
            const seen = new Set<string>();

            for (let attempt = 0; attempt < DEMO_ATTEMPTS && state.result === 'playing'; attempt += 1) {
                const plan = game.plan(state);
                const guess = plan?.[0] ?? '';

                if (!PRIMES.includes(guess)) {
                    expect.fail(`seed ${seed}: guess ${guess} is not a 4-digit prime`);
                }

                if (seen.has(guess)) {
                    expect.fail(`seed ${seed}: guess ${guess} was repeated`);
                }

                for (const earlier of state.rows) {
                    const agrees = judgeGuess(guess, earlier.guess).every((color, index) => color === earlier.colors[index]);

                    if (!agrees) {
                        expect.fail(`seed ${seed}: guess ${guess} contradicts ${earlier.guess}`);
                    }
                }

                seen.add(guess);
                game.play(state, guess);

                if (state.result === 'playing' && !state.candidates.includes(state.answer)) {
                    expect.fail(`seed ${seed}: the answer left the candidates after ${guess}`);
                }

                if (guess !== state.answer && state.candidates.includes(guess)) {
                    expect.fail(`seed ${seed}: the wrong guess ${guess} is still a candidate`);
                }
            }

            if (state.result === 'playing') {
                expect.fail(`seed ${seed}: the round did not end within ${DEMO_ATTEMPTS} guesses`);
            }

            if (state.result === 'won') {
                won += 1;
            } else {
                lost += 1;
            }
        }

        expect(won).toBeGreaterThan(0);
        expect(won + lost).toBe(120);
    });
});

describe('DemoDirector with the demo options', () => {
    it('オプションは 1 走り 2 ラウンド・待ち 1800 ms・透明化 400 ms', () => {
        expect(DEMO_OPTIONS).toEqual({
            rounds: 2,
            timing: { stepMs: 1800, waitMs: 1800, fadeMs: 400 }
        });
        expect(DEMO_FADE_MS).toBe(400);
    });

    it('各ラウンドが 2 手目で終わるとき、推測・advance・fade-out・fade-in は spec の時刻列どおり', () => {
        // a stub whose rounds end on the 2nd action, to check the timing the options give
        const stub: DemoGame<{ guesses: number }, number, DemoDetail> = {
            start: () => ({ guesses: 0 }),
            plan: () => [1],
            play: (state) => {
                state.guesses += 1;
                return { moved: true, roundDone: state.guesses % 2 === 0, detail: { row: (state.guesses - 1) % 2 } };
            },
            advance: () => undefined
        };
        const director = new DemoDirector(stub, DEMO_OPTIONS, 0);
        const events: [number, string][] = [];

        let midFade = -1;

        for (let now = 1; now <= 13400; now += 1) {
            const event = director.tick(now);

            if (now === 11000) {
                midFade = director.opacity(now);
            }

            if (event !== null) {
                events.push([now, event.kind]);
            }
        }

        expect(events).toEqual([
            [1800, 'action'],
            [3600, 'action'],
            [5400, 'advance'],
            [7200, 'action'],
            [9000, 'action'],
            [10800, 'fade-out'],
            [11200, 'fade-in'],
            [13400, 'action']
        ]);
        expect(midFade).toBeCloseTo(0.5, 5);
    });

    it('実際のデモのゲームを 2 ラウンド通して回すと、advance で履歴が空・正解が変わり、fade-in で新しい走りになる', () => {
        const game = createDemoGame({ rng: createRng(5), primes: PRIMES });
        const director = new DemoDirector<DemoState, string, DemoDetail>(game, DEMO_OPTIONS, 0);
        const firstAnswer = director.state.answer;
        let advancedAnswer = '';
        let advancedRows = -1;
        let fadeOutAt = -1;
        let fadeInRows = -1;
        let fadeInRounds = -1;
        let fadeInOpacity = -1;

        for (let now = 1; now <= 60000 && fadeInRows < 0; now += 1) {
            const event = director.tick(now);

            if (event?.kind === 'advance' && advancedRows < 0) {
                advancedAnswer = director.state.answer;
                advancedRows = director.state.rows.length;
            } else if (event?.kind === 'fade-out') {
                fadeOutAt = now;
            } else if (event?.kind === 'fade-in') {
                fadeInRows = director.state.rows.length;
                fadeInRounds = director.rounds;
                fadeInOpacity = director.opacity(now);
            }
        }

        expect(advancedRows).toBe(0);
        expect(advancedAnswer).not.toBe(firstAnswer);
        expect(fadeOutAt).toBeGreaterThan(0);
        expect([fadeInRows, fadeInRounds, fadeInOpacity]).toEqual([0, 0, 0]);
    });

    it('実際のデモのゲームでも、最初の推測は 1800 ms で、行 0 が詳細に入る', () => {
        const game = createDemoGame({ rng: createRng(5), primes: PRIMES });
        const director = new DemoDirector<DemoState, string, DemoDetail>(game, DEMO_OPTIONS, 0);
        let first: [number, number] | null = null;

        for (let now = 1; now <= 1800 && first === null; now += 1) {
            const event = director.tick(now);

            if (event?.kind === 'action') {
                first = [now, event.detail.row];
            }
        }

        expect(first).toEqual([1800, 0]);
    });
});

describe('boardStyle', () => {
    it('数字の大きさはセルの半分、最低 20 px', () => {
        expect([30, 40, 41, 42, 44, 60].map(cellLabelSize)).toEqual([20, 20, 20, 21, 22, 30]);
    });

    it('ヒントの色と空のセルの塗りは Game の盤面と同じ値', () => {
        expect(COLORS).toEqual({ green: 0x16a34a, yellow: 0xf59e0b, gray: 0x6b7280 });
        expect(CELL_FILL).toBe(0x1f2937);
    });
});
