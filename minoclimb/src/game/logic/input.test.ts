import { describe, expect, it } from 'vitest';
import { P } from '../params';
import {
    InputArbiter, RETRY_KEYS, START_KEYS, wasPressed, type PointerState, type RawInput,
} from './input';

const HALF = 180;
const DZ = P.STICK_DEADZONE;

const RING = P.STICK_RING_RADIUS;
const FLICK = P.STICK_JUMP_FLICK;
const RELEASE = P.STICK_JUMP_RELEASE;

const arbiter = (): InputArbiter => new InputArbiter(HALF, DZ, RING, FLICK, RELEASE);
const keys = (...codes: string[]): ReadonlySet<string> => new Set(codes);
const finger = (id: number, downX: number, x = downX, downY = 300, y = downY): PointerState => ({
    id, x, y, downX, downY, isDown: true,
});
const up = (id: number): PointerState => ({ id, x: 0, y: 0, downX: 0, downY: 0, isDown: false });
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

    it('starts the stick view at the first touch and keeps the knob inside the ring', () => {
        expect(readDx(7).stick).toEqual({ anchorX: 100, anchorY: 300, knobDx: 7, knobDy: 0 });
        expect(readDx(RING).stick).toEqual({ anchorX: 100, anchorY: 300, knobDx: RING, knobDy: 0 });
        // A far-away finger drags the anchor along instead of the knob leaving the ring.
        expect(readDx(500).stick).toEqual({ anchorX: 572, anchorY: 300, knobDx: RING, knobDy: 0 });
        expect(readDx(-500).stick).toEqual({ anchorX: -372, anchorY: 300, knobDx: -RING, knobDy: 0 });
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
        // The anchor started at 80 and followed the finger at 140 to stay one ring radius behind it.
        expect(r.stick?.anchorX).toBe(112);
    });
});

// Hand-worked from the spec: anchor (100, 300), DEADZONE 10, RING 28, FLICK 28, RELEASE 14.
describe('InputArbiter: stick anchor follows the finger', () => {
    const at = (a: InputArbiter, x: number, y = 300): ReturnType<InputArbiter['read']> =>
        a.read(raw(keys(), finger(1, 100, x, 300, y)));

    it('does not move the anchor until the finger is more than the ring radius away', () => {
        expect(at(arbiter(), 100 + RING).stick).toMatchObject({ anchorX: 100, knobDx: RING });
        expect(at(arbiter(), 100 + RING + 1).stick).toMatchObject({ anchorX: 101, knobDx: RING });
        expect(at(arbiter(), 100 - RING).stick).toMatchObject({ anchorX: 100, knobDx: -RING });
        expect(at(arbiter(), 100 - RING - 1).stick).toMatchObject({ anchorX: 99, knobDx: -RING });
    });

    it('reverses with a 39 px move after following to the right, but not with 38 px', () => {
        const a = arbiter();
        expect(at(a, 200).stick?.anchorX).toBe(172);
        const back38 = at(a, 162);
        expect(back38.move).toMatchObject({ left: false, right: false });
        expect(back38.stick?.knobDx).toBe(-DZ);
        expect(at(a, 161).move).toMatchObject({ left: true, right: false });
    });

    it('reverses with a 39 px move after following to the left as well', () => {
        const a = arbiter();
        expect(at(a, 0).stick?.anchorX).toBe(28);
        expect(at(a, 38).move).toMatchObject({ left: false, right: false });
        expect(at(a, 39).move).toMatchObject({ left: false, right: true });
    });

    it('judges a single huge jump of the finger by the offset after following', () => {
        const r = at(arbiter(), 300);
        expect(r.move).toMatchObject({ left: false, right: true });
        expect(r.stick).toMatchObject({ anchorX: 272, knobDx: RING });
    });

    it('follows downwards but not upwards', () => {
        const a = arbiter();
        expect(at(a, 100, 300 + RING).stick).toMatchObject({ anchorY: 300, knobDy: RING });
        expect(at(a, 100, 300 + RING + 1).stick).toMatchObject({ anchorY: 301, knobDy: RING });
        const b = arbiter();
        // 40 px above the anchor: the anchor stays, the knob is held at the ring edge.
        expect(at(b, 100, 260).stick).toMatchObject({ anchorY: 300, knobDy: -RING });
    });

    it('keeps the finger as the stick when the anchor leaves the left half', () => {
        const a = arbiter();
        at(a, 500);
        const r = at(a, 500);
        expect(r.stick?.anchorX).toBe(472);
        expect(r.move).toMatchObject({ right: true, jump: false });
    });
});

describe('InputArbiter: flicking the stick up jumps', () => {
    const at = (a: InputArbiter, y: number, x = 100): ReturnType<InputArbiter['read']> =>
        a.read(raw(keys(), finger(1, 100, x, 300, y)));

    it('needs to pass the flick distance: exactly 28 px up does not jump, 29 px does', () => {
        expect(at(arbiter(), 300 - FLICK).move.jump).toBe(false);
        expect(at(arbiter(), 300 - FLICK - 1).move.jump).toBe(true);
    });

    it('stays on until the finger comes back inside the release distance (hysteresis)', () => {
        const a = arbiter();
        expect(at(a, 271).move.jump).toBe(true);
        expect(at(a, 300 - RELEASE - 1).move.jump).toBe(true); // 15 px up
        expect(at(a, 300 - RELEASE).move.jump).toBe(false); // 14 px up
        expect(at(a, 285).move.jump).toBe(false); // 15 px up again does not turn it back on
        expect(at(a, 271).move.jump).toBe(true); // flicked again
    });

    it('moves and jumps together on a diagonal, and jumps alone when the sideways offset is within the deadzone', () => {
        const diagonal = at(arbiter(), 270, 120);
        expect(diagonal.move).toEqual({ left: false, right: true, jump: true });
        const straightUp = at(arbiter(), 270, 105);
        expect(straightUp.move).toEqual({ left: false, right: false, jump: true });
    });

    it('measures the flick from the anchor after it followed the finger down', () => {
        const a = arbiter();
        expect(at(a, 329).stick?.anchorY).toBe(301);
        expect(at(a, 273).move.jump).toBe(false); // 28 px above the new anchor
        expect(at(a, 272).move.jump).toBe(true);
    });

    it('shows the knob moving up with the flick', () => {
        expect(at(arbiter(), 285).stick).toMatchObject({ knobDx: 0, knobDy: -15 });
    });

    it('drops the jump when the finger lifts', () => {
        const a = arbiter();
        expect(at(a, 271).move.jump).toBe(true);
        expect(a.read(raw(keys(), up(1))).move.jump).toBe(false);
    });

    it('starts a new stick finger as not flicked, so 20 px up on its first frame (inside the flick distance) is no jump', () => {
        const a = arbiter();
        expect(at(a, 271).move.jump).toBe(true);
        a.read(raw(keys(), up(1)));
        expect(a.read(raw(keys(), finger(2, 100, 100, 300, 280))).move.jump).toBe(false);
    });

    it('combines with the right-half finger and the keys as an OR', () => {
        const a = arbiter();
        const both = a.read(raw(keys(), finger(1, 100, 100, 300, 271), finger(2, 300)));
        expect(both.move.jump).toBe(true);
        // The right finger lifts while the stick is still flicked: jump input does not drop.
        expect(a.read(raw(keys(), finger(1, 100, 100, 300, 271), up(2))).move.jump).toBe(true);
        const withKey = arbiter().read(raw(keys('Space'), finger(1, 100, 100, 300, 300)));
        expect(withKey.move.jump).toBe(true);
    });

    it('does not jump from a flick by a finger held at blockHeld or a second left-half finger', () => {
        const a = arbiter();
        a.blockHeld(raw(keys(), finger(1, 100, 100, 300, 300)));
        expect(a.read(raw(keys(), finger(1, 100, 100, 300, 250))).move.jump).toBe(false);
        // A fresh stick finger exists now; a further left finger flicking is ignored.
        const r = a.read(raw(keys(), finger(1, 100, 100, 300, 250), finger(2, 80, 80, 300, 300), finger(3, 60, 60, 300, 250)));
        expect(r.move.jump).toBe(false);
    });

    it('keeps the right-half tap jump and keyboard jump working without the stick', () => {
        const a = arbiter();
        expect(a.read(raw(keys(), finger(1, 300))).move.jump).toBe(true);
        expect(a.read(raw(keys(), up(1))).move.jump).toBe(false);
        expect(a.read(raw(keys('KeyW'))).move.jump).toBe(true);
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
