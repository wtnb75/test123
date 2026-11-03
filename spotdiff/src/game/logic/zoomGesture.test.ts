import { describe, expect, it } from 'vitest';
import { layoutFor } from './layout';
import { NO_ZOOM, toPanelPoint } from './zoom';
import { ZoomControl } from './zoomGesture';

const portrait = layoutFor('portrait');
// panel 0: x 34..734, y 210..910, scale 1.75; panel 1 starts at y 950
const make = (canvasPerCss = 1) => new ZoomControl(() => ({ layout: portrait, canvasPerCss }));
const IN = { x: 300, y: 500 }; // inside panel 0
const ZOOMED = { zoom: 2, x: 100, y: 50 };

describe('tap', () => {
    it('lifting a finger that stayed put on a panel returns the lift position as a tap', () => {
        const z = make();
        z.down(1, IN.x, IN.y);
        expect(z.state).toBe('pending');
        expect(z.up(1, IN.x, IN.y)).toEqual({ x: IN.x, y: IN.y });
        expect(z.state).toBe('idle');
    });

    it('returns the lift position, not the press position, when the finger drifted within the slop', () => {
        const z = make();
        z.down(1, 300, 500);
        z.move(1, 305, 503);
        expect(z.up(1, 306, 504)).toEqual({ x: 306, y: 504 });
    });

    it('counts a move of exactly tapSlop (10 CSS px = 20 canvas px at 2 canvas px per CSS px) as a tap and a hair more as a drag', () => {
        const exact = make(2);
        exact.down(1, 300, 500);
        exact.move(1, 320, 500);
        expect(exact.state).toBe('pending');
        expect(exact.up(1, 320, 500)).not.toBeNull();

        const over = make(2);
        over.down(1, 300, 500);
        over.move(1, 320.01, 500);
        expect(over.state).toBe('dragging');
        expect(over.up(1, 320.01, 500)).toBeNull();
    });

    it('measures the slop as a Euclidean distance (a diagonal of 7 + 7 CSS px is 9.9 and still a tap)', () => {
        const z = make();
        z.down(1, 300, 500);
        z.move(1, 307, 507);
        expect(z.state).toBe('pending');
        z.move(1, 308, 508); // 11.3
        expect(z.state).toBe('dragging');
    });

    it('is no tap once the finger left the slop, even when it comes back to where it started', () => {
        const z = make();
        z.down(1, 300, 500);
        z.move(1, 340, 500);
        z.move(1, 300, 500);
        expect(z.up(1, 300, 500)).toBeNull();
    });

    it('ignores a lift whose press this control never saw (the finger that started the Scene)', () => {
        const z = make();
        expect(z.up(7, 300, 500)).toBeNull();
        expect(z.state).toBe('idle');
    });

    it('judges two taps one after the other', () => {
        const z = make();
        z.down(1, 300, 500);
        expect(z.up(1, 300, 500)).not.toBeNull();
        z.down(1, 320, 520);
        expect(z.up(1, 320, 520)).toEqual({ x: 320, y: 520 });
    });
});

describe('fingers that never take part', () => {
    it('a press outside the panels is ignored: no tap, and a later finger on a panel stays ignored too', () => {
        const z = make();
        z.down(1, 5, 5);
        expect(z.state).toBe('ignored');
        z.down(2, IN.x, IN.y);
        expect(z.state).toBe('ignored');
        expect(z.up(2, IN.x, IN.y)).toBeNull();
        expect(z.state).toBe('ignored'); // finger 1 is still down
        expect(z.up(1, 5, 5)).toBeNull();
        expect(z.state).toBe('idle');
    });

    it('ignoreFinger on an idle control makes the gesture ignored until every finger is up', () => {
        const z = make();
        z.ignoreFinger(1);
        expect(z.state).toBe('ignored');
        z.down(2, IN.x, IN.y);
        expect(z.up(2, IN.x, IN.y)).toBeNull();
        expect(z.up(1, 0, 0)).toBeNull();
        expect(z.state).toBe('idle');
    });

    it('an ignored finger beside a pending one does not stop the tap and is not counted as a second finger', () => {
        const z = make();
        z.down(1, IN.x, IN.y);
        z.ignoreFinger(2); // e.g. a HINT press that was not accepted
        expect(z.state).toBe('pending');
        z.up(2, 0, 0);
        expect(z.up(1, IN.x, IN.y)).not.toBeNull();
    });

    it('a pending finger that lifts while an ignored finger is still down leaves the gesture ignored, not idle', () => {
        const z = make();
        z.down(1, IN.x, IN.y);
        z.ignoreFinger(2);
        z.up(1, IN.x, IN.y);
        expect(z.state).toBe('ignored');
        z.up(2, 0, 0);
        expect(z.state).toBe('idle');
    });

    it('a press of a finger id that is already down starts it afresh (its release was lost, e.g. while the tab was hidden)', () => {
        const z = make();
        z.down(1, IN.x, IN.y);
        z.move(1, 340, 500); // dragging
        expect(z.state).toBe('dragging');
        z.down(1, 300, 520); // the lift of the first press never arrived
        expect(z.state).toBe('pending');
        expect(z.up(1, 300, 520)).toEqual({ x: 300, y: 520 });
        expect(z.state).toBe('idle');
    });

    it('a lost second finger that presses again rejoins the pinch instead of being dropped', () => {
        const z = make();
        z.down(1, 300, 500);
        z.down(2, 400, 500);
        z.down(2, 450, 500); // finger 2's lift was lost
        expect(z.state).toBe('pinching');
        z.move(2, 600, 500); // gap 150 -> 300: ratio 2 from the new start
        expect(z.view.zoom).toBeCloseTo(2, 12);
    });
});

describe('drag', () => {
    it('does not move the view until the finger leaves the slop, then follows it from where it crossed', () => {
        const z = make();
        z.view = ZOOMED;
        z.down(1, 200, 400);
        expect(z.move(1, 203, 402)).toBe(false);
        expect(z.view).toEqual(ZOOMED);
        // crossing the slop: still no jump
        expect(z.move(1, 240, 420)).toBe(false);
        expect(z.state).toBe('dragging');
        expect(z.view).toEqual(ZOOMED);
        // 40 and 20 canvas px further: the picture follows the finger, view -40 / 3.5 and -20 / 3.5
        expect(z.move(1, 280, 440)).toBe(true);
        expect(z.view.zoom).toBe(2);
        expect(z.view.x).toBeCloseTo(100 - 40 / 3.5, 9);
        expect(z.view.y).toBeCloseTo(50 - 20 / 3.5, 9);
    });

    it('stops at the panel edge: the view cannot leave 0 .. 400 - 400 / zoom', () => {
        const z = make();
        z.view = ZOOMED;
        z.down(1, 200, 400);
        z.move(1, 260, 400);
        z.move(1, 2000, 400); // far right: the picture goes right, the view origin to 0
        expect(z.view.x).toBe(0);
        z.move(1, -2000, 400);
        expect(z.view.x).toBe(200);
    });

    it('at zoom 1 a drag changes nothing, is no tap, and does not report a view change', () => {
        const z = make();
        z.down(1, 200, 400);
        z.move(1, 260, 400);
        expect(z.move(1, 300, 450)).toBe(false);
        expect(z.view).toEqual(NO_ZOOM);
        expect(z.up(1, 300, 450)).toBeNull();
    });

    it('a move of a finger the control does not know is ignored', () => {
        const z = make();
        expect(z.move(9, 1, 1)).toBe(false);
    });

    it('a move of an ignored finger never moves the view', () => {
        const z = make();
        z.view = ZOOMED;
        z.ignoreFinger(1);
        expect(z.move(1, 500, 500)).toBe(false);
        expect(z.view).toEqual(ZOOMED);
    });

    it('moving while no gesture is on a panel (idle or ignored) reports nothing', () => {
        const z = make();
        z.down(1, 5, 5); // outside: ignored
        expect(z.move(1, 400, 400)).toBe(false);
    });
});

describe('pinch', () => {
    const start = (z: ZoomControl) => {
        z.down(1, 300, 500);
        z.down(2, 400, 500);
    };

    it('zooms by the ratio of the finger gap (gap 100 -> 250 gives 2.5) and keeps the starting midpoint point under the midpoint', () => {
        const z = make();
        start(z);
        expect(z.state).toBe('pinching');
        const o = portrait.panels[0];
        const anchor = toPanelPoint(o, 1.75, NO_ZOOM, 350, 500);
        expect(z.move(2, 550, 500)).toBe(true);
        expect(z.view.zoom).toBeCloseTo(2.5, 12);
        const under = toPanelPoint(o, 1.75, z.view, 425, 500); // the midpoint is now (425, 500)
        expect(under.x).toBeCloseTo(anchor.x, 9);
        expect(under.y).toBeCloseTo(anchor.y, 9);
    });

    it('clamps at zoomMax (gap 400 -> 3.0) and at zoomMin (gap 30 -> 1.0, view back at the origin)', () => {
        const z = make();
        start(z);
        z.move(2, 700, 500);
        expect(z.view.zoom).toBe(3);
        z.move(2, 330, 500);
        expect(z.view).toEqual(NO_ZOOM);
    });

    it('starts from the current zoom when the pinch begins already zoomed', () => {
        const z = make();
        z.view = ZOOMED;
        start(z);
        z.move(2, 500, 500); // gap 200 = twice the start
        expect(z.view.zoom).toBeCloseTo(3, 12); // 2 * 2 clamped to 3
    });

    it('treats a start gap under 1 CSS px as ratio 1 (no zoom change, no division by zero)', () => {
        const z = make();
        z.down(1, 300, 500);
        z.down(2, 300, 500);
        expect(z.move(2, 500, 500)).toBe(false);
        expect(z.view.zoom).toBe(1);
        expect(Number.isFinite(z.view.x)).toBe(true);
    });

    it('uses the ratio when the start gap is exactly 1 CSS px (only a smaller gap counts as no gap)', () => {
        const z = make();
        z.down(1, 300, 500);
        z.down(2, 301, 500);
        z.move(2, 401, 500); // gap 1 -> 101
        expect(z.view.zoom).toBe(3);
    });

    it('scales the 1 CSS px gap limit by canvasPerCss (a 1.5 canvas px gap is under 1 CSS px at 2 per CSS px)', () => {
        const z = make(2);
        z.down(1, 300, 500);
        z.down(2, 301.5, 500);
        z.move(2, 500, 500);
        expect(z.view.zoom).toBe(1);
    });

    it('lets the second finger join from outside the panels, and never gives a tap', () => {
        const z = make();
        z.down(1, 300, 500);
        z.down(2, 300, 50); // above the panels
        expect(z.state).toBe('pinching');
        expect(z.up(2, 300, 50)).toBeNull();
        expect(z.up(1, 300, 500)).toBeNull();
        expect(z.state).toBe('idle');
    });

    it('lifting one of two fingers turns the gesture into a drag with the other, and it is no tap', () => {
        const z = make();
        z.view = ZOOMED;
        start(z);
        expect(z.up(2, 400, 500)).toBeNull();
        expect(z.state).toBe('dragging');
        const before = { ...z.view };
        z.move(1, 330, 500); // the remaining finger drags on from where it is
        expect(z.view.zoom).toBe(before.zoom);
        expect(z.view.x).toBeCloseTo(before.x - 30 / 3.5, 9);
        expect(z.up(1, 330, 500)).toBeNull();
        expect(z.state).toBe('idle');
    });

    it('a pending finger plus a second one is no tap even if the second lifts first and the first stays put', () => {
        const z = make();
        z.down(1, 300, 500);
        z.down(2, 400, 500);
        z.up(2, 400, 500);
        expect(z.up(1, 300, 500)).toBeNull();
    });

    it('a second finger touching during a drag turns it into a pinch without moving the view', () => {
        const z = make();
        z.view = ZOOMED;
        z.down(1, 200, 400);
        z.move(1, 260, 400);
        z.move(1, 300, 400); // dragging
        const before = { ...z.view };
        z.down(2, 450, 400);
        expect(z.state).toBe('pinching');
        expect(z.view).toEqual(before);
        expect(z.up(2, 450, 400)).toBeNull();
    });

    it('an unaccepted HINT / RESET press (ignoreFinger) during a pinch changes neither the mode nor the zoom', () => {
        const z = make();
        start(z);
        z.move(2, 550, 500);
        const before = { ...z.view };
        z.ignoreFinger(3);
        expect(z.state).toBe('pinching');
        expect(z.view).toEqual(before);
        z.up(3, 0, 0);
        expect(z.state).toBe('pinching');
    });

    it('ignores a third finger: the pinch goes on and the third one never taps', () => {
        const z = make();
        start(z);
        z.down(3, 350, 600);
        expect(z.state).toBe('pinching');
        z.move(3, 360, 700);
        expect(z.up(3, 360, 700)).toBeNull();
        expect(z.state).toBe('pinching');
    });
});

describe('cancel and cancelPointer', () => {
    it('cancel drops a pending tap and keeps the gesture ignored until the finger lifts', () => {
        const z = make();
        z.down(1, IN.x, IN.y);
        z.cancel();
        expect(z.state).toBe('ignored');
        expect(z.up(1, IN.x, IN.y)).toBeNull();
        expect(z.state).toBe('idle');
    });

    it('cancel on an idle control stays idle', () => {
        const z = make();
        z.cancel();
        expect(z.state).toBe('idle');
    });

    it('cancel during a pinch stops the view from moving', () => {
        const z = make();
        z.down(1, 300, 500);
        z.down(2, 400, 500);
        z.cancel();
        expect(z.move(2, 600, 500)).toBe(false);
        expect(z.view).toEqual(NO_ZOOM);
    });

    it('cancelPointer ends the finger without a tap', () => {
        const z = make();
        z.down(1, IN.x, IN.y);
        z.cancelPointer(1);
        expect(z.state).toBe('idle');
        expect(z.up(1, IN.x, IN.y)).toBeNull();
    });

    it('cancelPointer on a pinch finger turns the rest into a drag', () => {
        const z = make();
        z.down(1, 300, 500);
        z.down(2, 400, 500);
        z.cancelPointer(2);
        expect(z.state).toBe('dragging');
    });

    it('cancelPointer of an unknown finger does nothing', () => {
        const z = make();
        z.cancelPointer(3);
        expect(z.state).toBe('idle');
    });
});

describe('wheel', () => {
    it('zooms in about the cursor, keeping the point under it', () => {
        const z = make();
        const o = portrait.panels[0];
        const under = toPanelPoint(o, 1.75, NO_ZOOM, 300, 400);
        expect(z.wheel(300, 400, -100)).toBe(true);
        expect(z.view.zoom).toBeCloseTo(1.1, 12);
        const now = toPanelPoint(o, 1.75, z.view, 300, 400);
        expect(now.x).toBeCloseTo(under.x, 9);
        expect(now.y).toBeCloseTo(under.y, 9);
    });

    it('stacks: two notches in make 1.21, a cap of 300 per event, a stop at zoomMax and at zoomMin', () => {
        const z = make();
        z.wheel(300, 400, -100);
        z.wheel(300, 400, -100);
        expect(z.view.zoom).toBeCloseTo(1.21, 12);
        z.wheel(300, 400, -1000);
        expect(z.view.zoom).toBeCloseTo(1.21 * 1.331, 12);
        for (let i = 0; i < 20; i++) z.wheel(300, 400, -300);
        expect(z.view.zoom).toBe(3);
        for (let i = 0; i < 40; i++) z.wheel(300, 400, 300);
        expect(z.view).toEqual(NO_ZOOM);
    });

    it('zooming out at zoom 1 changes nothing and reports no change', () => {
        const z = make();
        expect(z.wheel(300, 400, 100)).toBe(false);
        expect(z.view).toEqual(NO_ZOOM);
    });

    it('does nothing when the cursor is outside both panels', () => {
        const z = make();
        expect(z.wheel(5, 5, -100)).toBe(false);
        expect(z.view).toEqual(NO_ZOOM);
    });

    it('works over the second panel with that panel origin', () => {
        const z = make();
        const o = portrait.panels[1];
        const under = toPanelPoint(o, 1.75, NO_ZOOM, 300, 1100);
        z.wheel(300, 1100, -200);
        const now = toPanelPoint(o, 1.75, z.view, 300, 1100);
        expect(now.x).toBeCloseTo(under.x, 9);
        expect(now.y).toBeCloseTo(under.y, 9);
    });

    it('uses the line-mode conversion', () => {
        const z = make();
        z.wheel(300, 400, -3, 1);
        expect(z.view.zoom).toBeCloseTo(Math.pow(1.1, 0.48), 12);
    });

    it('turns a pending press into a drag (never a tap)', () => {
        const z = make();
        z.down(1, 300, 400);
        z.wheel(300, 400, -100);
        expect(z.state).toBe('dragging');
        expect(z.up(1, 300, 400)).toBeNull();
    });

    it('re-anchors a drag that the wheel interrupted so the view does not jump', () => {
        const z = make();
        z.down(1, 300, 400);
        z.move(1, 340, 400); // dragging
        z.wheel(340, 400, -200);
        const view = { ...z.view };
        z.move(1, 340, 400); // same position: no change
        expect(z.view).toEqual(view);
    });

    it('re-anchors a pinch that the wheel interrupted', () => {
        const z = make();
        z.down(1, 300, 500);
        z.down(2, 400, 500);
        z.wheel(350, 500, -100);
        const view = { ...z.view };
        z.move(2, 400, 500); // unchanged positions
        expect(z.view.zoom).toBeCloseTo(view.zoom, 12);
        expect(z.view.x).toBeCloseTo(view.x, 9);
    });

    it('leaves the wheel on an idle control without a gesture', () => {
        const z = make();
        z.wheel(300, 400, -100);
        expect(z.state).toBe('idle');
    });
});

describe('resetView and zoomed', () => {
    it('resetView returns to the whole picture and zoomed follows the zoom', () => {
        const z = make();
        expect(z.zoomed).toBe(false);
        z.wheel(300, 400, -100);
        expect(z.zoomed).toBe(true);
        z.resetView();
        expect(z.zoomed).toBe(false);
        expect(z.view).toEqual(NO_ZOOM);
    });
});
