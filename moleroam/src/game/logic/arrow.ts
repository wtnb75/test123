import { PARAMS } from '../params';
import type { Pt } from './board';

/** The part of the board on screen: top-left in board coordinates and size. */
export interface View {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** A point exactly on the border counts as in view. */
export const isInView = (p: Pt, view: View): boolean =>
    p.x >= view.x && p.x <= view.x + view.w && p.y >= view.y && p.y <= view.y + view.h;

export interface Arrow {
    /** Position on screen (relative to the view's top-left). */
    x: number;
    y: number;
    /** Direction toward the target, in radians. */
    angle: number;
}

/**
 * Arrow for an off-screen target: the line from the view center to the target, cut at the rectangle
 * that is `arrowMargin` inside each edge of the view. null when the target is in view.
 */
export const arrowFor = (target: Pt, view: View): Arrow | null => {
    if (isInView(target, view)) return null;
    const dx = target.x - (view.x + view.w / 2);
    const dy = target.y - (view.y + view.h / 2);
    const halfW = view.w / 2 - PARAMS.arrowMargin;
    const halfH = view.h / 2 - PARAMS.arrowMargin;
    const t = Math.min(halfW / Math.abs(dx), halfH / Math.abs(dy));
    return { x: view.w / 2 + dx * t, y: view.h / 2 + dy * t, angle: Math.atan2(dy, dx) };
};
