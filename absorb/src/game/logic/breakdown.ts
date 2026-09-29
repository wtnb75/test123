import { GAMEOVER_ROW_FADE, GAMEOVER_ROW_INTERVAL, type DefeatKind } from './constants';

/** The kinds the game-over breakdown lists, in display order. */
export type BreakdownKind = DefeatKind | 'boss';
export const BREAKDOWN_KINDS: readonly BreakdownKind[] = ['grunt', 'shooter', 'heavy', 'rammer', 'splitter', 'carrier', 'boss'];

/** Kills of one kind and their base points (before the multi-kill multiplier). */
export interface KindTally {
    count: number;
    points: number;
}

export type ScoreBreakdown = Record<BreakdownKind, KindTally>;

export function emptyBreakdown(): ScoreBreakdown {
    return {
        grunt: { count: 0, points: 0 },
        shooter: { count: 0, points: 0 },
        heavy: { count: 0, points: 0 },
        rammer: { count: 0, points: 0 },
        splitter: { count: 0, points: 0 },
        carrier: { count: 0, points: 0 },
        boss: { count: 0, points: 0 }
    };
}

/** Counts one kill worth `points` base points. */
export function tallyKill(breakdown: ScoreBreakdown, kind: BreakdownKind, points: number): void {
    breakdown[kind].count++;
    breakdown[kind].points += points;
}

/** Whether a kind with this many kills counts as defeated this run (and so is shown). False for NaN too. */
function defeated(count: number): boolean {
    return count >= 1;
}

/**
 * Whatever the game-over scene received, as a complete breakdown: missing kinds count as 0 kills, 0 points,
 * and a kind without kills has no points either (it is not shown, so it must not hide part of the bonus).
 */
export function normalizeBreakdown(data?: Partial<Record<BreakdownKind, Partial<KindTally>>>): ScoreBreakdown {
    const b = emptyBreakdown();
    for (const kind of BREAKDOWN_KINDS) {
        const count = data?.[kind]?.count ?? 0;
        if (!defeated(count)) continue;
        b[kind].count = count;
        b[kind].points = data?.[kind]?.points ?? 0;
    }
    return b;
}

/** The multi-kill bonus: whatever the final score holds beyond the kinds' base points. */
export function multiKillBonus(score: number, breakdown: ScoreBreakdown): number {
    let base = 0;
    for (const kind of BREAKDOWN_KINDS) base += breakdown[kind].points;
    return score - base;
}

/** One kind's row, in parts the scene can lay out in columns: "GRUNT", "×12", "1200". */
export interface KindRow {
    kind: BreakdownKind;
    name: string;
    count: string;
    points: string;
}

/**
 * The rows for the kinds defeated at least once this run, in display order; kinds not defeated are left out
 * so the screen never names an enemy the player hasn't met.
 */
export function kindRows(breakdown: ScoreBreakdown): KindRow[] {
    return BREAKDOWN_KINDS.filter((kind) => defeated(breakdown[kind].count)).map((kind) => ({
        kind,
        name: kind.toUpperCase(),
        count: `×${breakdown[kind].count}`,
        points: `${breakdown[kind].points}`
    }));
}

/** Shown in place of the kind rows when nothing was defeated. */
export const NO_KILLS_LABEL = 'NO KILLS';

export const BONUS_LABEL = 'MULTI-KILL BONUS';

export function bonusValue(bonus: number): string {
    return `+${bonus}`;
}

/** One line of the table above the total, top to bottom. */
export type TableLine =
    | { type: 'kind'; row: KindRow }
    | { type: 'noKills' }
    | { type: 'bonus'; value: string };

/**
 * The table's lines in order: the defeated kinds (or NO KILLS), then the bonus. Line k fades in at
 * k × GAMEOVER_ROW_INTERVAL, and the total follows as line `tableLines(...).length`.
 */
export function tableLines(score: number, breakdown: ScoreBreakdown): TableLine[] {
    const rows = kindRows(breakdown);
    const lines: TableLine[] = rows.length > 0 ? rows.map((row) => ({ type: 'kind', row })) : [{ type: 'noKills' }];
    lines.push({ type: 'bonus', value: bonusValue(multiKillBonus(score, breakdown)) });
    return lines;
}

export function totalLabel(score: number): string {
    return `SCORE ${score}`;
}

const FADE_EPSILON = 1e-9;

/** Most staggered lines there can be: all seven kinds, the bonus, then the total. */
export const BREAKDOWN_LINES = BREAKDOWN_KINDS.length + 2;

/** Seconds into the game-over screen by which every line has fully faded in when all seven kinds are shown. */
export const BREAKDOWN_SHOWN_AT = (BREAKDOWN_LINES - 1) * GAMEOVER_ROW_INTERVAL + GAMEOVER_ROW_FADE;

/**
 * Opacity of staggered line `index` (0-based; the total is the last) `t` seconds into the game-over
 * screen: 0 until its turn, fading in over GAMEOVER_ROW_FADE, then staying at 1.
 */
export function lineAlpha(t: number, index: number): number {
    const since = t - index * GAMEOVER_ROW_INTERVAL;
    if (since <= 0) return 0;
    // Snap to fully shown at the end of the fade, so float drift can't leave a line at 0.9999.
    if (since >= GAMEOVER_ROW_FADE - FADE_EPSILON) return 1;
    return since / GAMEOVER_ROW_FADE;
}
