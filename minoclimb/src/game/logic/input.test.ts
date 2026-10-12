import { describe, expect, it } from 'vitest';
import { P } from '../params';
import {
    InputArbiter, RETRY_KEYS, START_KEYS, wasPressed, type PointerState, type RawInput,
} from './input';

const HALF = 180;
const DZ = P.STICK_DEADZONE;

const arbiter = (): InputArbiter => new InputArbiter(HALF, DZ, P.STICK_RING_RADIUS);
const keys = (...codes: string[]): ReadonlySet<string> => new Set(codes);
const finger = (id: number, downX: number, x = downX, downY = 300): PointerState => ({
    id, x, downX, downY, isDown: true,
});
const up = (id: number): PointerState => ({ id, x: 0, downX: 0, downY: 0, isDown: false });
const raw = (k: ReadonlySet<string> = keys(), ...pointers: PointerState[]): RawInput => ({
    keys: k, pointers, pressedKeys: keys(), pointerPressed: false,
});
const withPresses = (r: RawInput, pressed: string[] = [], pointerPressed = false): RawInput => ({
    ...r, pressedKeys: new Set(pressed), pointerPressed,
});

describe('InputArbiter: keyboard', () => {
    it('maps the arrow keys and A / D / W / Space', () => {
        const a = arbiter();
        expect(a.read(raw(keys('ArrowLeft'))).move).toEqual({ left: true, right: false, jump: false });
        expect(a.read(raw(keys('KeyA'))).move.left).toBe(true);
        expect(a.read(raw(keys('ArrowRight'))).move.right).toBe(true);
        expect(a.read(raw(keys('KeyD'))).move.right).toBe(true);
        expect(a.read(raw(keys('ArrowUp'))).move.jump).toBe(true);
        expect(a.read(raw(keys('KeyW'))).move.jump).toBe(true);
        expect(a.read(raw(keys('Space'))).move.jump).toBe(true);
    });

    it('reports nothing for unrelated keys or no input', () => {
        const a = arbiter();
        expect(a.read(raw(keys('KeyQ', 'Enter'))).move).toEqual({ left: false, right: false, jump: false });
        expect(a.read(raw()).stick).toBeNull();
    });

    it('cancels left and right pressed together, including across keyboard and touch', () => {
        const a = arbiter();
        expect(a.read(raw(keys('ArrowLeft', 'ArrowRight'))).move).toMatchObject({ left: false, right: false });
        expect(a.read(raw(keys('KeyA', 'ArrowRight'))).move).toMatchObject({ left: false, right: false });
        const mixed = a.read(raw(keys('ArrowLeft'), finger(1, 100, 150)));
        expect(mixed.move).toMatchObject({ left: false, right: false });
    });

    it('ignores keys that were held when blockHeld was called until they are released', () => {
        const a = arbiter();
        a.blockHeld(raw(keys('Space', 'ArrowRight')));
        expect(a.read(raw(keys('Space', 'ArrowRight'))).move).toEqual({ left: false, right: false, jump: false });
        expect(a.read(raw(keys('Space'))).move.jump).toBe(false); // still held
        expect(a.read(raw()).move.jump).toBe(false); // released
        expect(a.read(raw(keys('Space'))).move.jump).toBe(true); // pressed again: counts
        expect(a.read(raw(keys('ArrowRight'))).move.right).toBe(true);
    });

    it('does not block keys pressed after blockHeld', () => {
        const a = arbiter();
        a.blockHeld(raw(keys('KeyA')));
        expect(a.read(raw(keys('KeyA', 'ArrowUp'))).move).toEqual({ left: false, right: false, jump: true });
    });
});

describe('InputArbiter: touch stick', () => {
    const readDx = (dx: number): ReturnType<InputArbiter['read']> =>
        arbiter().read(raw(keys(), finger(1, 100, 100 + dx)));

    it('gives no input at exactly the deadzone on either side', () => {
        expect(readDx(DZ).move).toEqual({ left: false, right: false, jump: false });
        expect(readDx(-DZ).move).toEqual({ left: false, right: false, jump: false });
    });

    it('moves right just past the deadzone and left just past the negative deadzone', () => {
        expect(readDx(DZ + 1).move).toMatchObject({ left: false, right: true });
        expect(readDx(-DZ - 1).move).toMatchObject({ left: true, right: false });
    });

    it('keeps the stick view anchored at the first touch and clamps the knob to the ring', () => {
        const stick = readDx(500).stick;
        expect(stick).toEqual({ anchorX: 100, anchorY: 300, knobDx: P.STICK_RING_RADIUS });
        expect(readDx(-500).stick?.knobDx).toBe(-P.STICK_RING_RADIUS);
        expect(readDx(7).stick?.knobDx).toBe(7);
    });

    it('treats a touch at exactly half the width as the jump half', () => {
        const a = arbiter();
        const r = a.read(raw(keys(), finger(1, HALF, HALF + 100)));
        expect(r.move).toEqual({ left: false, right: false, jump: true });
        expect(r.stick).toBeNull();
    });

    it('treats a touch just left of half the width as the stick', () => {
        const r = arbiter().read(raw(keys(), finger(1, HALF - 1, HALF - 1 + 50)));
        expect(r.move.right).toBe(true);
        expect(r.move.jump).toBe(false);
    });

    it('jumps while any right-half finger is down', () => {
        const a = arbiter();
        expect(a.read(raw(keys(), finger(1, 300))).move.jump).toBe(true);
        expect(a.read(raw(keys(), up(1))).move.jump).toBe(false);
    });

    it('keeps a finger in the half it started in, wherever it moves', () => {
        const a = arbiter();
        // Starts left, drags far into the right half: still the stick, not a jump.
        const r = a.read(raw(keys(), finger(1, 100, 320)));
        expect(r.move).toEqual({ left: false, right: true, jump: false });
        // Starts right, drags into the left half: still a jump, no stick.
        const b = arbiter().read(raw(keys(), finger(2, 300, 20)));
        expect(b.move).toEqual({ left: false, right: false, jump: true });
        expect(b.stick).toBeNull();
    });

    it('lets the left stick and a right jump finger work together', () => {
        const r = arbiter().read(raw(keys(), finger(1, 100, 60), finger(2, 300)));
        expect(r.move).toEqual({ left: true, right: false, jump: true });
    });

    it('uses only the first left-half finger as the stick', () => {
        const a = arbiter();
        a.read(raw(keys(), finger(1, 100, 100)));
        // A second left finger far to the right of its start would move right, but it is ignored.
        const r = a.read(raw(keys(), finger(1, 100, 100 - 50), finger(2, 60, 200)));
        expect(r.move.left).toBe(true);
        expect(r.move.right).toBe(false);
    });

    it('does not promote an ignored finger when the stick finger lifts', () => {
        const a = arbiter();
        a.read(raw(keys(), finger(1, 100, 100), finger(2, 60, 60)));
        const r = a.read(raw(keys(), up(1), finger(2, 60, 200)));
        expect(r.move).toEqual({ left: false, right: false, jump: false });
        expect(r.stick).toBeNull();
    });

    it('lets a newly touched left finger become the stick after the previous one lifted', () => {
        const a = arbiter();
        a.read(raw(keys(), finger(1, 100, 100), finger(2, 60, 60)));
        a.read(raw(keys(), up(1), finger(2, 60, 60)));
        const r = a.read(raw(keys(), finger(3, 120, 200)));
        expect(r.move.right).toBe(true);
    });

    it('ignores fingers already down at blockHeld until they lift, then accepts a new touch on the same id', () => {
        const a = arbiter();
        a.blockHeld(raw(keys(), finger(1, 100, 100), finger(2, 300)));
        expect(a.read(raw(keys(), finger(1, 100, 200), finger(2, 300))).move)
            .toEqual({ left: false, right: false, jump: false });
        a.read(raw(keys(), up(1), up(2)));
        expect(a.read(raw(keys(), finger(1, 100, 200))).move.right).toBe(true);
        expect(a.read(raw(keys(), finger(1, 100, 200), finger(2, 300))).move.jump).toBe(true);
    });

    it('does not let a blocked finger be the stick; a genuinely new left finger is', () => {
        const a = arbiter();
        a.blockHeld(raw(keys(), finger(1, 100, 100)));
        expect(a.read(raw(keys(), finger(1, 100, 50))).stick).toBeNull(); // blocked finger drags left: nothing
        // A new left finger drags right while the blocked one still drags left.
        const r = a.read(raw(keys(), finger(1, 100, 50), finger(2, 80, 140)));
        expect(r.move).toEqual({ left: false, right: true, jump: false });
        expect(r.stick?.anchorX).toBe(80);
    });
});

describe('wasPressed', () => {
    it('is false when nothing was pressed since the previous read', () => {
        expect(wasPressed(raw(), START_KEYS)).toBe(false);
        // A key that is merely held (no fresh key-down) is not a press.
        expect(wasPressed(raw(keys('Space')), START_KEYS)).toBe(false);
        expect(wasPressed(raw(keys(), finger(1, 10)), START_KEYS)).toBe(false);
    });

    it('is true for a fresh key-down in the list, even if the key is already up again', () => {
        expect(wasPressed(withPresses(raw(), ['Enter']), START_KEYS)).toBe(true);
        expect(wasPressed(withPresses(raw(), ['Space']), START_KEYS)).toBe(true);
        expect(wasPressed(withPresses(raw(), ['KeyR']), RETRY_KEYS)).toBe(true);
    });

    it('ignores fresh key-downs outside the list', () => {
        expect(wasPressed(withPresses(raw(), ['KeyA', 'ArrowUp']), RETRY_KEYS)).toBe(false);
        expect(wasPressed(withPresses(raw(), ['Enter']), RETRY_KEYS)).toBe(false);
    });

    it('is true for a fresh primary pointer press, whatever the key list', () => {
        expect(wasPressed(withPresses(raw(), [], true), START_KEYS)).toBe(true);
        expect(wasPressed(withPresses(raw(), [], true), [])).toBe(true);
    });
});
