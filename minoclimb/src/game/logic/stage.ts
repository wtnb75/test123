// The stage framework (docs/spec/stages.md): which stage a new Game starts with, and the texts and the heading
// size that show it. Pure logic, no Phaser: the Scene passes in what it measured.

/** What starts a Game: Title's START, the Result's "next stage", "same stage again" and "back to Title". */
export type StageStart = 'start' | 'next' | 'again' | 'title';

/** The first stage, and the one every START from the Title begins with. */
export const FIRST_STAGE = 1;

/** The stage number the Game that `how` starts has, given the stage that was being played (or just cleared). */
export function stageAfter(how: StageStart, current: number): number {
    switch (how) {
        case 'next':
            return current + 1;
        case 'again':
            return current;
        default:
            return FIRST_STAGE;
    }
}

/** One full-width space (U+3000) between the stage and the height in the HUD line. */
const HUD_GAP = '　';

/** The HUD line: "ステージ n", a full-width space, "高さ h / goal". The demo has no stage (`null`): height only. */
export function hudText(stage: number | null, height: number, goal: number): string {
    const heightText = `高さ ${height} / ${goal}`;
    return stage === null ? heightText : `ステージ ${stage}${HUD_GAP}${heightText}`;
}

/** The heading of a cleared stage. */
export function clearHeading(stage: number): string {
    return `ステージ ${stage} クリア！`;
}

/** The prompt on the Result screen under the heading (y = 480). */
export function resultPrompt(cleared: boolean): string {
    return cleared ? 'タップ / スペースで次のステージへ' : 'タップ / R / スペースでリトライ';
}

/** The heading's largest font size (px, the old "クリア！" size) and the narrowest it may shrink to. */
export const HEADING_MAX_SIZE = 40;
export const HEADING_MIN_SIZE = 18.3;
/** The widest the heading may be: the 360 px canvas minus 10 px on each side. */
export const HEADING_MAX_WIDTH = 340;

/**
 * The largest whole font size from `max` down to `min` at which `measure(size)` (the text's width at that
 * size) is within `maxWidth`. When even `min` is too wide, `min` is returned.
 */
export function fitFontSize(
    measure: (size: number) => number,
    maxWidth: number,
    max = HEADING_MAX_SIZE,
    min = HEADING_MIN_SIZE,
): number {
    for (let size = max; size > min; size--) {
        if (measure(size) <= maxWidth) return size;
    }
    return min;
}
