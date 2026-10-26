import { describe, expect, it } from 'vitest';
import { P } from '../params';
import {
    InputArbiter, RETRY_KEYS, START_KEYS, wasPressed,
    type PointerState, type QuickTap, type RawInput, type ReadResult,
} from './input';

const DZ = P.STICK_DEADZONE;

const RING = P.STICK_RING_RADIUS;
const FLICK = P.STICK_JUMP_FLICK;
const RELEASE = P.STICK_JUMP_RELEASE;
const SLOP = P.TAP_SLOP;
const FRAME = 1 / 60;

/** An arbiter whose `read` defaults to one 60 fps frame. */
const arbiter = (): Arb => {
    const a = new InputArbiter({
        deadzone: DZ, ringRadius: RING, jumpFlick: FLICK, jumpRelease: RELEASE,
        tapMaxTime: P.TAP_MAX_TIME, tapSlop: SLOP, tapJumpHold: P.TAP_JUMP_HOLD,
    });
    return {
        read: (r: RawInput, dt: number = FRAME): ReadResult => a.read(r, dt),
        blockHeld: (r: RawInput): void => a.blockHeld(r),
    };
};
interface Arb {
    read(r: RawInput, dt?: number): ReadResult;
    blockHeld(r: RawInput): void;
}
const keys = (...codes: string[]): ReadonlySet<string> => new Set(codes);
const finger = (id: number, downX: number, x = downX, downY = 300, y = downY): PointerState => ({
    id, x, y, downX, downY, isDown: true,
});
/** A finger that is no longer down; `x` / `y` are where it was lifted. */
const up = (id: number, x = 0, y = 0, downX = 0, downY = 0): PointerState => ({
    id, x, y, downX, downY, isDown: false,
});
const raw = (k: ReadonlySet<string> = keys(), ...pointers: PointerState[]): RawInput => ({
    keys: k, pointers, pressedKeys: keys(), pointerPressed: false, pressPoints: [], quickTaps: [], cancelled: new Set(),
});
const rawWith = (extra: { quickTaps?: QuickTap[]; cancelled?: number[] }, ...pointers: PointerState[]): RawInput => ({
    ...raw(keys(), ...pointers), quickTaps: extra.quickTaps ?? [], cancelled: new Set(extra.cancelled ?? []),
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
    const readDx = (dx: number): ReadResult =>
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

    it.each([0, 100, 179, 180, 181, 359, 360])('makes a first finger touching at x = %i the stick (no left / right halves)', (x) => {
        const r = arbiter().read(raw(keys(), finger(1, x, x + 50)));
        expect(r.move).toEqual({ left: false, right: true, jump: false });
        expect(r.stick).not.toBeNull();
    });

    it('keeps the stick finger the stick wherever it moves', () => {
        const r = arbiter().read(raw(keys(), finger(1, 100, 320)));
        expect(r.move).toEqual({ left: false, right: true, jump: false });
        expect(r.stick).not.toBeNull();
    });

    it('lets a second finger jump while it touches, wherever it is, and stop when it lifts', () => {
        const a = arbiter();
        a.read(raw(keys(), finger(1, 100)));
        expect(a.read(raw(keys(), finger(1, 100), finger(2, 300))).move.jump).toBe(true);
        expect(a.read(raw(keys(), finger(1, 100), finger(2, 300, 5, 300, 5))).move.jump).toBe(true);
        expect(a.read(raw(keys(), finger(1, 100), up(2))).move.jump).toBe(false);
    });

    it('lets the stick and a second jump finger work together', () => {
        const r = arbiter().read(raw(keys(), finger(1, 100, 60), finger(2, 300)));
        expect(r.move).toEqual({ left: true, right: false, jump: true });
    });

    it('treats every finger after the first as a jump finger, not a stick', () => {
        const a = arbiter();
        a.read(raw(keys(), finger(1, 100, 100)));
        // A second finger far to the right of its start would move right if it were a stick.
        const r = a.read(raw(keys(), finger(1, 100, 100 - 50), finger(2, 60, 200), finger(3, 20)));
        expect(r.move).toEqual({ left: true, right: false, jump: true });
    });

    it('keeps a jump finger jumping after the stick finger lifts, and gives no stick', () => {
        const a = arbiter();
        a.read(raw(keys(), finger(1, 100, 100), finger(2, 60, 60)));
        const r = a.read(raw(keys(), up(1, 100, 300, 100, 300), finger(2, 60, 200)));
        expect(r.move).toEqual({ left: false, right: false, jump: true });
        expect(r.stick).toBeNull();
    });

    it('lets a newly touched finger become the stick after the previous one lifted', () => {
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

    it('does not let a blocked finger be the stick; a genuinely new finger is', () => {
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
    const at = (a: Arb, x: number, y = 300): ReadResult =>
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

    it('keeps the finger as the stick when the anchor moves off screen', () => {
        const a = arbiter();
        at(a, 500);
        const r = at(a, 500);
        expect(r.stick?.anchorX).toBe(472);
        expect(r.move).toMatchObject({ right: true, jump: false });
    });
});

describe('InputArbiter: flicking the stick up jumps', () => {
    const at = (a: Arb, y: number, x = 100): ReadResult =>
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

    it('combines with a jump finger and the keys as an OR', () => {
        const a = arbiter();
        const both = a.read(raw(keys(), finger(1, 100, 100, 300, 271), finger(2, 300)));
        expect(both.move.jump).toBe(true);
        // The right finger lifts while the stick is still flicked: jump input does not drop.
        expect(a.read(raw(keys(), finger(1, 100, 100, 300, 271), up(2))).move.jump).toBe(true);
        const withKey = arbiter().read(raw(keys('Space'), finger(1, 100, 100, 300, 300)));
        expect(withKey.move.jump).toBe(true);
    });

    it('does not jump from a flick by a finger held at blockHeld', () => {
        const a = arbiter();
        a.blockHeld(raw(keys(), finger(1, 100, 100, 300, 300)));
        expect(a.read(raw(keys(), finger(1, 100, 100, 300, 250))).move.jump).toBe(false);
    });

    it('keeps the keyboard jump working without the stick', () => {
        const a = arbiter();
        expect(a.read(raw(keys('KeyW'))).move.jump).toBe(true);
    });
});

// Hand-worked from the spec: touch point (100, 600), TAP_MAX_TIME 0.25, TAP_SLOP 10, TAP_JUMP_HOLD 0.1.
describe('InputArbiter: tap', () => {
    const down = (x = 100, y = 600): PointerState => finger(1, 100, x, 600, y);
    const lifted = (x = 100, y = 600): PointerState => up(1, x, y, 100, 600);
    /** Touch at frame 0 (elapsed 0), hold for `n` more frames of dt, then lift at the next frame. */
    const tapAfter = (heldFrames: number, dt: number, liftAt: PointerState = lifted()): { a: Arb; release: ReadResult } => {
        const a = arbiter();
        a.read(raw(keys(), down()), dt);
        for (let i = 0; i < heldFrames; i++) a.read(raw(keys(), down()), dt);
        return { a, release: a.read(raw(keys(), liftAt), dt) };
    };

    it('jumps from the frame the finger lifts, for a still, quick, lone finger', () => {
        const { release } = tapAfter(3, FRAME);
        expect(release.move).toEqual({ left: false, right: false, jump: true });
        expect(release.stick).toBeNull();
    });

    it('gives nothing while a still finger is merely held (before the lift)', () => {
        const a = arbiter();
        for (let i = 0; i < 5; i++) expect(a.read(raw(keys(), down())).move).toEqual({ left: false, right: false, jump: false });
    });

    it('counts a tap that lifts at exactly TAP_MAX_TIME (one 0.25 s frame) and rejects 0.26 s', () => {
        expect(tapAfter(0, 0.25).release.move.jump).toBe(true);
        expect(tapAfter(0, 0.26).release.move.jump).toBe(false);
    });

    it('measures the time as a sum of frame times: fifteen 1/60 s frames are a tap, sixteen are not', () => {
        expect(tapAfter(14, FRAME).release.move.jump).toBe(true); // touch frame is 0; 15 frames of dt = 0.25
        expect(tapAfter(15, FRAME).release.move.jump).toBe(false); // 16 frames
    });

    it('ignores a long press: no input at any time, and none on the lift', () => {
        const a = arbiter();
        a.read(raw(keys(), down()), 1);
        expect(a.read(raw(keys(), down()), 1).move).toEqual({ left: false, right: false, jump: false });
        expect(a.read(raw(keys(), lifted()), 1).move).toEqual({ left: false, right: false, jump: false });
    });

    it('counts a lift exactly TAP_SLOP away from the touch point and rejects 1 px more, on either axis', () => {
        expect(tapAfter(1, FRAME, lifted(100 + SLOP)).release.move.jump).toBe(true);
        expect(tapAfter(1, FRAME, lifted(100, 600 - SLOP)).release.move.jump).toBe(true);
        expect(tapAfter(1, FRAME, lifted(100 + SLOP + 1)).release.move.jump).toBe(false);
        expect(tapAfter(1, FRAME, lifted(100, 600 - SLOP - 1)).release.move.jump).toBe(false);
    });

    it('measures the slop as a straight line, from the touch point and not from the following anchor', () => {
        expect(tapAfter(1, FRAME, lifted(107, 607)).release.move.jump).toBe(true); // 9.9 px
        expect(tapAfter(1, FRAME, lifted(108, 608)).release.move.jump).toBe(false); // 11.3 px
    });

    it('is no tap once the finger went further than the slop, even if it came back', () => {
        const a = arbiter();
        a.read(raw(keys(), down()));
        a.read(raw(keys(), down(130)));
        a.read(raw(keys(), down(100)));
        expect(a.read(raw(keys(), lifted())).move.jump).toBe(false);
    });

    it('is no tap when a flick made the jump state on', () => {
        const a = arbiter();
        a.read(raw(keys(), down()));
        expect(a.read(raw(keys(), down(100, 571))).move.jump).toBe(true);
        expect(a.read(raw(keys(), lifted(100, 600))).move.jump).toBe(false);
    });

    it('stops the pulse after TAP_JUMP_HOLD: on through 0.09 s, off at 0.1 s', () => {
        const { a } = tapAfter(1, FRAME);
        // The lift frame is time 0; five more frames bring it to 5/60 = 0.083 s, the sixth to 0.1 s.
        for (let i = 1; i <= 5; i++) expect(a.read(raw(), FRAME).move.jump).toBe(true);
        expect(a.read(raw(), FRAME).move.jump).toBe(false);
        expect(a.read(raw(), FRAME).move.jump).toBe(false);
    });

    it('restarts the pulse at a second tap that lifts in the middle of the first', () => {
        const { a } = tapAfter(1, FRAME);
        for (let i = 0; i < 3; i++) a.read(raw(), FRAME); // 3/60 s into the pulse
        a.read(raw(keys(), down()), FRAME);
        expect(a.read(raw(keys(), lifted()), FRAME).move.jump).toBe(true); // second lift: pulse restarts
        for (let i = 1; i <= 5; i++) expect(a.read(raw(), FRAME).move.jump).toBe(true);
        expect(a.read(raw(), FRAME).move.jump).toBe(false);
    });

    it('is no tap when a second finger newly touched during the stick finger\'s life', () => {
        const a = arbiter();
        a.read(raw(keys(), down()));
        a.read(raw(keys(), down(), finger(2, 300)));
        a.read(raw(keys(), down(), up(2)));
        const r = a.read(raw(keys(), lifted()));
        expect(r.move.jump).toBe(false);
    });

    it('does not count a jump finger that was already down before the new stick finger touched', () => {
        const a = arbiter();
        a.read(raw(keys(), finger(5, 10), finger(6, 20))); // 5 = stick, 6 = jump
        a.read(raw(keys(), up(5, 10, 300, 10, 300), finger(6, 20))); // stick lifts; 6 stays a jump finger
        a.read(raw(keys(), finger(6, 20), down()));
        const r = a.read(raw(keys(), finger(6, 20), lifted()));
        expect(r.move.jump).toBe(true); // the jump finger 6 still holds jump...
        const after = a.read(raw(keys(), up(6)), FRAME);
        expect(after.move.jump).toBe(true); // ...and the tap's pulse carries on after 6 lifts
        for (let i = 0; i < 6; i++) a.read(raw(), FRAME);
        expect(a.read(raw(), FRAME).move.jump).toBe(false);
    });

    it('is no tap when the finger vanished without a normal release (cancel)', () => {
        const a = arbiter();
        a.read(raw(keys(), down()));
        expect(a.read(rawWith({ cancelled: [1] }, lifted())).move.jump).toBe(false);
    });

    it('is a tap for a normal release, and the cancelled set of another finger does not matter', () => {
        const a = arbiter();
        a.read(raw(keys(), down()));
        expect(a.read(rawWith({ cancelled: [9] }, lifted())).move.jump).toBe(true);
    });

    it('never makes a tap from a finger held at blockHeld, and the lift does not jump', () => {
        const a = arbiter();
        a.blockHeld(raw(keys(), down()));
        a.read(raw(keys(), down()));
        expect(a.read(raw(keys(), lifted())).move.jump).toBe(false);
    });

    it('clears a running pulse when blockHeld is called', () => {
        const { a } = tapAfter(1, FRAME);
        a.blockHeld(raw());
        expect(a.read(raw()).move.jump).toBe(false);
    });

    it('gives a tap-jump press that a wall kick can use: no jump before the lift, jump at the lift', () => {
        const a = arbiter();
        expect(a.read(raw(keys(), down())).move.jump).toBe(false);
        expect(a.read(raw(keys(), lifted())).move.jump).toBe(true);
    });

    it('does not turn a short tap with a movement past the dead zone into a tap, but still moves while held', () => {
        const a = arbiter();
        a.read(raw(keys(), down()));
        expect(a.read(raw(keys(), down(120))).move).toMatchObject({ right: true, jump: false });
        expect(a.read(raw(keys(), lifted(120))).move.jump).toBe(false);
    });
});

describe('InputArbiter: presses shorter than a frame (quick taps)', () => {
    const quick = (downX = 100, downY = 600, x = downX, y = downY): QuickTap => ({ id: 1, downX, downY, x, y });

    it('starts the tap pulse for a still quick tap with no finger down', () => {
        const a = arbiter();
        expect(a.read(rawWith({ quickTaps: [quick()] })).move.jump).toBe(true);
        for (let i = 1; i <= 5; i++) expect(a.read(raw(), FRAME).move.jump).toBe(true);
        expect(a.read(raw(), FRAME).move.jump).toBe(false);
    });

    it('rejects a quick tap that ended further than the slop from where it began', () => {
        const a = arbiter();
        expect(a.read(rawWith({ quickTaps: [quick(100, 600, 100 + SLOP + 1)] })).move.jump).toBe(false);
        expect(a.read(rawWith({ quickTaps: [quick(100, 600, 100 + SLOP)] })).move.jump).toBe(true);
    });

    it('gives a one-frame jump for a quick second finger, and spoils the stick finger\'s tap', () => {
        const a = arbiter();
        a.read(raw(keys(), finger(2, 100, 100, 600, 600)));
        const r = a.read(rawWith({ quickTaps: [quick(300, 300)] }, finger(2, 100, 100, 600, 600)));
        expect(r.move.jump).toBe(true);
        expect(a.read(raw(keys(), finger(2, 100, 100, 600, 600))).move.jump).toBe(false);
        expect(a.read(raw(keys(), up(2, 100, 600, 100, 600))).move.jump).toBe(false);
    });

    it('treats a quick tap in the frame the stick finger lifts as a new tap (the lift happens first)', () => {
        const a = arbiter();
        a.read(raw(keys(), finger(2, 100, 100, 600, 600)));
        a.read(raw(keys(), finger(2, 100, 140, 600, 600))); // moved: no tap for finger 2
        const r = a.read(rawWith({ quickTaps: [quick()] }, up(2, 140, 600, 100, 600)));
        expect(r.move.jump).toBe(true);
        // It is a whole tap (a pulse), not the one-frame jump of a second finger.
        for (let i = 1; i <= 5; i++) expect(a.read(raw(), FRAME).move.jump).toBe(true);
        expect(a.read(raw(), FRAME).move.jump).toBe(false);
    });
});

describe('InputArbiter: a new finger starts clean', () => {
    const down = (x = 100): PointerState => finger(1, 100, x, 600, 600);
    const lifted = (x = 100): PointerState => up(1, x, 600, 100, 600);

    it('taps after a finger that was dragged far and lifted', () => {
        const a = arbiter();
        a.read(raw(keys(), down()));
        a.read(raw(keys(), down(230)));
        a.read(raw(keys(), lifted(230)));
        a.read(raw(), 1); // the pulse state is irrelevant: let any time pass
        a.read(raw(keys(), down()));
        expect(a.read(raw(keys(), lifted())).move.jump).toBe(true);
    });

    it('taps after a finger that was held for a long time and lifted', () => {
        const a = arbiter();
        a.read(raw(keys(), down()), 1);
        a.read(raw(keys(), down()), 1);
        a.read(raw(keys(), lifted()), 1);
        a.read(raw(), 1);
        a.read(raw(keys(), down()));
        expect(a.read(raw(keys(), lifted())).move.jump).toBe(true);
    });
});

describe('InputArbiter: second and third fingers', () => {
    it('keeps the stick moving when the second finger lifts first', () => {
        const a = arbiter();
        a.read(raw(keys(), finger(1, 100, 60), finger(2, 300)));
        const r = a.read(raw(keys(), finger(1, 100, 60), up(2)));
        expect(r.move).toEqual({ left: true, right: false, jump: false });
        expect(r.stick).not.toBeNull();
    });

    it('lets a third finger jump on its own after the second lifts', () => {
        const a = arbiter();
        a.read(raw(keys(), finger(1, 100), finger(2, 300), finger(3, 20)));
        const r = a.read(raw(keys(), finger(1, 100), up(2), finger(3, 20)));
        expect(r.move.jump).toBe(true);
        expect(a.read(raw(keys(), finger(1, 100), up(3))).move.jump).toBe(false);
    });
});

describe('tap parameters', () => {
    it('has the values of the parameter table', () => {
        expect(P.TAP_MAX_TIME).toBe(0.25);
        expect(P.TAP_SLOP).toBe(10);
        expect(P.TAP_JUMP_HOLD).toBe(0.1);
    });

    it('keeps the tap slop inside the stick dead zone, so a still tap never moves the stick', () => {
        expect(P.TAP_SLOP).toBeLessThanOrEqual(P.STICK_DEADZONE);
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
