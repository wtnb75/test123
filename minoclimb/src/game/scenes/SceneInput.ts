import type { Input, Scene } from 'phaser';
import type { PointerState, RawInput } from '../logic/input';
import { KeyTracker } from './KeyTracker';
import { readPointers } from './pointers';

/**
 * Raw keyboard and pointer state of one Scene. Its listeners are removed when the Scene shuts down, so
 * a Scene only has to create it in `create` and call `read` each frame.
 *
 * Presses are latched from events, not found by comparing frames, so a tap shorter than one frame is
 * still seen; each `read` hands the latched presses over and clears them.
 */
export class SceneInput {
    private readonly keys: KeyTracker;
    private readonly pointerBuffer: PointerState[] = [];
    private readonly raw: RawInput;
    private readonly pressedKeys = new Set<string>();
    private pointerDown = false;

    constructor(private readonly scene: Scene) {
        this.keys = new KeyTracker(scene.input.keyboard!, scene.game.events);
        this.raw = { keys: this.keys.down, pointers: this.pointerBuffer, pressedKeys: this.pressedKeys, pointerPressed: false };
        scene.input.on('pointerdown', this.onPointerDown);
        scene.events.once('shutdown', () => {
            scene.input.off('pointerdown', this.onPointerDown);
            this.keys.destroy();
        });
    }

    /** Returns the same object every call (it is overwritten by the next call). */
    read(): RawInput {
        this.raw.pointers = readPointers(this.scene.input.manager, this.pointerBuffer);
        this.pressedKeys.clear();
        this.keys.pressed.forEach((code) => this.pressedKeys.add(code));
        this.keys.pressed.clear();
        this.raw.pointerPressed = this.pointerDown;
        this.pointerDown = false;
        return this.raw;
    }

    private readonly onPointerDown = (pointer: Input.Pointer): void => {
        // Right and middle mouse buttons are not presses (see readPointers).
        if (pointer.primaryDown) this.pointerDown = true;
    };
}
