import { LENGTH_WEIGHT, TARGET_COUNT } from '../params';
import { WORDS, type Rng, type Word } from './words';

/**
 * Draws one word not in `exclude`, weighted by `LENGTH_WEIGHT` of each candidate's length
 * (docs/spec.md "お題").
 */
export function pickWord(rng: Rng, exclude: readonly string[], words: readonly Word[] = WORDS): Word {
    const pool = words.filter((w) => !exclude.includes(w.en));
    const weights = pool.map((w) => LENGTH_WEIGHT[w.en.length] ?? 0);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r < 0) return pool[i];
    }
    return pool[pool.length - 1];
}

/** The first `TARGET_COUNT` targets of a play: distinct words. */
export function initialTargets(rng: Rng, words: readonly Word[] = WORDS): Word[] {
    const result: Word[] = [];
    while (result.length < TARGET_COUNT) {
        result.push(pickWord(rng, result.map((w) => w.en), words));
    }
    return result;
}
