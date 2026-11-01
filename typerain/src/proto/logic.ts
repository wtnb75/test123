import { PARAMS } from './params';
import { WORDS } from './words';

export interface Word {
    id: number;
    text: string;
    x: number;
    y: number;
    typed: number;
}

export interface TypeResult {
    targetId: number | null;
    hit: boolean;
    miss: boolean;
    cleared: Word | null;
}

export type Rng = () => number;

export function speedAt(elapsedSec: number): number {
    return Math.min(PARAMS.speedCap, PARAMS.speedStart + PARAMS.speedPerSec * elapsedSec);
}

export function spawnIntervalAt(elapsedSec: number): number {
    return Math.max(PARAMS.spawnMinSec, PARAMS.spawnStartSec - PARAMS.spawnDecayPerSec * elapsedSec);
}

export function maxLenAt(elapsedSec: number): number {
    const grown = PARAMS.maxLenStart + Math.floor(elapsedSec / PARAMS.maxLenEverySec);
    return Math.min(PARAMS.maxLenCap, grown);
}

/** Picks a word, avoiding duplicates and (when possible) shared first letters on screen. */
export function pickWordText(rng: Rng, elapsedSec: number, onScreen: readonly Word[]): string {
    const len = PARAMS.minLen + Math.floor(rng() * (maxLenAt(elapsedSec) - PARAMS.minLen + 1));
    const usedTexts = new Set(onScreen.map((w) => w.text));
    const usedFirst = new Set(onScreen.map((w) => w.text[0]));
    const byLen = WORDS.filter((w) => w.length === len && !usedTexts.has(w));
    const strict = byLen.filter((w) => !usedFirst.has(w[0]));
    const pool = strict.length > 0 ? strict : byLen.length > 0 ? byLen : WORDS.filter((w) => !usedTexts.has(w));
    return pool[Math.floor(rng() * pool.length)];
}

export function spawnWord(rng: Rng, elapsedSec: number, onScreen: readonly Word[], id: number): Word {
    const text = pickWordText(rng, elapsedSec, onScreen);
    const span = PARAMS.width - PARAMS.margin * 2 - text.length * PARAMS.charWidth;
    return { id, text, x: PARAMS.margin + rng() * Math.max(0, span), y: 0, typed: 0 };
}

export function scoreFor(len: number, combo: number): number {
    const mult = Math.min(PARAMS.comboMultCap, 1 + combo * PARAMS.comboStep);
    return Math.round(len * PARAMS.scorePerChar * mult);
}

/** Applies one typed character. Mutates `typed` of the target word. */
export function applyChar(words: Word[], targetId: number | null, ch: string): TypeResult {
    let target = targetId === null ? undefined : words.find((w) => w.id === targetId);
    if (!target) {
        // Lock on to the lowest word that starts with this letter.
        const cands = words.filter((w) => w.text[0] === ch);
        target = cands.sort((a, b) => b.y - a.y)[0];
        if (!target) return { targetId: null, hit: false, miss: true, cleared: null };
    }
    if (target.text[target.typed] !== ch) {
        return { targetId: target.id, hit: false, miss: true, cleared: null };
    }
    target.typed += 1;
    if (target.typed >= target.text.length) {
        return { targetId: null, hit: true, miss: false, cleared: target };
    }
    return { targetId: target.id, hit: true, miss: false, cleared: null };
}
