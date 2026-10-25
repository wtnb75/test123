import { PARAMS } from '../params';
import { holeCenter } from './board';
import type { Layout } from './layout';
import { popState, type Pop } from './pop';

// The title's demo player: a pure decision from what a player could see (docs/spec/title-demo.md "ボット").
// It follows the arrows towards the nearest mole (or decoy cat) that has one, waits for the mole to be up,
// and taps it after a short reaction time. A cat it can see is never tapped and drops out of its targets.

/** The part of the board the player sees: its top-left in board coordinates and its size. */
export interface DemoView {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** What the bot is told each frame. */
export interface DemoSight {
    /** Game milliseconds since the start of play. */
    now: number;
    view: DemoView;
    layout: Layout;
    pops: readonly Pop[];
}

/** The bot's decision: scroll as the arrow keys would (-1, 0, 1 per axis), and where to tap (canvas coordinates). */
export interface DemoMove {
    moveX: number;
    moveY: number;
    strike: boolean;
    strikeX: number;
    strikeY: number;
}

export const newDemoMove = (): DemoMove => ({ moveX: 0, moveY: 0, strike: false, strikeX: 0, strikeY: 0 });

const inView = (x: number, y: number, v: DemoView): boolean => x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h;

/** Whether `a` is a better (nearer, then earlier, then lower-numbered) target than `b`. */
const isNearer = (distA: number, a: Pop, distB: number, b: Pop): boolean =>
    distA < distB ||
    (distA === distB && (a.spawnedAt < b.spawnedAt || (a.spawnedAt === b.spawnedAt && a.hole < b.hole)));

/** The pop the bot walks to, or null: a mole, or a decoy cat it has not yet seen up (the cats with an arrow). A clock is never one. */
const pickTarget = (sight: DemoSight, cx: number, cy: number): Pop | null => {
    let best: Pop | null = null;
    let bestDist = Infinity;
    for (const pop of sight.pops) {
        const state = popState(pop, sight.now);
        if (state === 'gone' || pop.kind === 'clock') continue;
        const c = holeCenter(pop.hole, sight.layout);
        if (pop.kind === 'cat') {
            if (pop.decoy !== true) continue;
            if (state === 'up' && inView(c.x, c.y, sight.view)) continue; // seen: it is a cat
        }
        const dist = Math.hypot(c.x - cx, c.y - cy);
        if (best === null || isNearer(dist, pop, bestDist, best)) {
            best = pop;
            bestDist = dist;
        }
    }
    return best;
};

/**
 * The central area as [left, right, top, bottom] inside the view: the margin ratio of the view's size in from
 * each edge, except on a side where the view already rests on the board's edge (nothing more to scroll there,
 * so a mole in that corner could never be pulled further in).
 */
const centralArea = (v: DemoView, layout: Layout): [number, number, number, number] => {
    const mx = v.w * PARAMS.demoViewMarginRatio;
    const my = v.h * PARAMS.demoViewMarginRatio;
    return [
        v.x <= 0 ? v.x : v.x + mx,
        v.x + v.w >= layout.boardW ? v.x + v.w : v.x + v.w - mx,
        v.y <= 0 ? v.y : v.y + my,
        v.y + v.h >= layout.boardH ? v.y + v.h : v.y + v.h - my,
    ];
};

const inCentral = (x: number, y: number, v: DemoView, layout: Layout): boolean => {
    const [left, right, top, bottom] = centralArea(v, layout);
    return x >= left && x <= right && y >= top && y <= bottom;
};

/**
 * The mole to tap now: in the central area (the bot pulls a mole towards the middle before tapping it), up for
 * at least the reaction time; the one that appeared first.
 */
const pickStrike = (sight: DemoSight): Pop | null => {
    let best: Pop | null = null;
    for (const pop of sight.pops) {
        if (pop.kind !== 'mole' || popState(pop, sight.now) !== 'up') continue;
        if (sight.now < pop.spawnedAt + PARAMS.telegraphMs + PARAMS.demoReactionMs) continue;
        const c = holeCenter(pop.hole, sight.layout);
        if (!inCentral(c.x, c.y, sight.view, sight.layout)) continue;
        if (best === null || pop.spawnedAt < best.spawnedAt || (pop.spawnedAt === best.spawnedAt && pop.hole < best.hole)) {
            best = pop;
        }
    }
    return best;
};

/** One axis of scrolling towards `at` while it is outside [low, high]. */
const towards = (at: number, low: number, high: number): number => {
    if (at < low) return -1;
    return at > high ? 1 : 0;
};

/** One axis of scrolling towards the roaming point, still within the dead zone. */
const roam = (diff: number): number => (Math.abs(diff) > PARAMS.demoRoamDeadzone ? Math.sign(diff) : 0);

/** Writes this frame's decision into `out`. */
export function decideDemo(sight: DemoSight, out: DemoMove): void {
    const { view, layout, now } = sight;
    const cx = view.x + view.w / 2;
    const cy = view.y + view.h / 2;

    const target = pickTarget(sight, cx, cy);
    if (target) {
        const c = holeCenter(target.hole, layout);
        const [left, right, top, bottom] = centralArea(view, layout);
        out.moveX = towards(c.x, left, right);
        out.moveY = towards(c.y, top, bottom);
    } else {
        const t = now / 1000;
        const rx = layout.boardW / 2 + layout.boardW * PARAMS.demoRoamXRatio * Math.sin((2 * Math.PI * t) / PARAMS.demoRoamXPeriod);
        const ry = layout.boardH / 2 + layout.boardH * PARAMS.demoRoamYRatio * Math.sin((2 * Math.PI * t) / PARAMS.demoRoamYPeriod);
        out.moveX = roam(rx - cx);
        out.moveY = roam(ry - cy);
    }

    const hit = pickStrike(sight);
    out.strike = hit !== null;
    if (hit) {
        const c = holeCenter(hit.hole, layout);
        out.strikeX = c.x - view.x;
        out.strikeY = c.y - view.y;
    }
}
