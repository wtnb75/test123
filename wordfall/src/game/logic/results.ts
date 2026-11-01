import { RESULT_ROW_H, RESULT_WHEEL_ROWS } from '../params';
import type { Word } from './words';

export interface ResultRow {
    en: string;
    ja: string;
    /** Completed at least once during the play. */
    done: boolean;
}

/**
 * The Result word list: words that appeared as targets, in order of first appearance, one row per word;
 * a row is done when the word was completed at least once.
 */
export function buildResultList(appeared: readonly Word[], completedWords: readonly string[]): ResultRow[] {
    const rows: ResultRow[] = [];
    const seen = new Set<string>();
    const done = new Set(completedWords);
    for (const w of appeared) {
        if (seen.has(w.en)) continue;
        seen.add(w.en);
        rows.push({ en: w.en, ja: w.ja, done: done.has(w.en) });
    }
    return rows;
}

/** Furthest the list can scroll: its content height beyond the visible region (0 when it fits). */
export const maxScroll = (contentHeight: number, viewHeight: number): number => Math.max(0, contentHeight - viewHeight);

/** Scroll offset kept within [0, maxScroll]. */
export const clampScroll = (offset: number, contentHeight: number, viewHeight: number): number =>
    Math.min(Math.max(offset, 0), maxScroll(contentHeight, viewHeight));

/**
 * Whether a drag started by pointer `dragId` is still going: that pointer exists and is still down. A touch
 * the system cancelled never sends a pointerup, so the drag would otherwise stay "held" and block new ones.
 */
export const isDragLive = (dragId: number, pointers: readonly { id: number; isDown: boolean }[]): boolean =>
    pointers.some((p) => p.id === dragId && p.isDown);

/**
 * Scroll distance for one wheel event: RESULT_WHEEL_ROWS rows in the wheel's direction, whatever `dy` a
 * browser reports (pixels in Chrome, lines in Firefox).
 */
export const wheelStep = (dy: number): number => Math.sign(dy) * RESULT_WHEEL_ROWS * RESULT_ROW_H;

/** Whether input is still ignored `elapsedMs` after Result started. */
export const resultInputBlocked = (elapsedMs: number, guardMs: number): boolean => elapsedMs < guardMs;
