import type { Input } from 'phaser';
import type { PointerState } from '../logic/input';

/**
 * Copies Phaser's pointers (the mouse plus `activePointers` fingers) into a reusable buffer, so no
 * objects are created per frame after the first call.
 *
 * Only the primary button (left mouse button, or a finger) counts as down: Phaser sets `isDown` for any
 * mouse button but updates `downX` / `downY` for the primary one only, so a right or middle click would
 * otherwise show up with a stale press origin (and could start the game or drive the stick).
 */
export const readPointers = (manager: Input.InputManager, out: PointerState[]): PointerState[] => {
    const src = manager.pointers;
    for (let i = 0; i < src.length; i++) {
        const p = src[i];
        const s = out[i] ?? (out[i] = { id: 0, x: 0, downX: 0, downY: 0, isDown: false });
        s.id = p.id;
        s.x = p.x;
        s.downX = p.downX;
        s.downY = p.downY;
        s.isDown = p.isDown && p.primaryDown;
    }
    out.length = src.length;
    return out;
};
