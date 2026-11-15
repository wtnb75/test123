// Pointer tracking: which finger spins the cube and which ones tap (docs/spec.md "ドラッグとタップ、
// 複数の指（マルチタッチ）"). Phaser's input events are fed in by the Scene; this holds only the rules.
import { DRAG_THRESHOLD_PX, MAX_TOUCH_POINTERS } from '../params';

export type PointerKind = 'mouse' | 'touch';
/** Whether the pointer with this id is still pressed (asked before each down/move event). */
export type PressedCheck = (id: number) => boolean;

type Mode = 'pending' | 'spin' | 'ignored';

interface Tracked {
    kind: PointerKind;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    mode: Mode;
}

export interface Drag {
    dx: number;
    dy: number;
}

export interface Tap {
    x: number;
    y: number;
}

export class PointerTracker {
    private readonly tracked = new Map<number, Tracked>();
    private spinId = -1;

    /** Drops pointers that are no longer pressed (a release that never reached us); nothing is tapped. */
    private prune(pressed: PressedCheck): void {
        // Deleting the current entry while iterating a Map is safe.
        for (const id of this.tracked.keys()) {
            if (!pressed(id)) this.drop(id);
        }
    }

    private drop(id: number): void {
        this.tracked.delete(id);
        if (id === this.spinId) this.spinId = -1;
    }

    private touchCount(): number {
        let n = 0;
        for (const t of this.tracked.values()) if (t.kind === 'touch') n++;
        return n;
    }

    down(id: number, x: number, y: number, kind: PointerKind, pressed: PressedCheck): void {
        this.prune(pressed);
        // A press with an id still tracked: the old press's release never arrived (ids are reused). Forget it.
        this.drop(id);
        if (kind === 'touch' && this.touchCount() >= MAX_TOUCH_POINTERS) return;
        this.tracked.set(id, { kind, startX: x, startY: y, lastX: x, lastY: y, mode: 'pending' });
    }

    /** The movement to rotate by when the spin finger moved, else null. */
    move(id: number, x: number, y: number, pressed: PressedCheck): Drag | null {
        this.prune(pressed);
        const t = this.tracked.get(id);
        if (!t) return null;
        if (t.mode === 'pending' && Math.hypot(x - t.startX, y - t.startY) >= DRAG_THRESHOLD_PX) {
            if (this.spinId === -1) {
                // The frame the threshold is crossed only starts the spin; the movement counts from the next one.
                t.mode = 'spin';
                this.spinId = id;
                t.lastX = x;
                t.lastY = y;
                return null;
            }
            t.mode = 'ignored';
        }
        if (t.mode !== 'spin') return null;
        const drag = { dx: x - t.lastX, dy: y - t.lastY };
        t.lastX = x;
        t.lastY = y;
        return drag;
    }

    /** A release. Returns where to tap when the pointer never became a drag and was released over the canvas. */
    up(id: number, x: number, y: number, insideCanvas: boolean): Tap | null {
        const t = this.tracked.get(id);
        if (!t) return null;
        this.drop(id);
        return t.mode === 'pending' && insideCanvas ? { x, y } : null;
    }

    /** Forgets every pointer (when the run ends). */
    reset(): void {
        this.tracked.clear();
        this.spinId = -1;
    }

    /** Test aid: the id of the pointer that spins, or -1. */
    get spinning(): number {
        return this.spinId;
    }
}
