// Personal best text. Storage itself (key, value shape, fallbacks) is the shared `best-store` package.
import type { Best, BestStore } from 'best-store';

export type { Best };

/** The game directory name: the best is saved under the key `flipbreak.best`. */
export const GAME_ID = 'flipbreak';

/** The label saved with a best: the stage the play reached. */
export function stageLabel(stage: number): string {
    return `STAGE ${stage}`;
}

/**
 * Record a finished play (score 0 included) and return the best to show and whether this play set it.
 * `record()` returns null only for a non-finite score, which a play never produces; fall back to the saved best.
 */
export function recordPlay(
    store: Pick<BestStore, 'record' | 'load'>,
    play: { score: number; stage: number },
): { best: Best | null; isNew: boolean } {
    const rec = store.record(play.score, stageLabel(play.stage));
    return { best: rec ? rec.best : store.load(), isNew: rec?.isNew ?? false };
}

export function formatBest(best: Best | null): string {
    return best ? `BEST ${best.score}（${best.label}）` : 'BEST ---';
}
