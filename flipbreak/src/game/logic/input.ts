// Turns "what is held down" into flipper and plunger commands (docs/spec.md "操作仕様"). Pure; no Phaser.
import { W } from '../params';

export interface PointerState {
    id: number;
    /** Logical x of the pointer. */
    x: number;
}

export interface RouteFrame {
    pointers: readonly PointerState[];
    /** KeyboardEvent.code of the keys held down. */
    keys: ReadonlySet<string>;
    /** The ball sits in the lane (`isReady`) at the start of this frame. */
    ready: boolean;
}

export interface Routed {
    left: boolean;
    right: boolean;
    /** The plunger is being charged (a source is held and the ball is ready). */
    charge: boolean;
}

export const LEFT_KEYS: readonly string[] = ['ArrowLeft', 'KeyZ'];
export const RIGHT_KEYS: readonly string[] = ['ArrowRight', 'Slash'];
export const CHARGE_KEYS: readonly string[] = ['ArrowDown', 'Space'];

const pointerKey = (id: number): string => `p${id}`;
const keyKey = (code: string): string => `k${code}`;

/**
 * Routes held pointers and keys to the left flipper, the right flipper and the plunger.
 *
 * A source (a finger or a key) that was already down when the Scene started is ignored until it is released
 * (`startBlock`), and so is a source down when the ball came to rest in the lane (a finger that was holding a
 * flipper must not charge the plunger the moment the ball returns).
 */
export class InputRouter {
    private readonly flipperIgnored = new Set<string>();
    private readonly chargeIgnored = new Set<string>();
    private readonly down = new Set<string>();
    private wasReady = true;

    /** Ignore these pointers (and keys) until each is released; call once when the Scene starts. */
    startBlock(pointerIds: readonly number[], keyCodes: readonly string[] = []): void {
        for (const id of pointerIds) this.blockOne(pointerKey(id));
        for (const code of keyCodes) this.blockOne(keyKey(code));
    }

    route(f: RouteFrame): Routed {
        const down = this.down;
        down.clear();
        for (const p of f.pointers) down.add(pointerKey(p.id));
        for (const code of f.keys) down.add(keyKey(code));
        this.forgetReleased(this.flipperIgnored, down);
        this.forgetReleased(this.chargeIgnored, down);
        if (f.ready && !this.wasReady) for (const id of down) this.chargeIgnored.add(id);
        this.wasReady = f.ready;

        const keyHeld = (codes: readonly string[], ignored: ReadonlySet<string>) =>
            codes.some((c) => f.keys.has(c) && !ignored.has(keyKey(c)));
        const pointers = (ignored: ReadonlySet<string>) => f.pointers.filter((p) => !ignored.has(pointerKey(p.id)));

        // Touch moves the flippers only while the ball is out of the lane; in the lane it charges the plunger.
        const flipperPointers = f.ready ? [] : pointers(this.flipperIgnored);
        const half = W / 2;
        const left = keyHeld(LEFT_KEYS, this.flipperIgnored) || flipperPointers.some((p) => p.x < half);
        const right = keyHeld(RIGHT_KEYS, this.flipperIgnored) || flipperPointers.some((p) => p.x >= half);
        const charge = f.ready && (keyHeld(CHARGE_KEYS, this.chargeIgnored) || pointers(this.chargeIgnored).length > 0);
        return { left, right, charge };
    }

    private blockOne(id: string): void {
        this.flipperIgnored.add(id);
        this.chargeIgnored.add(id);
    }

    private forgetReleased(ignored: Set<string>, down: ReadonlySet<string>): void {
        for (const id of ignored) if (!down.has(id)) ignored.delete(id);
    }
}
