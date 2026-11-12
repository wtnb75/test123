import { describe, expect, it } from 'vitest';
import {
  CLEAR_DELAY_MS,
  FADE_HOLD_MS,
  FADE_IN_MS,
  FloorFade,
  fadeInAlpha,
  fadeLabel,
  fadeOutAlpha,
  type FadeFrame
} from './floorFade';

// Hand-worked values of docs/spec/floor-fade.md ("テスト観点").

describe('the cover opacity', () => {
  it('fades out from 0 to 1 over ClearDelay and stays at 1', () => {
    expect(fadeOutAlpha(0)).toBe(0);
    expect(fadeOutAlpha(125)).toBe(0.5);
    expect(fadeOutAlpha(250)).toBe(1);
    expect(fadeOutAlpha(400)).toBe(1);
  });

  it('fades in from 1 to nothing over FadeInMs', () => {
    expect(fadeInAlpha(0)).toBe(1);
    expect(fadeInAlpha(100)).toBeCloseTo(0.6, 10);
    expect(fadeInAlpha(125)).toBe(0.5);
    expect(fadeInAlpha(200)).toBeCloseTo(0.2, 10);
    expect(fadeInAlpha(250)).toBeNull();
    expect(fadeInAlpha(300)).toBeNull();
  });

  it('treats a time before the start as the start', () => {
    expect(fadeOutAlpha(-50)).toBe(0);
    expect(fadeInAlpha(-50)).toBe(1);
  });

  it('keeps the spec numbers at their initial values', () => {
    expect([CLEAR_DELAY_MS, FADE_HOLD_MS, FADE_IN_MS]).toEqual([250, 500, 250]);
  });
});

describe('the label', () => {
  it.each([
    [1, 'B2F'],
    [9, 'B10F'],
    [99, 'B100F'],
    [100, 'B101F']
  ])('names the next floor when leaving B%sF: %s', (floor, label) => {
    expect(fadeLabel(floor)).toBe(label);
  });
});

const frame = (alpha: number | null, generate = false, resume = false): FadeFrame => ({ alpha, generate, resume });

describe('the fade timeline (deltas of 100 ms)', () => {
  it('goes out, generates once when dark, holds 500 ms, then resumes and fades in', () => {
    const fade = new FloorFade();
    fade.start(1);
    expect(fade.stage).toBe('out');
    expect(fade.nextFloor).toBe(2);

    const u1 = fade.advance(100);
    expect(u1.alpha).toBeCloseTo(0.4, 10);
    expect(fade.advance(100).alpha).toBeCloseTo(0.8, 10);
    // t = 300 >= 250: fully dark, but nothing is generated yet (the dark frame is drawn first).
    expect(fade.advance(100)).toEqual(frame(1));
    expect(fade.stage).toBe('dark');
    // The next update generates; its (huge) delta adds nothing to the hold.
    expect(fade.advance(5000)).toEqual(frame(1, true));
    for (const _ of [100, 200, 300, 400]) {
      expect(fade.advance(100)).toEqual(frame(1));
    }
    expect(fade.advance(100)).toEqual(frame(1, false, true));
    expect(fade.stage).toBe('in');
    expect(fade.advance(100).alpha).toBeCloseTo(0.6, 10);
    expect(fade.advance(100).alpha).toBeCloseTo(0.2, 10);
    expect(fade.advance(100)).toEqual(frame(null));
    expect(fade.active).toBe(false);
  });

  it('is not complete one millisecond before the boundaries', () => {
    const fade = new FloorFade();
    fade.start(1);
    fade.advance(100);
    fade.advance(100);
    expect(fade.advance(49).alpha).toBeCloseTo(0.996, 10);
    expect(fade.stage).toBe('out');
    expect(fade.advance(1).alpha).toBe(1);
    expect(fade.stage).toBe('dark');
    fade.advance(0);
    for (const _ of [1, 2, 3, 4]) {
      fade.advance(100);
    }
    expect(fade.advance(99).resume).toBe(false);
    expect(fade.stage).toBe('hold');
    expect(fade.advance(1).resume).toBe(true);
  });

  it('counts at most 100 ms of a long frame in every stage', () => {
    const fade = new FloorFade();
    fade.start(1);
    expect(fade.advance(1500).alpha).toBeCloseTo(0.4, 10);
    fade.advance(1500);
    fade.advance(1500);
    fade.advance(1500);
    for (const _ of [1, 2, 3, 4]) {
      expect(fade.advance(1500).resume).toBe(false);
    }
    expect(fade.advance(1500).resume).toBe(true);
    expect(fade.advance(1500).alpha).toBeCloseTo(0.6, 10);
  });

  it('does not move time on a frame with no delta (a hidden page) or a negative one', () => {
    const fade = new FloorFade();
    fade.start(1);
    expect(fade.advance(0).alpha).toBe(0);
    expect(fade.advance(-50).alpha).toBe(0);
    // The negative frame did not take time back: the next 100 ms frame counts 100.
    expect(fade.advance(100).alpha).toBeCloseTo(0.4, 10);
  });

  it('generates only once and does nothing when idle', () => {
    const fade = new FloorFade();
    expect(fade.advance(100)).toEqual(frame(null));
    fade.start(3);
    let generated = 0;
    for (let i = 0; i < 40; i++) {
      generated += fade.advance(100).generate ? 1 : 0;
    }
    expect(generated).toBe(1);
    expect(fade.active).toBe(false);
  });

  it('cancels at every stage so nothing is generated afterwards', () => {
    for (const steps of [0, 3, 4, 7, 11]) {
      const fade = new FloorFade();
      fade.start(1);
      for (let i = 0; i < steps; i++) {
        fade.advance(100);
      }
      fade.cancel();
      expect(fade.active).toBe(false);
      expect(fade.advance(100)).toEqual(frame(null));
    }
  });

  it('starts again from the beginning', () => {
    const fade = new FloorFade();
    fade.start(1);
    fade.advance(100);
    fade.start(5);
    expect(fade.nextFloor).toBe(6);
    expect(fade.advance(100).alpha).toBeCloseTo(0.4, 10);
  });
});
