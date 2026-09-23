import { BACKGROUND_COLOR } from './constants';

/**
 * Average absolute per-channel RGB difference (0-255) between two same-size
 * RGBA pixel buffers (e.g. from CanvasRenderingContext2D#getImageData).
 * Alpha is ignored per docs/spec.md.
 *
 * A pixel that's the background color on *both* sides is excluded from the
 * average — otherwise the (large) shared background dilutes the score,
 * rewarding "nothing drawn" almost as highly as a correct placement.
 */
export function averageChannelDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
    if (a.length !== b.length) {
        throw new Error('averageChannelDiff: buffers must be the same length');
    }
    const [bgR, bgG, bgB] = BACKGROUND_COLOR;
    let sum = 0;
    let channelCount = 0;
    for (let i = 0; i + 2 < a.length; i += 4) {
        const aIsBackground = a[i] === bgR && a[i + 1] === bgG && a[i + 2] === bgB;
        const bIsBackground = b[i] === bgR && b[i + 1] === bgG && b[i + 2] === bgB;
        if (aIsBackground && bIsBackground) continue;
        sum += Math.abs(a[i] - b[i]);
        sum += Math.abs(a[i + 1] - b[i + 1]);
        sum += Math.abs(a[i + 2] - b[i + 2]);
        channelCount += 3;
    }
    return channelCount === 0 ? 0 : sum / channelCount;
}

/**
 * Converts an average diff into a 0-100 score, scaled against `baselineDiff`
 * — the average diff you'd get by placing nothing at all (see docs/spec.md
 * ルール: "何もしない = 0点" 基準の按分). `averageDiff` 0 (perfect match) is
 * always 100; `averageDiff` at or above `baselineDiff` (as bad as, or worse
 * than, placing nothing) is always 0. `baselineDiff` is computed by the
 * caller per-question (it depends on that question's colors/geometry), not
 * hardcoded here.
 */
export function scoreFromAverageDiff(averageDiff: number, baselineDiff: number): number {
    if (baselineDiff <= 0) {
        return averageDiff <= 0 ? 100 : 0;
    }
    const ratio = Math.max(0, Math.min(1, averageDiff / baselineDiff));
    return Math.round(100 * (1 - ratio));
}
