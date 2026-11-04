export type DigitStatus = 'green' | 'yellow' | 'gray';

export type RoundStatus = 'playing' | 'won' | 'lost';

export type GameMode = 'normal' | 'hard';

/** What the Title's mode switch selects: a round mode, or the once-a-day challenge. */
export type TitleMode = GameMode | 'daily';

/** The digit counts a player can pick on the Title. */
export type DigitOption = 2 | 3 | 4 | 5 | 6;

export interface GuessHistory {
    guess: string;
    colors: DigitStatus[];
}

export interface RoundState {
    n: number;
    mode: GameMode;
    attemptLimit: number;
    answer: string;
    attemptsUsed: number;
    status: RoundStatus;
    history: GuessHistory[];
}

/** Why a guess was rejected. The notice text is built from this in `locale.ts`. */
export type ValidationReason =
    | { code: 'length' }
    /** `factorization` is e.g. "15 = 3 x 5"; absent when the input has no prime factors to show. */
    | { code: 'not-prime'; factorization?: string }
    | { code: 'hard-green' }
    | { code: 'hard-yellow' };

export interface ValidationResult {
    ok: boolean;
    reason?: ValidationReason;
}

/** Hands the selected mode and the candidate-count toggle back to the Title (so both stay as the player left them). */
export interface TitleData {
    mode?: TitleMode;
    candidates?: boolean;
}

/** What the Title hands to the Game when a digit count is picked. `candidates` is the 💡 toggle. */
export interface GameStartData {
    digits: DigitOption;
    mode: TitleMode;
    candidates: boolean;
}
