// Button press rules (docs/spec.md "ボタン（Title・Result）"): a button acts when a pointer that was registered
// as pressing it is released over it. One ButtonPress tracks one button, per pointer.

export type ButtonLook = 'pressed' | 'hover' | 'normal';

export class ButtonPress {
    private readonly pressing = new Set<number>();

    /**
     * A pointer went down on the button. It is registered as pressing only while the Scene is accepting input
     * (not in the Result guard time, not under the rotate notice); otherwise it never counts.
     */
    down(pointerId: number, accepting: boolean): boolean {
        if (!accepting) return false;
        this.pressing.add(pointerId);
        return true;
    }

    /** A pointer was released over the button: true (the button acts) only if it was registered. */
    release(pointerId: number): boolean {
        return this.pressing.delete(pointerId);
    }

    /** The pointer left the button, was cancelled, or let go elsewhere: forget it (coming back doesn't re-register). */
    drop(pointerId: number): void {
        this.pressing.delete(pointerId);
    }

    /** Forget every pointer (the rotate notice appeared, the Scene ended). */
    clear(): void {
        this.pressing.clear();
    }

    get isPressed(): boolean {
        return this.pressing.size > 0;
    }
}

/**
 * How a button looks: pressed beats hover beats normal; while the Scene isn't accepting input (guard time,
 * rotate notice) it stays normal.
 */
export function buttonLook(pressed: boolean, hover: boolean, accepting: boolean): ButtonLook {
    if (!accepting) return 'normal';
    if (pressed) return 'pressed';
    return hover ? 'hover' : 'normal';
}
