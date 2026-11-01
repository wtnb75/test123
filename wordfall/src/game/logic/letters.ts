import { COLUMNS, LETTER_SIZE, NEEDED_RATIO } from '../params';
import { matchedMask } from './tray';
import type { Rng, Word } from './words';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Letters some target still needs: for each target, the letters the tray doesn't cover (the grey ones),
 * pooled as a multiset (the same letter wanted by two targets appears twice).
 */
export function neededLetters(tray: readonly string[], targets: readonly Word[]): string[] {
    const need: string[] = [];
    for (const t of targets) {
        const mask = matchedMask(tray, t.en);
        [...t.en].forEach((c, i) => {
            if (!mask[i]) need.push(c);
        });
    }
    return need;
}

/** Next falling letter: a still-needed one with probability NEEDED_RATIO, otherwise a uniform A-Z decoy. */
export function pickLetter(rng: Rng, tray: readonly string[], targets: readonly Word[]): string {
    const need = neededLetters(tray, targets);
    if (need.length > 0 && rng() < NEEDED_RATIO) {
        return need[Math.floor(rng() * need.length)];
    }
    return ALPHABET[Math.floor(rng() * ALPHABET.length)];
}

export interface ColumnLetter {
    col: number;
    /** Centre y of the falling letter. */
    y: number;
}

/**
 * Columns a new letter may appear in: those whose newest letter has fallen at least LETTER_SIZE from the
 * spawn line (`spawnY`, a centre y).
 */
export function freeColumns(letters: readonly ColumnLetter[], spawnY: number, columns = COLUMNS): number[] {
    const free: number[] = [];
    for (let c = 0; c < columns; c++) {
        const blocked = letters.some((l) => l.col === c && l.y - spawnY < LETTER_SIZE);
        if (!blocked) free.push(c);
    }
    return free;
}

/** Uniform pick from the free columns; -1 when none is free. */
export function pickColumn(rng: Rng, free: readonly number[]): number {
    if (free.length === 0) return -1;
    return free[Math.min(free.length - 1, Math.floor(rng() * free.length))];
}
