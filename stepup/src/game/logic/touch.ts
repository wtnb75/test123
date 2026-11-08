import { SWIPE_DEAD, SWIPE_RADIUS, TAP_MAX_MOVE, TAP_MAX_MS } from '../params';

/**
 * Swipe movement: the finger drags an anchor along. The direction is the side of the anchor the finger is on
 * (0 inside the dead zone); the anchor trails the finger by at most SWIPE_RADIUS, so reversing is quick.
 */
export function swipeStep(anchorX: number, fingerX: number): { dir: number; anchor: number } {
    let anchor = anchorX;
    const d = fingerX - anchor;
    if (d > SWIPE_RADIUS) anchor = fingerX - SWIPE_RADIUS;
    else if (d < -SWIPE_RADIUS) anchor = fingerX + SWIPE_RADIUS;
    const off = fingerX - anchor;
    const dir = off > SWIPE_DEAD ? 1 : off < -SWIPE_DEAD ? -1 : 0;
    return { dir, anchor };
}

/** candidate: may still be a tap or a swipe; move: swiping; ignored: acted already and does nothing more. */
type Role = 'candidate' | 'move' | 'ignored';

interface Finger {
    role: Role;
    startX: number;
    startY: number;
    startT: number;
    anchor: number;
    dir: number;
}

/**
 * Touch / mouse rules of the Game scene (docs/spec.md "Game のタッチ・マウス操作"). Feed it down / move / up
 * events (time in ms); `down` and `up` return how many button presses (0 or 1) the event makes. A finger the
 * tracker never saw go down (pressed before the scene, or under the rotate notice) is inert.
 */
export class TouchTracker {
    private readonly fingers = new Map<number, Finger>();

    /** A finger went down. A second finger while another is a candidate / swiping acts at once. */
    down(id: number, x: number, y: number, t: number): number {
        const busy = [...this.fingers.values()].some((f) => f.role !== 'ignored');
        this.fingers.set(id, {
            role: busy ? 'ignored' : 'candidate',
            startX: x,
            startY: y,
            startT: t,
            anchor: x,
            dir: 0,
        });
        return busy ? 1 : 0;
    }

    /** A finger moved: a candidate that travelled past TAP_MAX_MOVE turns into the swiping finger. */
    move(id: number, x: number, y: number): void {
        const f = this.fingers.get(id);
        if (!f) return;
        if (f.role === 'candidate' && Math.hypot(x - f.startX, y - f.startY) > TAP_MAX_MOVE) {
            f.role = 'move';
            f.anchor = f.startX;
        }
        if (f.role === 'move') {
            const s = swipeStep(f.anchor, x);
            f.anchor = s.anchor;
            f.dir = s.dir;
        }
    }

    /** A finger was lifted: a candidate lifted within TAP_MAX_MS is a tap (one press). */
    up(id: number, t: number): number {
        const f = this.fingers.get(id);
        this.fingers.delete(id);
        return f && f.role === 'candidate' && t - f.startT <= TAP_MAX_MS ? 1 : 0;
    }

    /** The pointer was cancelled: the finger disappears without a press. */
    cancel(id: number): void {
        this.fingers.delete(id);
    }

    /** Forget every finger (the rotate notice appeared, the scene ended); no presses. */
    clear(): void {
        this.fingers.clear();
    }

    /** Direction of the swiping finger (-1, 0, +1); 0 when nobody is swiping. */
    get dir(): number {
        for (const f of this.fingers.values()) if (f.role === 'move') return f.dir;
        return 0;
    }
}

/** Keyboard direction plus the swiping finger's, clamped to -1..+1. */
export const combineDir = (keyDir: number, touchDir: number): number => Math.max(-1, Math.min(1, keyDir + touchDir));
