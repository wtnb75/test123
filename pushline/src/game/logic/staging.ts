// When the effects of one line clear start, counted from the push that cleared it
// (docs/spec/effects.md "一列が消えたときの演出の順序"). Phaser-free: the view feeds these into its tweens.
import { PARAMS } from '../params';
import type { MoveResult, Pt } from './types';

/** The cleared line glows, then shrinks; thinning, spawning and relocating start once it is gone. */
export const NEXT_EFFECT_MS = PARAMS.glowMs + PARAMS.clearMs;

/** When the last effect of a clear (the thinned blocks fading away) is over. */
export const STAGING_END_MS = NEXT_EFFECT_MS + PARAMS.pruneBlinkMs * 4 + PARAMS.pruneFadeMs;

const key = (p: Pt): string => `${p.x},${p.y}`;

/** When the block that appears at `cell` starts to grow: a relocated fixed block lags behind its old cell's shrink. */
export function spawnDelayMs(res: Pick<MoveResult, 'relocated'>, cell: Pt): number {
    const moved = res.relocated.some((m) => key(m.to) === key(cell));
    return NEXT_EFFECT_MS + (moved ? PARAMS.popDelayMs : 0);
}

/** When the last block of this move has finished growing; 0 when nothing appears. */
export function growthEndMs(res: Pick<MoveResult, 'spawned' | 'relocated'>): number {
    return res.spawned.reduce((end, p) => Math.max(end, spawnDelayMs(res, p) + PARAMS.popMs), 0);
}
