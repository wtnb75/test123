import { describe, expect, it } from 'vitest';
import {
  FLAG_OFF_STROKE_WIDTH,
  FLAG_ON_STROKE_WIDTH,
  PAD_DIRECTION_THRESHOLD,
  PAD_SECTOR_ALPHA_CHARGE,
  PAD_SECTOR_ALPHA_REPEAT,
  flagCircleSize,
  padSectorAlpha,
  padSectorArc,
  padSectorOf,
  padThemeOf,
  sectorOfAngle
} from './padFeedback';

describe('padSectorOf', () => {
  it.each([
    [20, 0, 0],
    [14, 14, 1],
    [0, 20, 2],
    [-14, 14, 3],
    [-20, 0, 4],
    [-14, -14, 5],
    [0, -20, 6],
    [14, -14, 7]
  ])('(%d, %d) selects sector %d (clockwise from east, y down)', (dx, dy, expected) => {
    expect(padSectorOf(dx, dy)).toBe(expected);
  });

  it('selects nothing under 14 px and selects from exactly 14 px', () => {
    expect(PAD_DIRECTION_THRESHOLD).toBe(14);
    expect(padSectorOf(13.9, 0)).toBeNull();
    expect(padSectorOf(0, 0)).toBeNull();
    expect(padSectorOf(14, 0)).toBe(0);
    expect(padSectorOf(0, -14)).toBe(6);
  });

  it('keeps the direction a flick is mostly pointing to near a boundary', () => {
    // 22.4 degrees from east is still east; 22.6 degrees is south-east.
    const r = 30;
    const at = (deg: number): [number, number] => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];
    expect(padSectorOf(...at(22.4))).toBe(0);
    expect(padSectorOf(...at(22.6))).toBe(1);
    expect(padSectorOf(...at(-22.4))).toBe(0);
    expect(padSectorOf(...at(-22.6))).toBe(7);
  });
});

describe('sectorOfAngle', () => {
  it.each([
    [0, 0], [22.4, 0], [22.5, 1], [45, 1], [67.5, 2], [90, 2], [112.5, 3], [135, 3], [157.5, 4], [180, 4],
    [202.5, 5], [225, 5], [247.5, 6], [270, 6], [292.5, 7], [315, 7], [337.5, 0], [360, 0]
  ])('%d degrees is sector %d (ties go up, as the repeat direction does)', (deg, expected) => {
    expect(sectorOfAngle(deg)).toBe(expected);
  });

  it('takes a negative angle like its equivalent in [0, 360)', () => {
    expect(sectorOfAngle(-22.5)).toBe(0);
    expect(sectorOfAngle(-67.5)).toBe(7);
    expect(sectorOfAngle(-112.5)).toBe(6);
    expect(sectorOfAngle(-157.5)).toBe(5);
    expect(sectorOfAngle(-90)).toBe(6);
  });
});

describe('padSectorAlpha', () => {
  it('is thin before the first repeat and thick after it', () => {
    expect(PAD_SECTOR_ALPHA_CHARGE).toBe(0.35);
    expect(PAD_SECTOR_ALPHA_REPEAT).toBe(0.7);
    expect(padSectorAlpha(false)).toBe(0.35);
    expect(padSectorAlpha(true)).toBe(0.7);
  });
});

describe('padThemeOf', () => {
  it('is blue while FLAG is off and green while it is on', () => {
    expect(padThemeOf(false)).toBe('blue');
    expect(padThemeOf(true)).toBe('green');
  });
});

describe('flagCircleSize', () => {
  it('draws the thicker frame inside the circle so the outline stays the same size', () => {
    expect(FLAG_OFF_STROKE_WIDTH).toBe(2);
    expect(FLAG_ON_STROKE_WIDTH).toBe(4);
    // outline = circle + frame: off 52 + 2 = 54, on 50 + 4 = 54 (compact: 44 + 2 = 46, 42 + 4 = 46)
    expect(flagCircleSize(52, false) + FLAG_OFF_STROKE_WIDTH).toBe(54);
    expect(flagCircleSize(52, true) + FLAG_ON_STROKE_WIDTH).toBe(54);
    expect(flagCircleSize(44, false) + FLAG_OFF_STROKE_WIDTH).toBe(46);
    expect(flagCircleSize(44, true) + FLAG_ON_STROKE_WIDTH).toBe(46);
  });
});

describe('padSectorArc', () => {
  const deg = (rad: number): number => (rad * 180) / Math.PI;

  it.each([
    [0, -22.5, 22.5],
    [1, 22.5, 67.5],
    [2, 67.5, 112.5],
    [4, 157.5, 202.5],
    [6, 247.5, 292.5],
    [7, 292.5, 337.5]
  ])('sector %d spans its direction ±22.5° (%d° to %d°, clockwise from east, y down)', (sector, start, end) => {
    const arc = padSectorArc(sector);
    expect(deg(arc.start)).toBeCloseTo(start, 6);
    expect(deg(arc.end)).toBeCloseTo(end, 6);
  });

  it('is centred on the direction the same function numbers: a point at the arc centre selects that sector', () => {
    for (let sector = 0; sector < 8; sector += 1) {
      const arc = padSectorArc(sector);
      const mid = (arc.start + arc.end) / 2;
      expect(padSectorOf(30 * Math.cos(mid), 30 * Math.sin(mid))).toBe(sector);
    }
  });
});
