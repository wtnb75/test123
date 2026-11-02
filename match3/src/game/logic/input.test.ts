import { describe, expect, it } from 'vitest';
import { CELL, SWIPE_RATIO } from '../params';
import {
    type InputState,
    cellAt,
    initialInput,
    isBoardKey,
    pressKey,
    swipe,
    swipeFrom,
    tapStone,
    touchOutside,
} from './input';
import { boardRect } from './layout';
import { pos } from './testing';

const rect = boardRect(528); // x 4, y 136, 352 × 352

describe('cellAt (docs/spec.md "タップ → マス")', () => {
    it('maps the top-left corner to row 0, col 0 and the last inner pixel to row 7, col 7', () => {
        expect(cellAt(4, 136, rect)).toEqual(pos(0, 0));
        expect(cellAt(355.9, 487.9, rect)).toEqual(pos(7, 7));
    });

    it('returns null just outside each edge', () => {
        expect(cellAt(3.9, 300, rect)).toBeNull();
        expect(cellAt(356, 300, rect)).toBeNull();
        expect(cellAt(100, 135.9, rect)).toBeNull();
        expect(cellAt(100, 488, rect)).toBeNull();
    });

    it('changes cell exactly at the cell boundary (every 44)', () => {
        expect(cellAt(47.9, 136, rect)).toEqual(pos(0, 0));
        expect(cellAt(48, 136, rect)).toEqual(pos(0, 1));
        expect(cellAt(4, 179.9, rect)).toEqual(pos(0, 0));
        expect(cellAt(4, 180, rect)).toEqual(pos(1, 0));
    });
});

describe('swipe (docs/spec.md "スワイプ")', () => {
    const limit = CELL * SWIPE_RATIO; // 17.6

    it('is pending below the limit and acts from exactly the limit', () => {
        expect(swipe(pos(3, 3), limit - 0.1, 0)).toBe('pending');
        expect(swipe(pos(3, 3), limit, 0)).toEqual({ to: pos(3, 4) });
        expect(swipe(pos(3, 3), 0, -(limit - 0.1))).toBe('pending');
        expect(swipe(pos(3, 3), 0, -limit)).toEqual({ to: pos(2, 3) });
    });

    it('uses the sign of the longer axis for the direction', () => {
        expect(swipe(pos(3, 3), 30, 5)).toEqual({ to: pos(3, 4) });
        expect(swipe(pos(3, 3), -30, 5)).toEqual({ to: pos(3, 2) });
        expect(swipe(pos(3, 3), 5, 30)).toEqual({ to: pos(4, 3) });
        expect(swipe(pos(3, 3), 5, -30)).toEqual({ to: pos(2, 3) });
    });

    it('lets x win when both axes moved the same distance', () => {
        expect(swipe(pos(3, 3), 20, 20)).toEqual({ to: pos(3, 4) });
        expect(swipe(pos(3, 3), -20, 20)).toEqual({ to: pos(3, 2) });
    });

    it('reports no target when the neighbour is outside the board', () => {
        expect(swipe(pos(0, 0), -30, 0)).toEqual({ to: null });
        expect(swipe(pos(0, 0), 0, -30)).toEqual({ to: null });
        expect(swipe(pos(7, 7), 30, 0)).toEqual({ to: null });
        expect(swipe(pos(7, 7), 0, 30)).toEqual({ to: null });
    });
});

describe('tapStone (docs/spec.md "石の選択")', () => {
    it('selects the first stone tapped and hides the cursor', () => {
        const start: InputState = { ...initialInput(), cursorVisible: true };
        const out = tapStone(start, pos(2, 2));
        expect(out.state.selected).toEqual(pos(2, 2));
        expect(out.state.cursorVisible).toBe(false);
        expect(out.state.lastTouched).toEqual(pos(2, 2));
        expect(out.swap).toBeUndefined();
    });

    it('swaps with the selected stone when a neighbour is tapped, clearing the selection', () => {
        const first = tapStone(initialInput(), pos(2, 2)).state;
        const out = tapStone(first, pos(2, 3));
        expect(out.swap).toEqual([pos(2, 2), pos(2, 3)]);
        expect(out.state.selected).toBeNull();
        expect(out.state.lastTouched).toEqual(pos(2, 3));
    });

    it('selects the new stone when a non-neighbour (diagonal or far) is tapped', () => {
        const first = tapStone(initialInput(), pos(2, 2)).state;
        const diagonal = tapStone(first, pos(3, 3));
        expect(diagonal.swap).toBeUndefined();
        expect(diagonal.state.selected).toEqual(pos(3, 3));
        const far = tapStone(first, pos(2, 5));
        expect(far.state.selected).toEqual(pos(2, 5));
    });

    it('keeps the selection when the selected stone is tapped again', () => {
        const first = tapStone(initialInput(), pos(2, 2)).state;
        const again = tapStone(first, pos(2, 2));
        expect(again.swap).toBeUndefined();
        expect(again.state.selected).toEqual(pos(2, 2));
    });
});

describe('touchOutside / swipeFrom', () => {
    it('a press off the board only hides the cursor', () => {
        const s: InputState = { ...initialInput(), selected: pos(1, 1), cursorVisible: true };
        const out = touchOutside(s);
        expect(out.cursorVisible).toBe(false);
        expect(out.selected).toEqual(pos(1, 1));
    });

    it('a swipe clears the selection, hides the cursor and remembers the start stone', () => {
        const s: InputState = { ...initialInput(), selected: pos(1, 1), cursorVisible: true };
        const out = swipeFrom(s, pos(4, 4));
        expect(out.selected).toBeNull();
        expect(out.cursorVisible).toBe(false);
        expect(out.lastTouched).toEqual(pos(4, 4));
    });
});

describe('pressKey (docs/spec.md "カーソル（キーボード）")', () => {
    const shown = (cursor = pos(3, 3), selected: ReturnType<typeof pos> | null = null): InputState => ({
        ...initialInput(),
        cursor,
        cursorVisible: true,
        selected,
    });

    it('knows the keys of the board: arrows, Space, Enter, Escape', () => {
        for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Escape']) {
            expect(isBoardKey(k)).toBe(true);
        }
        expect(isBoardKey('a')).toBe(false);
    });

    it('ignores other keys completely, even while the cursor is hidden', () => {
        const s = initialInput();
        expect(pressKey(s, 'a').state).toEqual(s);
    });

    it('first shows the cursor at row 3, col 3 and does nothing else (an arrow does not move it yet)', () => {
        const out = pressKey(initialInput(), 'ArrowRight');
        expect(out.state.cursorVisible).toBe(true);
        expect(out.state.cursor).toEqual(pos(3, 3));
        expect(out.state.selected).toBeNull();
        expect(out.swap).toBeUndefined();
    });

    it('shows the cursor on the last touched stone after pointer use', () => {
        const s = tapStone(initialInput(), pos(5, 1)).state; // selected (5,1) and lastTouched (5,1)
        const swiped = swipeFrom(s, pos(6, 6)); // clears the selection, lastTouched (6,6)
        expect(pressKey(swiped, ' ').state.cursor).toEqual(pos(6, 6));
    });

    it('shows the cursor on the selected stone first (the selection is kept)', () => {
        const s: InputState = { ...initialInput(), selected: pos(2, 5), lastTouched: pos(0, 0) };
        const out = pressKey(s, 'ArrowDown');
        expect(out.state.cursor).toEqual(pos(2, 5));
        expect(out.state.selected).toEqual(pos(2, 5));
        expect(out.swap).toBeUndefined();
    });

    it('moves the cursor by arrows and stops at the edges (no wrap-around)', () => {
        expect(pressKey(shown(pos(3, 3)), 'ArrowRight').state.cursor).toEqual(pos(3, 4));
        expect(pressKey(shown(pos(3, 3)), 'ArrowLeft').state.cursor).toEqual(pos(3, 2));
        expect(pressKey(shown(pos(3, 3)), 'ArrowUp').state.cursor).toEqual(pos(2, 3));
        expect(pressKey(shown(pos(3, 3)), 'ArrowDown').state.cursor).toEqual(pos(4, 3));
        expect(pressKey(shown(pos(0, 0)), 'ArrowLeft').state.cursor).toEqual(pos(0, 0));
        expect(pressKey(shown(pos(0, 0)), 'ArrowUp').state.cursor).toEqual(pos(0, 0));
        expect(pressKey(shown(pos(7, 7)), 'ArrowRight').state.cursor).toEqual(pos(7, 7));
        expect(pressKey(shown(pos(7, 7)), 'ArrowDown').state.cursor).toEqual(pos(7, 7));
    });

    it('selects the cursor stone with Space or Enter, and unselects it with the same key again', () => {
        const selected = pressKey(shown(), ' ').state;
        expect(selected.selected).toEqual(pos(3, 3));
        expect(pressKey(selected, ' ').state.selected).toBeNull();
        expect(pressKey(shown(), 'Enter').state.selected).toEqual(pos(3, 3));
    });

    it('swaps the selected stone with the neighbour an arrow points to; the cursor stays on the origin', () => {
        const out = pressKey(shown(pos(3, 3), pos(3, 3)), 'ArrowRight');
        expect(out.swap).toEqual([pos(3, 3), pos(3, 4)]);
        expect(out.state.selected).toBeNull();
        expect(out.state.cursor).toEqual(pos(3, 3));
    });

    it('does nothing and keeps the selection when the arrow points off the board', () => {
        const s = shown(pos(0, 0), pos(0, 0));
        const out = pressKey(s, 'ArrowUp');
        expect(out.swap).toBeUndefined();
        expect(out.state.selected).toEqual(pos(0, 0));
        expect(out.state.cursor).toEqual(pos(0, 0));
    });

    it('unselects with Escape', () => {
        expect(pressKey(shown(pos(3, 3), pos(3, 3)), 'Escape').state.selected).toBeNull();
    });

    it('hides the cursor again when the pointer is used, and the next key shows it where it was touched', () => {
        const moved = pressKey(shown(pos(1, 1)), 'ArrowRight').state; // cursor (1,2)
        const touched = tapStone(moved, pos(6, 4)).state;
        expect(touched.cursorVisible).toBe(false);
        expect(pressKey(touched, 'ArrowLeft').state.cursor).toEqual(pos(6, 4));
    });
});
