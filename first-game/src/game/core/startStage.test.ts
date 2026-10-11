import { describe, expect, it } from 'vitest';
import { STAGE_MAX, parseLeadingInteger, parseStagePrompt, resolveStartStage } from './startStage';

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
    const result = resolveStartStage(query, stored);
    expect(result).toEqual({ stage: expected, fromQuery: true });
  });

  it.each([['0'], ['-3'], ['abc'], [''], [null], ['0x10']])(
    'falls back to the stored value when the query is %j',
    (query) => {
      expect(resolveStartStage(query, '8')).toEqual({ stage: 8, fromQuery: false });
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
    expect(resolveStartStage(null, stored)).toEqual({ stage: expected, fromQuery: false });
  });

  it('prefers a valid query over the stored value', () => {
    expect(resolveStartStage('3', '9').stage).toBe(3);
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
