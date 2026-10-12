import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { decideDemo, newDemoMove, type DemoMove, type DemoSight } from './demoBot';
import { LANDSCAPE, portraitLayout, type Layout } from './layout';
import type { Pop } from './pop';

// Landscape board: hole i is centred at (160 + (i % 8) x 320, 160 + floor(i / 8) x 320); the view is 1024 x 768.
// A mole is up from spawnedAt + telegraphMs (800), and the bot taps it demoReactionMs (250) after that.

const UP_AT = PARAMS.telegraphMs;
const REACT = PARAMS.telegraphMs + PARAMS.demoReactionMs;

function mole(hole: number, spawnedAt = 0): Pop {
    return { hole, kind: 'mole', spawnedAt };
}

function cat(hole: number, spawnedAt = 0, decoy = false): Pop {
    return decoy ? { hole, kind: 'cat', spawnedAt, decoy: true } : { hole, kind: 'cat', spawnedAt };
}

function sightOf(pops: Pop[], now: number, x = 500, y = 400, layout: Layout = LANDSCAPE): DemoSight {
    return { now, view: { x, y, w: layout.viewW, h: layout.viewH }, layout, pops };
}

function decide(sight: DemoSight): DemoMove {
    const out = newDemoMove();
    // dirty values: every field must be written
    out.moveX = 7;
    out.moveY = 7;
    out.strike = true;
    decideDemo(sight, out);
    return out;
}

describe('decideDemo scrolling towards a target', () => {
    it('does not scroll while the target sits inside the view margin', () => {
        // hole 19 = (1120, 800); the view (500, 400) spans x 500..1524 and y 400..1168, margin 120.
        const m = decide(sightOf([mole(19)], 0));
        expect([m.moveX, m.moveY]).toEqual([0, 0]);
    });

    it('scrolls left and up towards an off-screen mole (hole 0 at (160, 160))', () => {
        const m = decide(sightOf([mole(0)], 0));
        expect([m.moveX, m.moveY]).toEqual([-1, -1]);
    });

    it('scrolls right and down towards a mole beyond the lower-right edge (hole 47 at (2400, 1760))', () => {
        const m = decide(sightOf([mole(47)], 0));
        expect([m.moveX, m.moveY]).toEqual([1, 1]);
    });

    it('stops exactly at the central area on each side (a hole at x = 1120, y = 800)', () => {
        // The central area is 25% in from each edge: 256 px across, 192 px down for a 1024 x 768 view.
        // left: view.x + 256 = 1120 -> still; one pixel further and the hole is left of it -> scroll left
        expect(decide(sightOf([mole(19)], 0, 864, 400)).moveX).toBe(0);
        expect(decide(sightOf([mole(19)], 0, 865, 400)).moveX).toBe(-1);
        // right: view.x + 1024 - 256 = 1120
        expect(decide(sightOf([mole(19)], 0, 352, 400)).moveX).toBe(0);
        expect(decide(sightOf([mole(19)], 0, 351, 400)).moveX).toBe(1);
        // top: view.y + 192 = 800
        expect(decide(sightOf([mole(19)], 0, 500, 608)).moveY).toBe(0);
        expect(decide(sightOf([mole(19)], 0, 500, 609)).moveY).toBe(-1);
        // bottom: view.y + 768 - 192 = 800
        expect(decide(sightOf([mole(19)], 0, 500, 224)).moveY).toBe(0);
        expect(decide(sightOf([mole(19)], 0, 500, 223)).moveY).toBe(1);
    });

    it('needs no margin on a side where the view rests on the board edge', () => {
        // hole 0 at (160, 160), view at the top-left corner: nothing more to scroll, so it is already "central"
        expect([decide(sightOf([mole(0)], 0, 0, 0)).moveX, decide(sightOf([mole(0)], 0, 0, 0)).moveY]).toEqual([0, 0]);
        // one pixel off the corner the margin is back: 160 < 1 + 256
        expect(decide(sightOf([mole(0)], 0, 1, 0)).moveX).toBe(-1);
        expect(decide(sightOf([mole(0)], 0, 0, 1)).moveY).toBe(-1);
        // lower-right corner: hole 47 at (2400, 1760), view (1536, 1152) ends exactly on the board (2560, 1920)
        expect([decide(sightOf([mole(47)], 0, 1536, 1152)).moveX, decide(sightOf([mole(47)], 0, 1536, 1152)).moveY]).toEqual([0, 0]);
        expect(decide(sightOf([mole(47)], 0, 1535, 1152)).moveX).toBe(1);
        expect(decide(sightOf([mole(47)], 0, 1536, 1151)).moveY).toBe(1);
    });

    it('follows the arrow of a decoy cat that is off screen, like a mole', () => {
        const m = decide(sightOf([cat(0, 0, true)], 0));
        expect([m.moveX, m.moveY]).toEqual([-1, -1]);
    });

    it('also chases a decoy cat still telegraphing in view (it cannot tell yet), then stops', () => {
        const m = decide(sightOf([cat(19, 0, true)], UP_AT - 1));
        expect([m.moveX, m.moveY]).toEqual([0, 0]);
        expect(m.strike).toBe(false);
    });

    it('lets a decoy cat go once it is seen up in view: it is no longer a target', () => {
        // Hole 19 (1120, 800) is inside the view at (500, 400). As a target it would hold the bot still (inside the
        // margin); alone it is ignored, and the bot roams towards the board centre (right and down, at now = 900).
        const seen = decide(sightOf([cat(19, 0, true)], UP_AT + 100));
        expect([seen.moveX, seen.moveY]).toEqual([1, 1]);
        expect(seen.strike).toBe(false);
    });

    it('counts a decoy cat exactly on the view edge as seen (left, right, top, bottom): it is ignored', () => {
        // hole 19 at (1120, 800), up. As a target it would pull the scroll its own way ([-1, 0], [1, 0], [0, -1],
        // [0, 1]); ignored, the bot roams towards the board centre's swing point (at 900 ms).
        const up = UP_AT + 100;
        const edges: { x: number; y: number; roam: number[] }[] = [
            { x: 1120, y: 400, roam: [0, 1] }, // left edge
            { x: 96, y: 400, roam: [1, 1] }, // right edge: 96 + 1024
            { x: 500, y: 800, roam: [1, 1] }, // top edge
            { x: 500, y: 32, roam: [1, 1] }, // bottom edge: 32 + 768
        ];
        for (const e of edges) {
            const m = decide(sightOf([cat(19, 0, true)], up, e.x, e.y));
            expect([m.moveX, m.moveY]).toEqual(e.roam);
        }
    });

    it('keeps following the arrow of a decoy cat that is up but off screen (it cannot be seen)', () => {
        const m = decide(sightOf([cat(0, 0, true)], UP_AT + 100));
        expect([m.moveX, m.moveY]).toEqual([-1, -1]);
    });

    it('does not chase an ordinary cat even off screen (it has no arrow)', () => {
        const withCat = decide(sightOf([cat(0)], 0));
        const empty = decide(sightOf([], 0));
        expect([withCat.moveX, withCat.moveY]).toEqual([empty.moveX, empty.moveY]);
    });

    it('drops a pop that is gone', () => {
        const goneAt = UP_AT + PARAMS.popLifetimeMs;
        const m = decide(sightOf([mole(0)], goneAt));
        const empty = decide(sightOf([], goneAt));
        expect([m.moveX, m.moveY]).toEqual([empty.moveX, empty.moveY]);
    });
});

describe('decideDemo choosing among several targets', () => {
    // View (128, 416): centre (640, 800). Holes 16 (160, 800) and 19 (1120, 800) are both 480 px away and outside
    // the margin (x < 248 and x > 1032); hole 18 (800, 800) is 160 px away, inside it.
    it('picks the nearest to the view centre', () => {
        const m = decide(sightOf([mole(16), mole(19), mole(18)], 0, 128, 416));
        expect([m.moveX, m.moveY]).toEqual([0, 0]);
    });

    it('on an equal distance picks the one that appeared first', () => {
        expect(decide(sightOf([mole(16, 100), mole(19, 0)], 0, 128, 416)).moveX).toBe(1);
        expect(decide(sightOf([mole(16, 0), mole(19, 100)], 0, 128, 416)).moveX).toBe(-1);
    });

    it('on an equal distance and time picks the lower hole', () => {
        expect(decide(sightOf([mole(19, 0), mole(16, 0)], 0, 128, 416)).moveX).toBe(-1);
    });
});

describe('decideDemo roaming when nothing has an arrow', () => {
    it('heads for the board centre at time 0', () => {
        // view centre (1012, 784); board centre (1280, 960): 268 and 176 px away
        const m = decide(sightOf([], 0));
        expect([m.moveX, m.moveY]).toEqual([1, 1]);
    });

    it('stays within the dead zone: 40 px is still, 41 px moves', () => {
        // centre x = view.x + 512; board centre x = 1280 -> view.x = 728 is exactly 40 px off
        expect(decide(sightOf([], 0, 728, 576)).moveX).toBe(0);
        expect(decide(sightOf([], 0, 727, 576)).moveX).toBe(1);
        // centre y = view.y + 384; board centre y = 960 -> view.y = 536 is exactly 40 px off
        expect(decide(sightOf([], 0, 768, 536)).moveY).toBe(0);
        expect(decide(sightOf([], 0, 768, 535)).moveY).toBe(1);
        expect(decide(sightOf([], 0, 768, 576))).toMatchObject({ moveX: 0, moveY: 0 });
    });

    it('swings with sin: far right at a quarter of the x period, far left at three quarters', () => {
        const quarter = (PARAMS.demoRoamXPeriod * 1000) / 4;
        // x = 1280 + 2560 x 0.3 = 2048 at the quarter, 512 at three quarters (view centre 1012)
        expect(decide(sightOf([], quarter)).moveX).toBe(1);
        expect(decide(sightOf([], quarter * 3)).moveX).toBe(-1);
    });

    it('swings up and down: y = 1536 at a quarter of the y period, 384 at three quarters (view centre 784)', () => {
        const quarter = (PARAMS.demoRoamYPeriod * 1000) / 4;
        expect(decide(sightOf([], quarter)).moveY).toBe(1);
        expect(decide(sightOf([], quarter * 3)).moveY).toBe(-1);
    });

    it('pins the swing amplitudes: the dead zone edge sits exactly at the roam point', () => {
        // x at a quarter of the x period is 1280 + 2560 x 0.3 = 2048; the view centre is view.x + 512, so the
        // point is 40 px off at view.x = 1496 (still) and 41 px off at 1495 (moves).
        const qx = (PARAMS.demoRoamXPeriod * 1000) / 4;
        expect(decide(sightOf([], qx, 1496, 576)).moveX).toBe(0);
        expect(decide(sightOf([], qx, 1495, 576)).moveX).toBe(1);
        // y at a quarter of the y period is 960 + 1920 x 0.3 = 1536; the centre is view.y + 384.
        const qy = (PARAMS.demoRoamYPeriod * 1000) / 4;
        expect(decide(sightOf([], qy, 768, 1112)).moveY).toBe(0);
        expect(decide(sightOf([], qy, 768, 1111)).moveY).toBe(1);
        // a phase between the quarters: x period / 8 -> sin(pi / 4) = 0.7071 -> 1280 + 768 x 0.7071 = 1823.1;
        // the centre is 1784 at view.x = 1272 (39.1 px off: still) and 1783 at 1271 (40.1 px off: moves)
        const eighth = (PARAMS.demoRoamXPeriod * 1000) / 8;
        expect(decide(sightOf([], eighth, 1272, 576)).moveX).toBe(0);
        expect(decide(sightOf([], eighth, 1271, 576)).moveX).toBe(1);
    });

    it('roams around the centre of a portrait board (1920 x 2560)', () => {
        const portrait = portraitLayout(1126);
        // view (576, 717) centre (960, 1280) is the board centre: still at time 0
        const m = decide(sightOf([], 0, 576, 717, portrait));
        expect([m.moveX, m.moveY]).toEqual([0, 0]);
    });
});

describe('decideDemo tapping', () => {
    it('waits for the reaction time: 1049 ms after spawning is too early, 1050 ms taps', () => {
        expect(decide(sightOf([mole(19)], REACT - 1)).strike).toBe(false);
        const m = decide(sightOf([mole(19)], REACT));
        // hole 19 at (1120, 800), view (500, 400): canvas (620, 400)
        expect([m.strike, m.strikeX, m.strikeY]).toEqual([true, 620, 400]);
    });

    it('taps only inside the central area, exactly on its edge included (left, right, top, bottom)', () => {
        // hole 19 at (1120, 800); the area is 256 px in from the sides and 192 px from top and bottom
        expect(decide(sightOf([mole(19)], REACT, 864, 400)).strike).toBe(true);
        expect(decide(sightOf([mole(19)], REACT, 865, 400)).strike).toBe(false);
        expect(decide(sightOf([mole(19)], REACT, 352, 400)).strike).toBe(true);
        expect(decide(sightOf([mole(19)], REACT, 351, 400)).strike).toBe(false);
        expect(decide(sightOf([mole(19)], REACT, 500, 608)).strike).toBe(true);
        expect(decide(sightOf([mole(19)], REACT, 500, 609)).strike).toBe(false);
        expect(decide(sightOf([mole(19)], REACT, 500, 224)).strike).toBe(true);
        expect(decide(sightOf([mole(19)], REACT, 500, 223)).strike).toBe(false);
    });

    it('does not tap a mole near the edge of the view; it scrolls it towards the middle first', () => {
        const m = decide(sightOf([mole(19)], REACT, 865, 400));
        expect(m.strike).toBe(false);
        expect(m.moveX).toBe(-1);
    });

    it('taps a mole in the corner of a view that rests on the board corner', () => {
        const m = decide(sightOf([mole(0)], REACT, 0, 0));
        expect([m.strike, m.strikeX, m.strikeY]).toEqual([true, 160, 160]);
        expect(decide(sightOf([mole(0)], REACT, 1, 0)).strike).toBe(false);
        expect(decide(sightOf([mole(47)], REACT, 1536, 1152)).strike).toBe(true);
        expect(decide(sightOf([mole(47)], REACT, 1535, 1152)).strike).toBe(false);
    });

    it('does not tap a mole still telegraphing, off screen, or gone', () => {
        expect(decide(sightOf([mole(19)], UP_AT - 1)).strike).toBe(false);
        expect(decide(sightOf([mole(0)], REACT)).strike).toBe(false);
        expect(decide(sightOf([mole(19)], UP_AT + PARAMS.popLifetimeMs)).strike).toBe(false);
    });

    it('never taps a cat, decoy or not', () => {
        expect(decide(sightOf([cat(19)], REACT + 500)).strike).toBe(false);
        expect(decide(sightOf([cat(19, 0, true)], REACT + 500)).strike).toBe(false);
    });

    it('taps the mole that appeared first among those ready, lower hole on a tie', () => {
        const first = decide(sightOf([mole(18, 500), mole(19, 0)], REACT + 500));
        expect([first.strikeX, first.strikeY]).toEqual([620, 400]); // hole 19
        const tie = decide(sightOf([mole(19, 0), mole(18, 0)], REACT));
        expect([tie.strikeX, tie.strikeY]).toEqual([300, 400]); // hole 18 at (800, 800)
    });

});

describe('decideDemo is a pure function', () => {
    it('gives the same decision twice and leaves the sight alone', () => {
        const pops = [mole(19, 0), cat(3, 100, true), mole(0, 200)];
        const sight = sightOf(pops, 1500);
        const before = JSON.stringify(sight);
        const a = { ...decide(sight) };
        const b = { ...decide(sight) };
        expect(b).toEqual(a);
        expect(JSON.stringify(sight)).toBe(before);
    });
});
