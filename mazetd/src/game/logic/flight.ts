import { CELL, FLYER_FROM_WAVE } from './config';
import type { CellPos } from './board';
import { cellCenterX, cellCenterY } from './layout';
import type { Phase } from './world';

/** The straight line a flyer follows from the centre of S to the centre of G (spec/flyers.md). */
export interface FlightRoute {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    /** Length of the line in px. */
    len: number;
}

export interface Segment {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

export function createFlightRoute(start: CellPos, goal: CellPos): FlightRoute {
    const x0 = cellCenterX(start.col);
    const y0 = cellCenterY(start.row);
    const x1 = cellCenterX(goal.col);
    const y1 = cellCenterY(goal.row);
    return { x0, y0, x1, y1, len: Math.hypot(x1 - x0, y1 - y0) };
}

/** Where a flyer that has flown `traveled` px is; `out` receives the point so no object is created per frame. */
export function routePoint(route: FlightRoute, traveled: number, out: { x: number; y: number }): void {
    const t = traveled / route.len;
    out.x = route.x0 + (route.x1 - route.x0) * t;
    out.y = route.y0 + (route.y1 - route.y0) * t;
}

/** Whether the build-phase flight-route line is drawn: only while preparing a wave that has flyers. */
export function showsFlightLine(phase: Phase, wave: number): boolean {
    return phase === 'build' && wave >= FLYER_FROM_WAVE;
}

/**
 * The part of the route outside the S and G cells (the cells are CELL-sized squares around the centres), so the
 * "S" and "G" letters stay readable. Null when the two squares touch or overlap along the route.
 */
export function visibleRoute(route: FlightRoute): Segment | null {
    const dx = route.x1 - route.x0;
    const dy = route.y1 - route.y0;
    const reach = Math.max(Math.abs(dx), Math.abs(dy));
    if (reach <= CELL) return null;
    const t = CELL / 2 / reach;
    return {
        x0: route.x0 + dx * t,
        y0: route.y0 + dy * t,
        x1: route.x1 - dx * t,
        y1: route.y1 - dy * t
    };
}
