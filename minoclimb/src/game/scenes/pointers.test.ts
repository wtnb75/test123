import { describe, expect, it } from 'vitest';
import type { Input } from 'phaser';
import type { PointerState } from '../logic/input';
import { readPointers } from './pointers';

interface FakePointer {
    id: number;
    x: number;
    y: number;
    downX: number;
    downY: number;
    isDown: boolean;
    primaryDown: boolean;
}

const manager = (...pointers: FakePointer[]): Input.InputManager =>
    ({ pointers }) as unknown as Input.InputManager;

const pointer = (id: number, over: Partial<FakePointer> = {}): FakePointer => ({
    id, x: 10, y: 12, downX: 5, downY: 7, isDown: false, primaryDown: false, ...over,
});

describe('readPointers', () => {
    it('copies position, press origin and id', () => {
        const out: PointerState[] = [];
        readPointers(manager(pointer(2, { x: 40, y: 50, downX: 30, downY: 20, isDown: true, primaryDown: true })), out);
        expect(out).toEqual([{ id: 2, x: 40, y: 50, downX: 30, downY: 20, isDown: true }]);
    });

    it('does not count a non-primary mouse button as a press', () => {
        // Phaser sets isDown for a right click but leaves downX / downY at the last primary press.
        const out = readPointers(manager(pointer(0, { isDown: true, primaryDown: false })), []);
        expect(out[0].isDown).toBe(false);
    });

    it('reuses the same objects and trims stale entries', () => {
        const out: PointerState[] = [];
        readPointers(manager(pointer(0), pointer(1), pointer(2)), out);
        const first = out[0];
        readPointers(manager(pointer(0, { isDown: true, primaryDown: true })), out);
        expect(out).toHaveLength(1);
        expect(out[0]).toBe(first);
        expect(out[0].isDown).toBe(true);
    });
});
