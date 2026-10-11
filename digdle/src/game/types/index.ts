export type DigitStatus = 'green' | 'yellow' | 'gray';

export type RoundStatus = 'playing' | 'won' | 'lost';

export type GameMode = 'normal' | 'hard';

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

export interface ValidationResult {
    ok: boolean;
    message?: string;
}

/** Hands the selected mode back to the Title (so it stays highlighted). */
export interface TitleData {
    mode?: GameMode;
}

/** What the Title hands to the Game when a digit count is picked. */
export interface GameStartData {
    digits: DigitOption;
    mode: GameMode;
}
