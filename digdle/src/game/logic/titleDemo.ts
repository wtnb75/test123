import type { DemoGame, DemoOptions } from 'title-demo';
import type { DigitStatus } from '../types';
import { ATTEMPT_LIMITS } from './game';
import { judgeGuess } from './judge';
import { choosePrime, generateNDigitPrimes } from './primes';

/** The digit count of the primes the demo bot guesses. */
export const DEMO_DIGITS = 4;
/** Rounds (one prime each) in one run, before the demo fades and starts again. */
export const DEMO_ROUNDS = 2;
/** From one guess to the next (or `advance` / `fade-out`); the typing and the colours fit inside. */
export const DEMO_WAIT_MS = 1800;
export const DEMO_FADE_MS = 400;
/** The margin between the demo and the screen bottom (stacked), or above and below it (two columns). */
export const DEMO_MARGIN = 16;
export const DEMO_CELL_MAX = 44;
/** Below this cell size the demo is not drawn. */
export const DEMO_CELL_MIN = 28;
export const DEMO_CELL_GAP = 6;
/** The gap before each typed digit is random in this range (ms). */
export const DEMO_DIGIT_MIN_MS = 150;
export const DEMO_DIGIT_MAX_MS = 400;
/** From the last digit being typed to the colours appearing (ms). */
export const DEMO_JUDGE_MS = 300;

export const DEMO_ATTEMPTS: number = ATTEMPT_LIMITS[DEMO_DIGITS];

export const DEMO_OPTIONS: DemoOptions = {
    rounds: DEMO_ROUNDS,
    timing: { stepMs: DEMO_WAIT_MS, waitMs: DEMO_WAIT_MS, fadeMs: DEMO_FADE_MS }
};

export interface DemoRow {
    guess: string;
    colors: DigitStatus[];
    /** When each digit appears, in ms from the guess (the first is 0). */
    typeAt: number[];
    /** When the colours appear, in ms from the guess. */
    judgeAt: number;
}

export type DemoResult = 'playing' | 'won' | 'lost';

export interface DemoState {
    answer: string;
    rows: DemoRow[];
    /** The primes that agree with every guess so far (and the colours they got). */
    candidates: string[];
    result: DemoResult;
}

export interface DemoDetail {
    row: number;
}

export interface DemoGameOptions {
    rng: () => number;
    /** All primes of `DEMO_DIGITS` digits (generated when omitted). */
    primes?: string[];
}

const sameColors = (a: DigitStatus[], b: DigitStatus[]): boolean => a.every((color, index) => color === b[index]);

/** The random gaps between typed digits, and the moments the digits and the colours appear. */
export const createTypeSchedule = (rng: () => number, digits: number): { typeAt: number[]; judgeAt: number } => {
    const typeAt = [0];

    for (let index = 1; index < digits; index += 1) {
        const gap = DEMO_DIGIT_MIN_MS + Math.floor(rng() * (DEMO_DIGIT_MAX_MS - DEMO_DIGIT_MIN_MS + 1));
        typeAt.push(typeAt[index - 1] + gap);
    }

    return { typeAt, judgeAt: typeAt[digits - 1] + DEMO_JUDGE_MS };
};

type Timed = Pick<DemoRow, 'typeAt' | 'judgeAt'>;

/** How many digits of a row are typed `elapsed` ms after its guess (no allocation: it runs every frame). */
export const typedDigits = (row: Timed, elapsed: number): number => {
    let count = 0;

    while (count < row.typeAt.length && elapsed >= row.typeAt[count]) {
        count += 1;
    }

    return count;
};

/** Whether a row shows its colours `elapsed` ms after its guess. */
export const isJudged = (row: Timed, elapsed: number): boolean => elapsed >= row.judgeAt;


/** The game the `DemoDirector` plays: a bot guessing a prime, one guess per action. */
export const createDemoGame = ({ rng, primes = generateNDigitPrimes(DEMO_DIGITS) }: DemoGameOptions): DemoGame<DemoState, string, DemoDetail> => ({
    start: (): DemoState => ({
        answer: choosePrime(primes, rng),
        rows: [],
        candidates: primes.slice(),
        result: 'playing'
    }),

    plan: (state: DemoState): string[] | null => (state.result === 'playing' ? [choosePrime(state.candidates, rng)] : null),

    play: (state: DemoState, guess: string) => {
        if (state.result !== 'playing') {
            return { moved: false, roundDone: false, detail: { row: state.rows.length } };
        }

        const colors = judgeGuess(state.answer, guess);
        const row: DemoRow = { guess, colors, ...createTypeSchedule(rng, guess.length) };

        state.rows.push(row);
        state.candidates = state.candidates.filter((candidate) => sameColors(judgeGuess(candidate, guess), colors));

        if (colors.every((color) => color === 'green')) {
            state.result = 'won';
        } else if (state.rows.length >= DEMO_ATTEMPTS) {
            state.result = 'lost';
        }

        return { moved: true, roundDone: state.result !== 'playing', detail: { row: state.rows.length - 1 } };
    },

    advance: (state: DemoState): void => {
        state.answer = choosePrime(primes, rng, state.answer);
        state.rows = [];
        state.candidates = primes.slice();
        state.result = 'playing';
    }
});
