export type DigitStatus = 'green' | 'yellow' | 'gray';

export type RoundStatus = 'playing' | 'won' | 'lost';

export interface GuessHistory {
    guess: string;
    colors: DigitStatus[];
}

export interface RoundState {
    n: number;
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
