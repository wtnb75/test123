import { TRAY_CAPACITY } from '../params';
import { pickWord } from './targets';
import type { Rng, Word } from './words';

function counts(letters: Iterable<string>): Map<string, number> {
    const m = new Map<string, number>();
    for (const c of letters) m.set(c, (m.get(c) ?? 0) + 1);
    return m;
}

/**
 * A tray element is a single letter (length 1) or a panel (2-3 letters kept in order;
 * docs/spec/letter-panel.md).
 */
export const isPanel = (item: string): boolean => item.length > 1;

export interface Cover {
    /** Per letter of the word: covered by a panel or a single letter. */
    covered: boolean[];
    /** Per letter of the word: covered by a panel. */
    byPanel: boolean[];
    /** Indices (into the tray) of the panels that sit in the word. */
    panels: number[];
}

/**
 * How the tray covers `word` (docs/spec/letter-panel.md "覆い"): panels first, front to back, each at the
 * leftmost place in the word where its letters appear in a row and no earlier panel sits; then the single
 * letters cover what is left, as many of each letter as the tray holds, from the word's start.
 */
export function coverOf(tray: readonly string[], word: string): Cover {
    const byPanel = [...word].map(() => false);
    const panels: number[] = [];
    tray.forEach((item, idx) => {
        if (!isPanel(item)) return;
        for (let start = word.indexOf(item); start >= 0; start = word.indexOf(item, start + 1)) {
            if (byPanel.slice(start, start + item.length).some(Boolean)) continue;
            byPanel.fill(true, start, start + item.length);
            panels.push(idx);
            return;
        }
    });
    const left = counts(tray.filter((item) => !isPanel(item)));
    const covered = [...word].map((c, i) => {
        if (byPanel[i]) return true;
        const n = left.get(c) ?? 0;
        if (n <= 0) return false;
        left.set(c, n - 1);
        return true;
    });
    return { covered, byPanel, panels };
}

/** True when the tray covers every letter of the word (a plain tray: holds every letter, repeats counted). */
export function canComplete(tray: readonly string[], word: string): boolean {
    return coverOf(tray, word).covered.every(Boolean);
}

/** Index of the first target (top row first) the tray completes, or -1. */
export function findCompletable(tray: readonly string[], targets: readonly Word[]): number {
    return targets.findIndex((t) => canComplete(tray, t.en));
}

/**
 * The tray after `word` completes (docs/spec.md "完成", docs/spec/letter-panel.md "取り除く"): the panels
 * sitting in the word go whole; of the single letters, those the word still needs are taken out, except the
 * copies the `others` (the other words on screen) still need. For a letter with `a` copies in the part of
 * `word` no panel covers, `t` single copies in the tray and at most `m` in any one of `others`,
 * `max(t - a, min(t, m))` copies stay. Copies nearest the front go first; the rest (including panels that
 * are no part of the word) keep their order.
 */
export function consume(tray: readonly string[], word: string, others: readonly string[] = []): string[] {
    const cover = coverOf(tray, word);
    const used = new Set(cover.panels);
    // The panels in the word go whole; the rest of the word is the letters no panel covers.
    const rest = tray.filter((_, i) => !used.has(i));
    const have = counts(rest.filter((item) => !isPanel(item)));
    const otherCounts = others.map(counts);
    const uncovered = [...word].filter((_, i) => !cover.byPanel[i]);
    for (const [c, a] of counts(uncovered)) {
        const t = have.get(c) ?? 0;
        const m = Math.max(0, ...otherCounts.map((o) => o.get(c) ?? 0));
        let toRemove = t - Math.max(t - a, Math.min(t, m));
        for (let i = 0; i < rest.length && toRemove > 0; ) {
            if (rest[i] === c) {
                rest.splice(i, 1);
                toRemove -= 1;
            } else {
                i += 1;
            }
        }
    }
    return rest;
}

/**
 * Per letter of `word`: whether the tray covers it (green) or not (grey). Counted for this word alone,
 * never against the other targets.
 */
export function matchedMask(tray: readonly string[], word: string): boolean[] {
    return coverOf(tray, word).covered;
}

/** The tray with `ch` at its end, or null when it is full. */
export function addLetter(tray: readonly string[], ch: string, capacity = TRAY_CAPACITY): string[] | null {
    return tray.length >= capacity ? null : [...tray, ch];
}

/** The tray without the letter at `index` (later letters move forward); unchanged for a bad index. */
export function removeAt(tray: readonly string[], index: number): string[] {
    if (index < 0 || index >= tray.length) return [...tray];
    return [...tray.slice(0, index), ...tray.slice(index + 1)];
}

export interface Resolution {
    tray: string[];
    targets: Word[];
    /** Words completed, in the order they were completed. */
    completed: Word[];
    /** The row (0 = top) each completed word was in, in the same order. */
    rows: number[];
    /** Words drawn to replace them, in order (one per completion; a drawn word may be completed at once). */
    drawn: Word[];
}

/**
 * Completes targets for as long as the tray allows (docs/spec.md "完成"): the first completable target (top
 * row first) is consumed and replaced by a new draw that excludes all three words on screen, including the
 * completed one; the new target may itself already be complete.
 */
export function resolveCompletions(tray: readonly string[], targets: readonly Word[], rng: Rng): Resolution {
    let rest = [...tray];
    const next = [...targets];
    const completed: Word[] = [];
    const rows: number[] = [];
    const drawn: Word[] = [];
    for (;;) {
        const i = findCompletable(rest, next);
        if (i < 0) return { tray: rest, targets: next, completed, rows, drawn };
        const word = next[i];
        completed.push(word);
        rows.push(i);
        rest = consume(rest, word.en, next.filter((_, j) => j !== i).map((t) => t.en));
        const replacement = pickWord(rng, next.map((t) => t.en));
        drawn.push(replacement);
        next[i] = replacement;
    }
}
