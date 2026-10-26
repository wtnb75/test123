import { describe, expect, it } from 'vitest';
import { HEIGHT, P, WIDTH } from '../params';
import type { PointerState, RawInput } from './input';
import { lockoutOver, onTitleButton, RESULT_TITLE_RECT, resultAction } from './resultInput';

/** The latched presses of one frame: keys pressed (by `KeyboardEvent.code`) and where each press began. */
const frame = (keys: string[] = [], presses: [number, number][] = []): RawInput => ({
    keys: new Set(),
    pointers: [],
    pressedKeys: new Set(keys),
    pointerPressed: presses.length > 0,
    pressPoints: presses.map(([x, y]) => ({ x, y })),
    quickTaps: [],
    cancelled: new Set(),
});

describe('the "back to Title" button (docs/spec.md "Result Scene")', () => {
    it('is 200 x 64 centred on (180, 600): x 80..280, y 568..632', () => {
        expect(P.RESULT_TITLE_X).toBe(180);
        expect(P.RESULT_TITLE_Y).toBe(600);
        expect(RESULT_TITLE_RECT).toEqual({ x: 80, y: 568, width: 200, height: 64 });
    });

    it('owns its left and top edges and not its right and bottom edges', () => {
        expect(onTitleButton(80, 568)).toBe(true);
        expect(onTitleButton(279.9, 631.9)).toBe(true);
        expect(onTitleButton(280, 600)).toBe(false);
        expect(onTitleButton(180, 632)).toBe(false);
        expect(onTitleButton(79, 600)).toBe(false);
        expect(onTitleButton(180, 567)).toBe(false);
    });

    it('keeps clear of the retry hint (y 480) and fits the 360 x 720 canvas, and is 44 px tall at 375 x 550', () => {
        expect(RESULT_TITLE_RECT.y - 480).toBe(88);
        expect(RESULT_TITLE_RECT.x).toBeGreaterThanOrEqual(0);
        expect(RESULT_TITLE_RECT.x + RESULT_TITLE_RECT.width).toBeLessThanOrEqual(WIDTH);
        expect(RESULT_TITLE_RECT.y + RESULT_TITLE_RECT.height).toBeLessThanOrEqual(HEIGHT);
        const s = Math.min(375 / 360, 550 / 720); // Phaser FIT scale
        expect(RESULT_TITLE_RECT.height * s).toBeGreaterThanOrEqual(44);
    });
});

describe('resultAction (docs/spec.md テスト観点 "結果画面の入力の振り分け")', () => {
    it('sends a press that began inside the button to the Title: centre and the top-left corner', () => {
        expect(resultAction(frame([], [[180, 600]]), true)).toBe('title');
        expect(resultAction(frame([], [[80, 568]]), true)).toBe('title');
    });

    it.each([
        ['just left of the button', [79, 600]],
        ['just above the button', [180, 567]],
        ['on the right edge', [280, 600]],
        ['on the bottom edge', [180, 632]],
        ['on the retry hint', [180, 480]],
    ] as [string, [number, number]][])('retries for a press that began %s', (_name, point) => {
        expect(resultAction(frame([], [point]), true)).toBe('retry');
    });

    it('retries for R and Space, and goes to the Title for T', () => {
        expect(resultAction(frame(['KeyR']), true)).toBe('retry');
        expect(resultAction(frame(['Space']), true)).toBe('retry');
        expect(resultAction(frame(['KeyT']), true)).toBe('title');
    });

    it('does nothing without a press', () => {
        expect(resultAction(frame(), true)).toBeNull();
        expect(resultAction(frame(['KeyA', 'Enter']), true)).toBeNull();
    });

    it('does nothing during the lockout, whatever is pressed, and the presses are not carried over', () => {
        const during = frame(['KeyR', 'KeyT', 'Space'], [[180, 600], [10, 10]]);
        expect(resultAction(during, false)).toBeNull();
        // the next read brings only what was pressed since; the earlier presses are gone with the previous frame
        expect(resultAction(frame(), true)).toBeNull();
    });

    it('starts accepting exactly when the lockout is over (RETRY_LOCKOUT 0.5 s: 0.49 s no, 0.5 s yes)', () => {
        expect(P.RETRY_LOCKOUT).toBe(0.5);
        expect(lockoutOver(0)).toBe(false);
        expect(lockoutOver(0.49)).toBe(false);
        expect(lockoutOver(0.5)).toBe(true);
        expect(lockoutOver(0.51)).toBe(true);
        expect(resultAction(frame(['KeyT']), lockoutOver(0.49))).toBeNull();
        expect(resultAction(frame(['KeyT']), lockoutOver(0.5))).toBe('title');
        expect(resultAction(frame([], [[10, 10]]), lockoutOver(0.49))).toBeNull();
        expect(resultAction(frame([], [[10, 10]]), lockoutOver(0.5))).toBe('retry');
    });

    it('looks only at where a press began: a finger that has moved since (current position elsewhere) does not change the action', () => {
        const onButtonNow: PointerState = { id: 1, x: 180, y: 600, downX: 10, downY: 10, isDown: true };
        const outsideNow: PointerState = { id: 2, x: 10, y: 10, downX: 180, downY: 600, isDown: true };
        // began outside, now inside the button: still a retry
        expect(resultAction({ ...frame([], [[10, 10]]), pointers: [onButtonNow] }, true)).toBe('retry');
        // began on the button, now outside: still the Title
        expect(resultAction({ ...frame([], [[180, 600]]), pointers: [outsideNow] }, true)).toBe('title');
    });

    it.each([
        ['R and T', frame(['KeyR', 'KeyT'])],
        ['Space and T', frame(['Space', 'KeyT'])],
        ['a tap outside the button and T', frame(['KeyT'], [[10, 10]])],
        ['a tap outside and a tap on the button (outside first)', frame([], [[10, 10], [180, 600]])],
        ['a tap on the button and a tap outside (button first)', frame([], [[180, 600], [10, 10]])],
        ['R and a tap on the button', frame(['KeyR'], [[180, 600]])],
    ])('lets only the Title win when retry and Title presses come in one frame: %s', (_name, raw) => {
        expect(resultAction(raw, true)).toBe('title');
    });

    it('never retries for a lone press on the button, even with other keys held that are not retry keys', () => {
        expect(resultAction(frame(['KeyA'], [[200, 590]]), true)).toBe('title');
    });

    it('ignores keys that are not Result inputs (arrows, Enter, KeyY)', () => {
        expect(resultAction(frame(['ArrowUp', 'Enter', 'KeyY']), true)).toBeNull();
    });
});
