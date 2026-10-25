import type { DigitStatus } from '../types';

const SQUARES: Record<DigitStatus, string> = { green: '🟩', yellow: '🟨', gray: '⬛' };

export interface ShareRound {
    n: number;
    attemptsUsed: number;
    attemptLimit: number;
    history: ReadonlyArray<{ colors: readonly DigitStatus[] }>;
}

/**
 * The shared result: a header with the digit count and the attempts used, then one row of squares per attempt.
 * It has no words and never contains the answer (spec: docs/spec.md, 「コピー」).
 */
export const shareText = (round: ShareRound): string => {
    const header = `digdle ${round.n} ${round.attemptsUsed}/${round.attemptLimit}`;
    const rows = round.history.map((entry) => entry.colors.map((color) => SQUARES[color]).join(''));
    return [header, ...rows].join('\n');
};

/** Writes `text` to the clipboard. `false` when the clipboard is missing, blocked or refuses the write. */
export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
        if (!clipboard) {
            return false;
        }
        await clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
};
