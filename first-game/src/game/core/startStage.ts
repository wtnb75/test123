// Which stage a game starts at, and the STAGE button's prompt (docs/spec.md "開始ステージの決め方").

/** Highest start stage (the `?stage=` query, the stored value and the STAGE button share it). */
export const STAGE_MAX = 100;

/**
 * The leading integer of `text` (radix 10; `0x10` is not hex), or null when there is none.
 * `Infinity` can come out of a very long digit string: callers decide what to do with it.
 */
export const parseLeadingInteger = (text: string | null | undefined): number | null => {
  if (text === null || text === undefined) {
    return null;
  }
  const value = Number.parseInt(text, 10);
  return Number.isNaN(value) ? null : value;
};

export type StartStage = {
  stage: number;
  /** True when the stage came from a valid `?stage=`: only then is the start stage saved after it started. */
  fromQuery: boolean;
};

/**
 * `queryValue` is the value of the `stage` URL parameter (null when missing), `stored` the saved start stage.
 * The query wins when it is >= 1; otherwise the stored value when it is >= 1; otherwise 1. Both are capped at `STAGE_MAX`.
 */
export const resolveStartStage = (queryValue: string | null, stored: string | null): StartStage => {
  const fromQuery = parseLeadingInteger(queryValue);
  if (fromQuery !== null && fromQuery >= 1) {
    return { stage: Math.min(STAGE_MAX, fromQuery), fromQuery: true };
  }
  const fromStorage = parseLeadingInteger(stored);
  if (fromStorage !== null && fromStorage >= 1) {
    return { stage: Math.min(STAGE_MAX, fromStorage), fromQuery: false };
  }
  return { stage: 1, fromQuery: false };
};

export type StagePromptResult =
  | { kind: 'cancel' }
  | { kind: 'invalid' }
  | { kind: 'ok'; stage: number };

/**
 * The text typed into the STAGE button's prompt (null = cancelled). Only 1..STAGE_MAX is accepted;
 * anything else is rejected and never rounded to the limit.
 */
export const parseStagePrompt = (text: string | null): StagePromptResult => {
  if (text === null) {
    return { kind: 'cancel' };
  }
  const value = parseLeadingInteger(text);
  if (value === null || value < 1 || value > STAGE_MAX) {
    return { kind: 'invalid' };
  }
  return { kind: 'ok', stage: value };
};
