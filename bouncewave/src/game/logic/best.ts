// Personal best text. Storage itself (key, value shape, fallbacks) is the shared `best-store` package.
import type { Best } from 'best-store';

export type { Best };

/** The game directory name: the best is saved under the key `bouncewave.best`. */
export const GAME_ID = 'bouncewave';

/** The label saved with a best: the wave the play reached. */
export function waveLabel(wave: number): string {
    return `WAVE ${wave}`;
}

export function formatBest(best: Best | null): string {
    return best ? `BEST ${best.score}（${best.label}）` : 'BEST ---';
}
