// Scoring and the numbers behind the Result and pop-up effects (docs/spec.md "スコア", "演出・UI").
import {
    COUNT_UP_MS,
    MATCH_MIN,
    MOVES_WARN,
    POP_CHAIN_SCALE_MAX,
    POP_CHAIN_SCALE_STEP,
    POP_CLAMP_X,
    POP_CLAMP_Y,
    POP_RISE,
    SCREEN_WIDTH,
} from '../params';
import type { Best } from 'best-store';

/**
 * Points for one clear (one lap of a chain): every stone is worth `perGem`, every stone beyond the third adds
 * `bonusPerExtra`, and the total is multiplied by the chain step (1, 2, 3, ...).
 */
export function scoreFor(cleared: number, chain: number, perGem: number, bonusPerExtra: number): number {
    const bonus = Math.max(0, cleared - MATCH_MIN) * bonusPerExtra;
    return (cleared * perGem + bonus) * chain;
}

/** The pop-up's lines, top to bottom: `CHAIN xn` (chain 2+), `BONUS` (4+ stones), then `+gain`. */
export function popupLines(cleared: number, chain: number, gain: number): string[] {
    const lines: string[] = [];
    if (chain >= 2) lines.push(`CHAIN x${chain}`);
    if (cleared > MATCH_MIN) lines.push('BONUS');
    lines.push(`+${gain}`);
    return lines;
}

/** The pop-up's size factor: 1.0 up to chain 2, then POP_CHAIN_SCALE_STEP more per chain step, capped. */
export function popupScale(chain: number): number {
    return Math.min(POP_CHAIN_SCALE_MAX, 1 + POP_CHAIN_SCALE_STEP * Math.max(0, chain - 2));
}

/** MOVES turns red once the remaining moves reach MOVES_WARN. */
export const movesWarning = (moves: number): boolean => moves <= MOVES_WARN;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/**
 * Keeps a pop-up inside the board: x within the margins, and the start y low enough that the end of its rise
 * (POP_RISE higher) still stays below the board's top margin. The margins grow with the pop-up's size factor.
 */
export function clampPopup(
    x: number,
    y: number,
    boardTop: number,
    boardBottom: number,
    scale = 1,
): { x: number; y: number } {
    const marginX = POP_CLAMP_X * scale;
    const marginY = POP_CLAMP_Y * scale;
    return {
        x: clamp(x, marginX, SCREEN_WIDTH - marginX),
        y: clamp(y, boardTop + marginY + POP_RISE, boardBottom - marginY),
    };
}

/** The centre of a group of cells given by their centres (the mean of the coordinates). */
export function centerOf(points: { x: number; y: number }[]): { x: number; y: number } {
    const n = points.length;
    return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n };
}

/** The Result score shown `t` ms after the count-up started: linear from 0 to `score` over COUNT_UP_MS. */
export function countUpValue(t: number, score: number): number {
    if (score <= 0 || t <= 0) return 0;
    if (t >= COUNT_UP_MS) return score;
    return Math.round((score * t) / COUNT_UP_MS);
}

/** Whether a finished play sets a new best: no best yet needs a score of 1 or more; otherwise it must beat it. */
export function isNewBest(previous: number | null, score: number): boolean {
    if (score <= 0) return false;
    return previous === null || score > previous;
}

/** The label saved with a best, shown on the index page: e.g. `1230点`. */
export const bestLabel = (score: number): string => `${score}点`;

/** `BEST 1230`, or `BEST ---` when there is no record. */
export const formatBest = (best: Best | null): string => (best ? `BEST ${best.score}` : 'BEST ---');

/** The BEST on the Game HUD: the saved best or the current score, whichever is higher (`---` while both are 0). */
export function hudBest(saved: Best | null, score: number): string {
    const top = Math.max(saved?.score ?? 0, score);
    return saved === null && score <= 0 ? 'BEST ---' : `BEST ${top}`;
}
