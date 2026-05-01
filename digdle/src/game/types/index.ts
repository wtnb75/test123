export type DigitStatus = 'green' | 'yellow' | 'gray';

export type RoundStatus = 'playing' | 'won' | 'lost';

export type GameMode = 'normal' | 'hard';

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
