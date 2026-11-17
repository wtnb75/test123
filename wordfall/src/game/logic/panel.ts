// Letter panels: what falls next and where (docs/spec/letter-panel.md "出現"). Pure: the Scene draws it.
import { COLUMNS, PANEL_LEN3_RATIO, PANEL_MAX_LEN, PANEL_MIN_LEN, PANEL_RATIO } from '../params';
import { freeColumns, pickColumn, pickLetter, type ColumnLetter } from './letters';
import type { Rng, Word } from './words';

/** Uniform index in [0, n) from one draw. */
const pickIndex = (rng: Rng, n: number): number => Math.min(n - 1, Math.floor(rng() * n));

/** The text of a new panel: a run of 2-3 letters from one of the words on screen (each word and start equally likely). */
export function pickPanelText(rng: Rng, targets: readonly Word[]): string {
    const wanted = rng() < PANEL_LEN3_RATIO ? PANEL_MAX_LEN : PANEL_MIN_LEN;
    const word = targets[pickIndex(rng, targets.length)].en;
    const k = Math.min(wanted, word.length);
    const start = pickIndex(rng, word.length - k + 1);
    return word.slice(start, start + k);
}

/**
 * The left column of a panel `k` wide, from the starts whose `k` columns are all free; -1 when no start
 * fits (a free column list can be too scattered for a wide panel).
 */
export function pickPanelColumn(rng: Rng, free: readonly number[], k: number, columns = COLUMNS): number {
    const open = new Set(free);
    const starts: number[] = [];
    for (let c = 0; c + k <= columns; c++) {
        if (Array.from({ length: k }, (_, i) => c + i).every((col) => open.has(col))) starts.push(c);
    }
    return starts.length === 0 ? -1 : starts[pickIndex(rng, starts.length)];
}

export interface SpawnPlan {
    /** One letter, or the panel's whole text. */
    text: string;
    /** Left column. */
    col: number;
}

/**
 * What appears at a spawn beat: a panel with probability `panelRatio` (when it has room), otherwise a single
 * letter by the usual rule. null when no column is free for a single letter either.
 */
export function planSpawn(
    rng: Rng,
    tray: readonly string[],
    targets: readonly Word[],
    falling: readonly ColumnLetter[],
    spawnY: number,
    panelRatio = PANEL_RATIO,
): SpawnPlan | null {
    const free = freeColumns(falling, spawnY);
    if (rng() < panelRatio) {
        const text = pickPanelText(rng, targets);
        const col = pickPanelColumn(rng, free, text.length);
        if (col >= 0) return { text, col };
    }
    const col = pickColumn(rng, free);
    return col < 0 ? null : { text: pickLetter(rng, tray, targets), col };
}
