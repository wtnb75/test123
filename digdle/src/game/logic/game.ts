import { judgeGuess } from './judge';
import { buildPrimeMap, choosePrime, createRng, type PrimeMap } from './primes';
import { validateGuess } from './validate';
import type { DigitStatus, RoundState } from '../types';

export const ATTEMPT_LIMITS: Record<number, number> = {
    2: 5,
    3: 6,
    4: 7,
    5: 8
};

export interface CreateGameOptions {
    seed?: number;
    primeMap?: PrimeMap;
}

export interface GuessResult {
    round: RoundState;
    accepted: boolean;
    consumedAttempt: boolean;
    message?: string;
    colors?: DigitStatus[];
}

export interface GameApi {
    primeMap: PrimeMap;
    createRound: (digits: number, previousAnswer?: string) => RoundState;
}

export const createGame = (options: CreateGameOptions = {}): GameApi => {
    const primeMap = options.primeMap ?? buildPrimeMap();
    const rng = createRng(options.seed);

    return {
        primeMap,
        createRound: (digits: number, previousAnswer?: string): RoundState => {
            const attemptLimit = ATTEMPT_LIMITS[digits];
            const candidates = primeMap[digits];

            if (attemptLimit === undefined) {
                throw new Error(`unsupported digits: ${digits}`);
            }
            if (candidates === undefined || candidates.length === 0) {
                throw new Error(`missing prime candidates for digits: ${digits}`);
            }

            return {
                n: digits,
                attemptLimit,
                answer: choosePrime(candidates, rng, previousAnswer),
                attemptsUsed: 0,
                status: 'playing',
                history: []
            };
        }
    };
};

export const applyGuess = (round: RoundState, guess: string): GuessResult => {
    if (round.status !== 'playing') {
        return {
            round,
            accepted: false,
            consumedAttempt: false
        };
    }

    const validation = validateGuess(guess, round.n);
    if (!validation.ok) {
        return {
            round,
            accepted: false,
            consumedAttempt: false,
            message: validation.message
        };
    }

    const colors = judgeGuess(round.answer, guess);
    const attemptsUsed = round.attemptsUsed + 1;
    const won = colors.every((item) => item === 'green');
    const status = won ? 'won' : (attemptsUsed >= round.attemptLimit ? 'lost' : 'playing');

    return {
        round: {
            ...round,
            attemptsUsed,
            status,
            history: [...round.history, { guess, colors }]
        },
        accepted: true,
        consumedAttempt: true,
        colors
    };
};
