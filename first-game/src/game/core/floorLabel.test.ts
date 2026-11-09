import { describe, expect, it } from 'vitest';
import { depthLabel, floorLabel } from './floorLabel';

describe('floorLabel', () => {
  it.each([
    [1, 'B1F'],
    [5, 'B5F'],
    [20, 'B20F'],
    [100, 'B100F'],
  ])('writes floor %i as %s', (floor, text) => {
    expect(floorLabel(floor)).toBe(text);
  });
});

describe('depthLabel', () => {
  it.each([
    [0, 'B1F'], // no record yet: the first floor is already reached
    [9, 'B10F'],
    [12, 'B13F'],
    [99, 'B100F'],
  ])('writes score %i as the deepest floor %s', (score, text) => {
    expect(depthLabel(score)).toBe(text);
  });
});
