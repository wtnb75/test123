import { describe, expect, it } from 'vitest';
import { STAGE_MAX, parseLeadingInteger, parseStagePrompt, resolveStartStage } from './startStage';

// docs/spec.md "開始ステージの決め方": the first game of the page reads ?stage= and (dev) the saved value;
// later games ignore ?stage= and are stage 1 in production, the saved value (or 1) on dev.
const FIRST_DEV = { first: true, useSaved: true };
const FIRST_PROD = { first: true, useSaved: false };
const LATER_DEV = { first: false, useSaved: true };
const LATER_PROD = { first: false, useSaved: false };

describe('resolveStartStage', () => {
  it.each([
    ['5', null, 5],
    ['7x', null, 7],
    ['1e3', null, 1],
    ['5.9', null, 5],
    [' 5', null, 5],
    ['101', null, STAGE_MAX],
    ['100000', null, STAGE_MAX],
    ['9'.repeat(400), null, STAGE_MAX],
  ])('uses the query %j and caps it at StageMax', (query, stored, expected) => {
    const result = resolveStartStage(query, stored, FIRST_DEV);
    expect(result).toEqual({ stage: expected, fromQuery: true });
  });

  it.each([['0'], ['-3'], ['abc'], [''], [null], ['0x10']])(
    'falls back to the stored value when the query is %j',
    (query) => {
      expect(resolveStartStage(query, '8', FIRST_DEV)).toEqual({ stage: 8, fromQuery: false });
    },
  );

  it.each([
    ['7x', 7],
    ['NaN', 1],
    ['0', 1],
    ['-3', 1],
    ['', 1],
    [null, 1],
    ['5000', STAGE_MAX],
  ])('reads the stored value %j as stage %i', (stored, expected) => {
    expect(resolveStartStage(null, stored, FIRST_DEV)).toEqual({ stage: expected, fromQuery: false });
  });

  it('prefers a valid query over the stored value', () => {
    expect(resolveStartStage('3', '9', FIRST_DEV).stage).toBe(3);
  });
});

describe('resolveStartStage: production (the saved start stage is not read)', () => {
  it('the first game of the page starts at the query, ignoring a stored value', () => {
    expect(resolveStartStage('5', '7', FIRST_PROD)).toEqual({ stage: 5, fromQuery: true });
  });

  it('the first game without a valid query is stage 1 even when a value was stored', () => {
    expect(resolveStartStage(null, '7', FIRST_PROD)).toEqual({ stage: 1, fromQuery: false });
    expect(resolveStartStage('abc', '7', FIRST_PROD)).toEqual({ stage: 1, fromQuery: false });
  });

  it('NEW GAME and a start after the title are always stage 1, with ?stage= still in the URL and a stored value', () => {
    expect(resolveStartStage('5', '7', LATER_PROD)).toEqual({ stage: 1, fromQuery: false });
    expect(resolveStartStage('100', '100', LATER_PROD)).toEqual({ stage: 1, fromQuery: false });
  });
});

describe('resolveStartStage: later games on the dev server', () => {
  it('ignore ?stage= and start at the stored value', () => {
    expect(resolveStartStage('5', '7', LATER_DEV)).toEqual({ stage: 7, fromQuery: false });
  });

  it('cap a stored value at StageMax and fall back to 1 for none or an invalid one', () => {
    expect(resolveStartStage(null, '5000', LATER_DEV).stage).toBe(STAGE_MAX);
    expect(resolveStartStage('9', null, LATER_DEV).stage).toBe(1);
    expect(resolveStartStage('9', '-3', LATER_DEV).stage).toBe(1);
  });
});

describe('parseStagePrompt', () => {
  it.each([
    ['100', 100],
    ['1', 1],
    ['5.9', 5],
    ['1e3', 1],
  ])('accepts %j as stage %i', (text, stage) => {
    expect(parseStagePrompt(text)).toEqual({ kind: 'ok', stage });
  });

  it.each([['101'], ['0'], ['-3'], ['abc'], ['']])('rejects %j without rounding', (text) => {
    expect(parseStagePrompt(text)).toEqual({ kind: 'invalid' });
  });

  it('treats a cancelled prompt as cancel', () => {
    expect(parseStagePrompt(null)).toEqual({ kind: 'cancel' });
  });
});

describe('parseLeadingInteger', () => {
  it('returns null for missing or non numeric text', () => {
    expect(parseLeadingInteger(null)).toBeNull();
    expect(parseLeadingInteger(undefined)).toBeNull();
    expect(parseLeadingInteger('x')).toBeNull();
  });

  it('does not read 0x as hexadecimal', () => {
    expect(parseLeadingInteger('0x10')).toBe(0);
  });
});
