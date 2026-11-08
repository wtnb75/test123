import {
    GOAL_METERS,
    RESULT_BUTTON1_FROM_BOTTOM,
    RESULT_BUTTON2_FROM_BOTTOM,
    RESULT_HEIGHT_Y,
    RESULT_INPUT_GUARD_MS,
    RESULT_REASON_Y,
    RESULT_STAGE_Y,
    RESULT_TITLE_Y,
    TITLE_BUTTON_FROM_BOTTOM,
    TITLE_HELP_STEP,
    TITLE_HELP_Y,
    TITLE_NAME_Y,
    TITLE_STAGE_Y,
    TITLE_SUB_Y,
} from '../params';
import type { Outcome } from './sim';

/** Center y of each element of Title for a screen height H (docs/spec.md "Title"). */
export function titleLayout(height: number) {
    return {
        nameY: TITLE_NAME_Y,
        subY: TITLE_SUB_Y,
        stageY: TITLE_STAGE_Y,
        helpY: (line: number) => TITLE_HELP_Y + TITLE_HELP_STEP * line,
        buttonY: height - TITLE_BUTTON_FROM_BOTTOM,
    };
}

/** Center y of each element of Result for a screen height H (docs/spec.md "Result"). */
export function resultLayout(height: number) {
    return {
        stageY: RESULT_STAGE_Y,
        titleY: RESULT_TITLE_Y,
        reasonY: RESULT_REASON_Y,
        heightY: RESULT_HEIGHT_Y,
        retryY: height - RESULT_BUTTON1_FROM_BOTTOM,
        titleButtonY: height - RESULT_BUTTON2_FROM_BOTTOM,
    };
}

export const HELP_LINES = [
    '左右にスワイプして動く',
    'タップでジャンプ',
    '空中でタップすると足場ができる',
    `弾をよけて、${GOAL_METERS} m 上のゴールをめざそう`,
    'PC: ← → で移動、Space でジャンプ・足場',
] as const;

export const HINT_LINES = ['左右にスワイプで移動', 'タップ: ジャンプ ／ 空中で足場'] as const;

/** `137 / 200 m`: the climbed height (already truncated and capped) against the goal. */
export const hudText = (shownMeters: number): string => `${shownMeters} / ${GOAL_METERS} m`;

/** The texts of Result for an outcome and the shown height. */
export function resultTexts(outcome: Outcome, shownMeters: number) {
    return {
        title: outcome === 'clear' ? 'クリア！' : 'ゲームオーバー',
        reason: outcome === 'clear' ? 'ゴールにとうたつ！' : outcome === 'hit' ? '弾に当たった' : '下に取り残された',
        height: `高さ ${shownMeters} / ${GOAL_METERS} m`,
    };
}

/** Result accepts buttons and keys only from RESULT_INPUT_GUARD_MS after it started. */
export const resultInputOpen = (elapsedMs: number): boolean => elapsedMs >= RESULT_INPUT_GUARD_MS;
