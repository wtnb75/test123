import type { Input, Scene } from 'phaser';
import type { PointerState, QuickTap, RawInput } from '../logic/input';
import { KeyTracker } from './KeyTracker';
import { readPointers } from './pointers';
import { TouchLatch } from './touchLatch';

/** Press positions kept between two reads (far more than the fingers a frame can bring). */
export const MAX_LATCHED_PRESSES = 8;

/**
 * Raw keyboard and pointer state of one Scene. Its listeners are removed when the Scene shuts down, so
 * a Scene only has to create it in `create` and call `read` each frame.
 *
 * Presses are latched from events, not found by comparing frames, so a tap shorter than one frame is
 * still seen; each `read` hands the latched presses over and clears them. A press that began and ended
 * between two reads is handed over as a quick tap, and a finger that ended without a normal release
 * (touch cancel, released outside the canvas) is reported as cancelled (see `TouchLatch`).
 */
export class SceneInput {
    private readonly keys: KeyTracker;
    private readonly pointerBuffer: PointerState[] = [];
    private readonly raw: RawInput;
    private readonly pressedKeys = new Set<string>();
    /** Where presses began since the previous read (a press is "pressed" in the sense of `pointerPressed`), and the copy handed over by the latest read. */
    private readonly latchedPresses: { x: number; y: number }[] = [];
    private readonly pressPoints: { x: number; y: number }[] = [];
    private readonly latch = new TouchLatch();
    private readonly quickTaps: QuickTap[] = [];
    private readonly cancelled = new Set<number>();

    constructor(private readonly scene: Scene) {
        this.keys = new KeyTracker(scene.input.keyboard!, scene.game.events);
        this.raw = {
            keys: this.keys.down,
            pointers: this.pointerBuffer,
            pressedKeys: this.pressedKeys,
            pointerPressed: false,
            pressPoints: this.pressPoints,
            quickTaps: this.quickTaps,
            cancelled: this.cancelled,
        };
        scene.input.on('pointerdown', this.onPointerDown);
        scene.input.on('pointerup', this.onPointerUp);
        scene.input.on('pointerupoutside', this.onPointerUpOutside);
        scene.events.once('shutdown', () => {
            scene.input.off('pointerdown', this.onPointerDown);
            scene.input.off('pointerup', this.onPointerUp);
            scene.input.off('pointerupoutside', this.onPointerUpOutside);
            this.keys.destroy();
        });
    }

    /** Returns the same object every call (it is overwritten by the next call). */
    read(): RawInput {
        this.raw.pointers = readPointers(this.scene.input.manager, this.pointerBuffer);
        this.pressedKeys.clear();
        this.keys.pressed.forEach((code) => this.pressedKeys.add(code));
        this.keys.pressed.clear();
        this.pressPoints.length = 0;
        for (const press of this.latchedPresses) this.pressPoints.push(press);
        this.latchedPresses.length = 0;
        this.raw.pointerPressed = this.pressPoints.length > 0;
        this.latch.markSeen(this.pointerBuffer);
        this.latch.drain(this.quickTaps, this.cancelled);
        return this.raw;
    }

    private readonly onPointerDown = (pointer: Input.Pointer): void => {
        // Right and middle mouse buttons are not presses (see readPointers).
        if (!pointer.primaryDown) return;
        // A Scene that stops reading (the Game behind the Result) must not collect presses without bound.
        if (this.latchedPresses.length < MAX_LATCHED_PRESSES) this.latchedPresses.push({ x: pointer.downX, y: pointer.downY });
        this.latch.down(pointer.id, pointer.downX, pointer.downY);
    };

    private readonly onPointerUp = (pointer: Input.Pointer): void => {
        // `primaryDown` is cleared by the release of the primary button or finger (and a touch cancel).
        this.latch.up(pointer.id, pointer.x, pointer.y, {
            primaryStillDown: pointer.primaryDown,
            canceled: pointer.wasCanceled,
        });
    };

    private readonly onPointerUpOutside = (pointer: Input.Pointer): void => {
        this.latch.upOutside(pointer.id, pointer.primaryDown);
    };
}
