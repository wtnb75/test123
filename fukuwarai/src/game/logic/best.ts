// Best score text. Storage itself (key, value shape, fallbacks) is the shared `best-store` package.
import type { Best, RecordResult } from 'best-store';

/** The game directory name: the best is saved under the key `fukuwarai.best`. */
export const GAME_ID = 'fukuwarai';

/** The label saved with a best: the score with its unit. */
export function scoreLabel(score: number): string {
    return `${score}点`;
}

/** "ベスト 87点" (a half-width space after "ベスト"). */
function bestText(best: Best): string {
    return `ベスト ${best.score}点`;
}

/** The one line on Result after a play was recorded: a new record, or the standing best. */
export function resultBestText(result: RecordResult): string {
    return result.isNew ? '新記録！' : bestText(result.best);
}

/** The best line on Title (and on Result when it was started without a score); null when there is no record. */
export function titleBestText(best: Best | null): string | null {
    return best === null ? null : bestText(best);
}
