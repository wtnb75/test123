import { describe, expect, it } from 'vitest';
import { applyGuess, ATTEMPT_LIMITS, createGame } from './game';
import { judgeGuess } from './judge';
import {
    buildPrimeMap,
    choosePrime,
    createRng,
    generateNDigitPrimes,
    isPrimeNumber,
    isPrimeString,
    SUPPORTED_DIGITS,
    type PrimeMap
} from './primes';
import { validateGuess, validateHardMode, INVALID_LENGTH_MESSAGE, INVALID_PRIME_MESSAGE } from './validate';
import type { DigitStatus, GuessHistory } from '../types';

// Checks against independent oracles: a reference implementation, a sieve, and known prime counts.

const sieve = (limit: number): boolean[] => {
    const isPrime = new Array<boolean>(limit + 1).fill(true);
    isPrime[0] = false;
    isPrime[1] = false;
    for (let i = 2; i * i <= limit; i += 1) {
        if (isPrime[i]) {
            for (let j = i * i; j <= limit; j += i) {
                isPrime[j] = false;
            }
        }
    }

    return isPrime;
};

const SIEVE = sieve(999_999);

// Number of primes with exactly N digits (OEIS A006879).
const PRIME_COUNTS: Record<number, number> = { 1: 4, 2: 21, 3: 143, 4: 1061, 5: 8363, 6: 68906 };

function* strings(alphabet: string, length: number): Generator<string> {
    const total = alphabet.length ** length;
    for (let code = 0; code < total; code += 1) {
        let rest = code;
        let out = '';
        for (let i = 0; i < length; i += 1) {
            out += alphabet[rest % alphabet.length];
            rest = Math.floor(rest / alphabet.length);
        }
        yield out;
    }
}

describe('judgeGuess against a reference implementation', () => {
    // A cell is green when it matches. Otherwise it is yellow only while the answer still has an
    // unmatched copy of that digit left over after the unmatched guess digits to its left.
    const reference = (answer: string, guess: string): DigitStatus[] =>
        Array.from(guess, (digit, i) => {
            if (digit === answer[i]) {
                return 'green';
            }
            const claimedBefore = [...guess.slice(0, i)].filter((g, j) => g === digit && answer[j] !== digit).length;
            const unmatchedInAnswer = [...answer].filter((a, j) => a === digit && guess[j] !== digit).length;

            return claimedBefore < unmatchedInAnswer ? 'yellow' : 'gray';
        });

    it.each([1, 2, 3, 4, 5])('agrees on every pair of %i-digit strings over 0, 1 and 2', (length) => {
        for (const answer of strings('012', length)) {
            for (const guess of strings('012', length)) {
                const actual = judgeGuess(answer, guess);
                if (actual.join() !== reference(answer, guess).join()) {
                    expect.fail(`answer=${answer} guess=${guess}: got ${actual} expected ${reference(answer, guess)}`);
                }
            }
        }
    });

    it('marks the answer itself all green and a disjoint guess all gray', () => {
        expect(judgeGuess('1013', '1013')).toEqual(['green', 'green', 'green', 'green']);
        expect(judgeGuess('1111', '2222')).toEqual(['gray', 'gray', 'gray', 'gray']);
    });

    it('never gives a digit more non-gray marks than the answer contains', () => {
        for (const answer of strings('0123', 4)) {
            for (const guess of strings('0123', 4)) {
                const colors = judgeGuess(answer, guess);
                for (const digit of '0123') {
                    const marked = [...guess].filter((g, i) => g === digit && colors[i] !== 'gray').length;
                    const inAnswer = [...answer].filter((a) => a === digit).length;
                    const inGuess = [...guess].filter((g) => g === digit).length;
                    if (marked !== Math.min(inAnswer, inGuess)) {
                        expect.fail(`answer=${answer} guess=${guess} digit=${digit}: ${marked} marked`);
                    }
                }
            }
        }
    });
});

describe('primes against a sieve', () => {
    it('isPrimeNumber agrees with the sieve for every number below one million', () => {
        for (let value = 0; value <= 999_999; value += 1) {
            if (isPrimeNumber(value) !== SIEVE[value]) {
                expect.fail(`isPrimeNumber(${value}) should be ${SIEVE[value]}`);
            }
        }
    });

    it('isPrimeNumber rejects negatives, fractions and non-finite values', () => {
        for (const value of [-7, -2, -1, 0, 1, 2.5, 7.0000001, Number.NaN, Infinity, -Infinity]) {
            expect(isPrimeNumber(value), String(value)).toBe(false);
        }
        expect(isPrimeNumber(7.0)).toBe(true);
    });

    it('isPrimeString accepts plain prime digit strings only', () => {
        for (const accepted of ['2', '13', '1013', '999983']) {
            expect(isPrimeString(accepted), accepted).toBe(true);
        }
        for (const rejected of ['', '0', '1', '01', '013', '+13', ' 13', '13 ', '1.3', '1e1', '-13', '１３', '15']) {
            expect(isPrimeString(rejected), JSON.stringify(rejected)).toBe(false);
        }
    });

    it.each([1, 2, 3, 4, 5, 6])('generateNDigitPrimes(%i) lists exactly the primes with that many digits', (digits) => {
        const primes = generateNDigitPrimes(digits);

        expect(primes).toHaveLength(PRIME_COUNTS[digits]);
        expect(primes.every((p) => p.length === digits && SIEVE[Number(p)])).toBe(true);
        expect([...primes].sort((a, b) => Number(a) - Number(b))).toEqual(primes);
        expect(new Set(primes).size).toBe(primes.length);
    });

    it('generateNDigitPrimes returns nothing for fewer than one digit', () => {
        expect(generateNDigitPrimes(0)).toEqual([]);
        expect(generateNDigitPrimes(-3)).toEqual([]);
    });

    it('buildPrimeMap covers every supported digit count', () => {
        const map = buildPrimeMap();

        expect(Object.keys(map).map(Number)).toEqual([...SUPPORTED_DIGITS]);
        for (const digits of SUPPORTED_DIGITS) {
            expect(map[digits]).toHaveLength(PRIME_COUNTS[digits]);
        }
    });
});

describe('createRng and choosePrime', () => {
    it('createRng is deterministic per seed and stays within [0, 1)', () => {
        const a = createRng(42);
        const b = createRng(42);
        const c = createRng(43);
        const seqA = Array.from({ length: 200 }, () => a());

        expect(Array.from({ length: 200 }, () => b())).toEqual(seqA);
        expect(Array.from({ length: 200 }, () => c())).not.toEqual(seqA);
        expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
    });

    it('createRng without a seed still yields values in [0, 1)', () => {
        const rng = createRng();

        for (let i = 0; i < 50; i += 1) {
            const value = rng();
            expect(value >= 0 && value < 1).toBe(true);
        }
    });

    it('choosePrime picks by the rng position and never returns the excluded prime', () => {
        const candidates = ['11', '13', '17', '19'];

        for (const roll of [0, 0.24, 0.25, 0.49, 0.5, 0.74, 0.75, 0.999999]) {
            const plain = choosePrime(candidates, () => roll);
            expect(plain).toBe(candidates[Math.floor(roll * 4)]);

            for (const excluded of candidates) {
                const picked = choosePrime(candidates, () => roll, excluded);
                expect(candidates, `roll=${roll}`).toContain(picked);
                expect(picked, `roll=${roll} excluded=${excluded}`).not.toBe(excluded);
                if (excluded !== plain) {
                    expect(picked, `roll=${roll} excluded=${excluded}`).toBe(plain);
                }
            }
        }
    });

    it('choosePrime returns the only candidate even when it is excluded, and rejects an empty list', () => {
        expect(choosePrime(['13'], () => 0.5, '13')).toBe('13');
        expect(() => choosePrime([], () => 0.5)).toThrow();
    });
});

describe('validateGuess against a sieve', () => {
    const factorsOf = (message: string): number[] | null => {
        const match = / \((\d+) = ([\d x]+)\)$/.exec(message);

        return match ? match[2].split(' x ').map(Number) : null;
    };

    it.each([2, 3, 4])('accepts exactly the prime numbers of %i digits, without a leading zero', (digits) => {
        for (const guess of strings('0123456789', digits)) {
            const result = validateGuess(guess, digits);
            const expected = guess[0] !== '0' && SIEVE[Number(guess)];

            if (result.ok !== expected) {
                expect.fail(`validateGuess('${guess}', ${digits}) ok=${result.ok}, expected ${expected}`);
            }
        }
    });

    it.each([2, 3, 4])('explains every rejected composite of %i digits with its prime factorization', (digits) => {
        for (const guess of strings('0123456789', digits)) {
            const value = Number(guess);
            const result = validateGuess(guess, digits);
            if (result.ok || value < 4 || SIEVE[value]) {
                continue;
            }

            const factors = factorsOf(result.message ?? '');
            if (
                factors === null ||
                factors.length < 2 ||
                factors.reduce((a, b) => a * b, 1) !== value ||
                factors.some((f) => !SIEVE[f]) ||
                factors.join() !== [...factors].sort((a, b) => a - b).join()
            ) {
                expect.fail(`'${guess}': bad hint in "${result.message}"`);
            }
        }
    });

    it('rejects a leading-zero prime without a factorization hint, and shows the hint for a leading-zero composite', () => {
        // 0013 has the right length and its value is prime, but a leading zero is not a valid guess.
        expect(validateGuess('0013', 4)).toEqual({ ok: false, message: INVALID_PRIME_MESSAGE });
        expect(validateGuess('0007', 4)).toEqual({ ok: false, message: INVALID_PRIME_MESSAGE });
        expect(validateGuess('0015', 4).message).toBe(`${INVALID_PRIME_MESSAGE} (0015 = 3 x 5)`);
    });

    it('checks the length before anything else', () => {
        expect(validateGuess('', 3)).toEqual({ ok: false, message: INVALID_LENGTH_MESSAGE });
        expect(validateGuess('13', 3)).toEqual({ ok: false, message: INVALID_LENGTH_MESSAGE });
        expect(validateGuess('1313', 3)).toEqual({ ok: false, message: INVALID_LENGTH_MESSAGE });
        expect(validateGuess('abc', 3).message).toBe(INVALID_PRIME_MESSAGE);
    });
});

describe('validateHardMode', () => {
    const round = (answer: string, guesses: string[]): GuessHistory[] =>
        guesses.map((guess) => ({ guess, colors: judgeGuess(answer, guess) }));

    it('always allows the answer itself, whatever was guessed before', () => {
        // If the answer were rejected, a hard-mode round could never be won.
        for (const answer of strings('137', 4)) {
            for (const first of strings('137', 4)) {
                if (first === answer) {
                    continue;
                }
                for (const second of strings('137', 4)) {
                    const history = round(answer, [first, second]);
                    if (!validateHardMode(answer, history).ok) {
                        expect.fail(`answer=${answer} history=${first},${second} rejects the answer`);
                    }
                }
            }
        }
    });

    it('rejects a guess that changes a green position, whatever else it keeps', () => {
        for (const answer of strings('137', 3)) {
            for (const first of strings('137', 3)) {
                const history = round(answer, [first]);
                for (const next of strings('137', 3)) {
                    const keepsGreens = history[0].colors.every((c, i) => c !== 'green' || next[i] === first[i]);
                    const result = validateHardMode(next, history);
                    if (!keepsGreens && result.ok) {
                        expect.fail(`answer=${answer} first=${first} next=${next} should be rejected`);
                    }
                }
            }
        }
    });

    it('rejects a guess missing a yellow digit and accepts one that keeps every green and yellow', () => {
        // Answer 1013, guess 3111 -> 3 is yellow, the middle 1 is gray, the last 1 is yellow.
        const history = round('1013', ['3111']);

        expect(validateHardMode('1013', history)).toEqual({ ok: true });
        expect(validateHardMode('1019', history).ok).toBe(false);
    });

    it('checks every previous guess, not only the latest', () => {
        const history = round('1013', ['1009', '3111']);

        expect(validateHardMode('1013', history).ok).toBe(true);
        expect(validateHardMode('2013', history).ok).toBe(false);
    });
});

describe('game flow', () => {
    const smallMap: PrimeMap = {
        2: ['11', '13', '17', '19'],
        3: ['101', '103', '107'],
        4: ['1009', '1013'],
        5: ['10007'],
        6: ['100003']
    };

    it('exposes the documented attempt limits', () => {
        expect(ATTEMPT_LIMITS).toEqual({ 2: 3, 3: 4, 4: 5, 5: 6, 6: 7 });
    });

    it('createRound builds a fresh round and rejects unsupported or empty digit counts', () => {
        const game = createGame({ seed: 1, primeMap: smallMap });
        const created = game.createRound(3, 'hard');

        expect(created).toMatchObject({ n: 3, mode: 'hard', attemptLimit: 4, attemptsUsed: 0, status: 'playing', history: [] });
        expect(smallMap[3]).toContain(created.answer);
        expect(game.createRound(2).mode).toBe('normal');
        expect(() => game.createRound(7)).toThrow(/unsupported/);
        expect(() => createGame({ primeMap: { 2: [] } }).createRound(2)).toThrow(/missing/);
        expect(() => createGame({ primeMap: {} }).createRound(2)).toThrow(/missing/);
    });

    it('createRound avoids repeating the previous answer and eventually uses every candidate', () => {
        const game = createGame({ seed: 7, primeMap: smallMap });
        const seen = new Set<string>();
        let previous: string | undefined;

        for (let i = 0; i < 200; i += 1) {
            const answer = game.createRound(2, 'normal', previous).answer;
            expect(answer).not.toBe(previous);
            seen.add(answer);
            previous = answer;
        }

        expect([...seen].sort()).toEqual(smallMap[2]);
    });

    it('never mutates a round, and only accepted guesses consume attempts', () => {
        const guessPool = ['11', '13', '17', '19', '1', '123', 'ab', '15', '21', '00', '10'];

        for (let seed = 1; seed <= 300; seed += 1) {
            const rng = createRng(seed);
            const game = createGame({ seed, primeMap: smallMap });
            let round = game.createRound(2, seed % 2 === 0 ? 'hard' : 'normal');

            for (let turn = 0; turn < 8; turn += 1) {
                const guess = guessPool[Math.floor(rng() * guessPool.length)];
                const snapshot = structuredClone(round);
                const out = applyGuess(round, guess);
                const where = `seed=${seed} turn=${turn} guess=${guess}`;

                expect(round, `${where} mutated its input`).toEqual(snapshot);

                if (!out.accepted) {
                    expect(out.round, where).toBe(round);
                    expect(out.consumedAttempt, where).toBe(false);
                } else {
                    const colors = judgeGuess(round.answer, guess);
                    const won = guess === round.answer;
                    expect(round.status, `${where} accepted a guess on a finished round`).toBe('playing');
                    expect(out.colors, where).toEqual(colors);
                    expect(out.round.attemptsUsed, where).toBe(round.attemptsUsed + 1);
                    expect(out.round.history, where).toEqual([...round.history, { guess, colors }]);
                    expect(out.round.status, where).toBe(
                        won ? 'won' : out.round.attemptsUsed >= round.attemptLimit ? 'lost' : 'playing'
                    );
                    expect(out.round.attemptsUsed).toBeLessThanOrEqual(round.attemptLimit);
                }
                round = out.round;
            }
        }
    });

    it('wins on the answer, loses when the attempts run out, and rejects guesses afterwards', () => {
        const game = createGame({ seed: 3, primeMap: smallMap });

        const round = game.createRound(2);
        const won = applyGuess(round, round.answer);
        expect(won.round).toMatchObject({ status: 'won', attemptsUsed: 1 });
        expect(applyGuess(won.round, round.answer)).toMatchObject({ accepted: false, consumedAttempt: false });

        const wrong = smallMap[2].filter((prime) => prime !== round.answer);
        let lost = round;
        for (let i = 0; i < ATTEMPT_LIMITS[2]; i += 1) {
            expect(lost.status).toBe('playing');
            lost = applyGuess(lost, wrong[i % wrong.length]).round;
        }
        expect(lost).toMatchObject({ status: 'lost', attemptsUsed: ATTEMPT_LIMITS[2] });
        expect(applyGuess(lost, round.answer)).toMatchObject({ accepted: false, consumedAttempt: false });
    });

    it('a hard-mode round rejects a guess that drops a green digit without using an attempt', () => {
        const round = { ...createGame({ seed: 1, primeMap: smallMap }).createRound(3, 'hard'), answer: '101' };
        const first = applyGuess(round, '103');
        expect(first.round.history[0].colors).toEqual(['green', 'green', 'gray']);

        expect(applyGuess(first.round, '107').accepted).toBe(true);

        const dropsGreen = applyGuess(first.round, '137');
        expect(dropsGreen).toMatchObject({ accepted: false, consumedAttempt: false });
        expect(dropsGreen.message).toContain('ハードモード');
        expect(dropsGreen.round).toBe(first.round);
    });

    it('a normal-mode round allows the same guess that hard mode rejects', () => {
        const round = { ...createGame({ seed: 1, primeMap: smallMap }).createRound(3, 'normal'), answer: '101' };
        const first = applyGuess(round, '103');

        expect(applyGuess(first.round, '137').accepted).toBe(true);
    });

    it('buildPrimeMap-driven rounds always use a prime of the requested length', () => {
        const game = createGame({ seed: 11, primeMap: buildPrimeMap() });

        for (const digits of SUPPORTED_DIGITS) {
            const answer = game.createRound(digits).answer;
            expect(answer).toHaveLength(digits);
            expect(SIEVE[Number(answer)]).toBe(true);
        }
    });
});
