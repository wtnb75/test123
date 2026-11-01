// Pure game rules (no Phaser). Randomness is injected as `rng: () => number` in [0, 1).
import {
    BONUS_SEC_PER_LETTER,
    FALL_SPEED_MAX,
    FALL_SPEED_RAMP,
    FALL_SPEED_START,
    LENGTH_WEIGHT,
    NEEDED_RATIO,
    SCORE_BY_LENGTH,
    TARGET_COUNT,
} from './params';
import { WORDS, type Word } from './words';

export type Rng = () => number;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function counts(letters: string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const c of letters) m.set(c, (m.get(c) ?? 0) + 1);
    return m;
}

/** Pick a word not in `exclude`, weighted by length. */
export function pickWord(rng: Rng, exclude: string[], words: Word[] = WORDS): Word {
    const pool = words.filter((w) => !exclude.includes(w.en));
    const weights = pool.map((w) => LENGTH_WEIGHT[w.en.length] ?? 1);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r < 0) return pool[i];
    }
    return pool[pool.length - 1];
}

export function initialTargets(rng: Rng): Word[] {
    const result: Word[] = [];
    while (result.length < TARGET_COUNT) {
        result.push(pickWord(rng, result.map((w) => w.en)));
    }
    return result;
}

/** True when the tray holds every letter of the word (with multiplicity). */
export function canComplete(tray: string[], word: string): boolean {
    const have = counts(tray);
    for (const [c, n] of counts([...word])) {
        if ((have.get(c) ?? 0) < n) return false;
    }
    return true;
}

/** Index of the first target (display order) that the tray completes, or -1. */
export function findCompletable(tray: string[], targets: Word[]): number {
    return targets.findIndex((t) => canComplete(tray, t.en));
}

/** Tray without the letters of `word` (one copy each). */
export function consume(tray: string[], word: string): string[] {
    const rest = [...tray];
    for (const c of word) {
        const i = rest.indexOf(c);
        if (i >= 0) rest.splice(i, 1);
    }
    return rest;
}

/** For display: which letters of `word` the tray already covers (per word, independent of other targets). */
export function matchedMask(tray: string[], word: string): boolean[] {
    const left = counts(tray);
    return [...word].map((c) => {
        const n = left.get(c) ?? 0;
        if (n > 0) {
            left.set(c, n - 1);
            return true;
        }
        return false;
    });
}

export const scoreFor = (len: number): number => SCORE_BY_LENGTH[len] ?? 0;
export const bonusFor = (len: number): number => len * BONUS_SEC_PER_LETTER;

export function fallSpeed(elapsedSec: number): number {
    return Math.min(FALL_SPEED_MAX, FALL_SPEED_START + FALL_SPEED_RAMP * elapsedSec);
}

/** Letters some target still needs, given what the tray already holds. */
export function neededLetters(tray: string[], targets: Word[]): string[] {
    const need: string[] = [];
    for (const t of targets) {
        const mask = matchedMask(tray, t.en);
        [...t.en].forEach((c, i) => {
            if (!mask[i]) need.push(c);
        });
    }
    return need;
}

/** Next falling letter: a still-needed one with NEEDED_RATIO, otherwise a random decoy. */
export function pickLetter(rng: Rng, tray: string[], targets: Word[]): string {
    const need = neededLetters(tray, targets);
    if (need.length > 0 && rng() < NEEDED_RATIO) {
        return need[Math.floor(rng() * need.length)];
    }
    return ALPHABET[Math.floor(rng() * ALPHABET.length)];
}
