import { PARAMS } from '../params';
import { Layout, Point, hitPanel } from './layout';
import { NO_ZOOM, View, anchorView, clampZoom, sameView, toPanelPoint, wheelFactor } from './zoom';

/** What the gesture needs to know about the screen right now. */
export interface GestureEnv {
    layout: Layout;
    /** Canvas px per CSS px (1 / the FIT display scale): `tapSlop` and the pinch gap are in CSS px. */
    canvasPerCss: number;
}

/**
 * - `idle`: no finger is down.
 * - `ignored`: the gesture does nothing until every finger is up (a finger outside the panels, on a button, or outside `play`).
 * - `pending`: one finger on a panel that may still become a tap.
 * - `dragging`: the view follows one finger (never a tap).
 * - `pinching`: two fingers zoom and move the view (never a tap).
 */
export type GestureMode = 'idle' | 'ignored' | 'pending' | 'dragging' | 'pinching';

interface Finger {
    id: number;
    x: number;
    y: number;
    downX: number;
    downY: number;
    /** Whether this finger takes part in the gesture (false: it is ignored). */
    gesture: boolean;
}

/**
 * The zoom view and the gesture state machine that moves it (docs/spec/zoom.md). Phaser-free: the Scene feeds it
 * pointer events (canvas coordinates) and draws `view`; a lifted finger that was a tap comes back from `up`.
 */
export class ZoomControl {
    view: View = NO_ZOOM;
    private mode: GestureMode = 'idle';
    private fingers: Finger[] = [];
    /** The panel the gesture started on: its origin is used for every conversion of the gesture. */
    private panel = 0;
    /** The panel-local point that stays under the fingers' midpoint. */
    private anchor: Point = { x: 0, y: 0 };
    private startDist = 1;
    private startZoom = 1;

    constructor(private readonly env: () => GestureEnv) {}

    get state(): GestureMode {
        return this.mode;
    }

    get zoomed(): boolean {
        return this.view.zoom > PARAMS.zoomMin;
    }

    /** Back to the whole picture. Does not touch a gesture in progress (call `cancel` for that). */
    resetView(): void {
        this.view = NO_ZOOM;
    }

    /** A finger touched a panel-input place (a press that is not on a button). */
    down(id: number, x: number, y: number): void {
        // a press of an id that is already down means its release never reached us (lost while hidden, say): start it afresh
        if (this.find(id)) {
            this.fingers = this.fingers.filter((f) => f.id !== id);
            if (this.fingers.length === 0) this.mode = 'idle';
            else if (this.mode !== 'ignored' && this.gestureFingers().length === 0) this.mode = 'ignored';
        }
        const finger: Finger = { id, x, y, downX: x, downY: y, gesture: false };
        this.fingers.push(finger);
        if (this.mode === 'idle') {
            const hit = hitPanel(this.env().layout, x, y);
            if (!hit) {
                this.mode = 'ignored';
                return;
            }
            this.panel = hit.panel;
            finger.gesture = true;
            this.mode = 'pending';
            return;
        }
        if (this.mode === 'ignored' || this.gestureFingers().length >= 2) return;
        finger.gesture = true;
        this.mode = 'pinching';
        this.rebase();
    }

    /** A finger that never takes part (on HINT / RESET / the pause screen, a non-left mouse button, or outside `play`). */
    ignoreFinger(id: number): void {
        if (!this.find(id)) this.fingers.push({ id, x: 0, y: 0, downX: 0, downY: 0, gesture: false });
        if (this.mode === 'idle') this.mode = 'ignored';
    }

    /** A finger moved. Returns true when the view changed (the Scene redraws). */
    move(id: number, x: number, y: number): boolean {
        const finger = this.find(id);
        if (!finger) return false;
        finger.x = x;
        finger.y = y;
        if (!finger.gesture) return false;
        if (this.mode === 'pending') {
            if (Math.hypot(x - finger.downX, y - finger.downY) > PARAMS.tapSlop * this.env().canvasPerCss) {
                this.mode = 'dragging';
                this.rebase();
            }
            return false;
        }
        if (this.mode === 'dragging') return this.apply(this.view.zoom);
        if (this.mode === 'pinching') {
            const small = PARAMS.pinchMinCssPx * this.env().canvasPerCss;
            const ratio = this.startDist < small ? 1 : this.gap() / this.startDist;
            return this.apply(this.startZoom * ratio);
        }
        return false;
    }

    /** A finger lifted. Returns the lift position when the press was a tap (the Scene judges it), else null. */
    up(id: number, x: number, y: number): Point | null {
        return this.release(id, x, y);
    }

    /** The system took the finger away (`pointercancel`, or it lifted outside the canvas): never a tap. */
    cancelPointer(id: number): void {
        const finger = this.find(id);
        if (finger) this.release(id, finger.x, finger.y); // the would-be tap is dropped
    }

    /** Throws the gesture away (the phase left `play`, the layout changed, HINT / RESET reset the view): nothing judges until all fingers are up. */
    cancel(): void {
        for (const finger of this.fingers) finger.gesture = false;
        this.mode = this.fingers.length > 0 ? 'ignored' : 'idle';
    }

    /** A wheel event at a canvas point. Returns true when the view changed. Only over a panel does it do anything. */
    wheel(x: number, y: number, deltaY: number, deltaMode = 0): boolean {
        const { layout } = this.env();
        const hit = hitPanel(layout, x, y);
        if (!hit) return false;
        const origin = layout.panels[hit.panel];
        const under = toPanelPoint(origin, layout.panelScale, this.view, x, y);
        const zoom = clampZoom(this.view.zoom * wheelFactor(deltaY, deltaMode));
        const next = anchorView(origin, layout.panelScale, zoom, under, { x, y });
        const changed = !sameView(next, this.view);
        this.view = next;
        if (this.mode === 'pending') this.mode = 'dragging';
        if (this.mode === 'dragging' || this.mode === 'pinching') this.rebase();
        return changed;
    }

    private find(id: number): Finger | undefined {
        return this.fingers.find((f) => f.id === id);
    }

    private gestureFingers(): Finger[] {
        return this.fingers.filter((f) => f.gesture);
    }

    private release(id: number, x: number, y: number): Point | null {
        const finger = this.find(id);
        if (!finger) return null;
        this.fingers = this.fingers.filter((f) => f !== finger);
        if (!finger.gesture) {
            if (this.fingers.length === 0) this.mode = 'idle';
            return null;
        }
        // only a lone finger that never left the slop (still `pending`) is a tap
        const tap = this.mode === 'pending' ? { x, y } : null;
        if (this.gestureFingers().length === 0) {
            this.mode = this.fingers.length > 0 ? 'ignored' : 'idle';
        } else {
            // one of two fingers lifted: the other one drags on from where it is
            this.mode = 'dragging';
            this.rebase();
        }
        return tap;
    }

    /** Starts the gesture again from the current view and finger positions (a finger was added or removed, or the wheel moved the view). */
    private rebase(): void {
        const { layout } = this.env();
        const mid = this.midpoint();
        this.anchor = toPanelPoint(layout.panels[this.panel], layout.panelScale, this.view, mid.x, mid.y);
        this.startZoom = this.view.zoom;
        this.startDist = this.gap();
    }

    private apply(zoom: number): boolean {
        const { layout } = this.env();
        const next = anchorView(layout.panels[this.panel], layout.panelScale, zoom, this.anchor, this.midpoint());
        const changed = !sameView(next, this.view);
        this.view = next;
        return changed;
    }

    private midpoint(): Point {
        const g = this.gestureFingers();
        const n = Math.max(1, g.length);
        return { x: g.reduce((s, f) => s + f.x, 0) / n, y: g.reduce((s, f) => s + f.y, 0) / n };
    }

    /** Distance between the two gesture fingers (1 when there is only one). */
    private gap(): number {
        const g = this.gestureFingers();
        return g.length < 2 ? 1 : Math.hypot(g[0].x - g[1].x, g[0].y - g[1].y);
    }
}
