import { LETTER_HIT_SIZE } from '../params';

export interface FallingLetter {
    /** The letter, or a panel's whole text. */
    ch: string;
    /** Centre. */
    x: number;
    y: number;
}

/** Tap area width: LETTER_HIT_SIZE per letter (a panel is that wide for each of its letters). */
const hitWidth = (l: FallingLetter, hit: number): number => hit * Math.max(1, l.ch.length);

/**
 * The letter a tap at (px, py) picks: among letters whose tap area (LETTER_HIT_SIZE high, and wide per letter
 * of a panel) contains the point, the one whose centre is nearest; at equal distance, the lower one (larger y).
 */
export function letterAtPoint<T extends FallingLetter>(
    letters: readonly T[],
    px: number,
    py: number,
    hit = LETTER_HIT_SIZE,
): T | undefined {
    const half = hit / 2;
    let best: T | undefined;
    let bestDist = Infinity;
    for (const l of letters) {
        if (Math.abs(px - l.x) > hitWidth(l, hit) / 2 || Math.abs(py - l.y) > half) continue;
        const d = Math.hypot(px - l.x, py - l.y);
        if (d < bestDist || (d === bestDist && best !== undefined && l.y > best.y)) {
            best = l;
            bestDist = d;
        }
    }
    return best;
}

/** The letter a key press picks: of the falling letters showing `ch`, the lowest (largest y). */
export function lowestLetterWithChar<T extends FallingLetter>(letters: readonly T[], ch: string): T | undefined {
    let best: T | undefined;
    for (const l of letters) {
        if (l.ch === ch && (best === undefined || l.y > best.y)) best = l;
    }
    return best;
}
