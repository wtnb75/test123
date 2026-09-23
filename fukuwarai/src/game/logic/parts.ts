import { GAME_WIDTH, TRAY_ROW2_Y } from './constants';
import type { DraggablePartId, PartId, PartTransform } from './types';

// Draggable/scored parts only — 'outline' is drawn once as a fixed
// background element (see docs/spec.md MVP範囲) and isn't in this list.
export const PART_IDS: DraggablePartId[] = ['eyebrowL', 'eyebrowR', 'eyeL', 'eyeR', 'nose', 'mouth'];

export type ShapeKind = 'circle' | 'ellipse' | 'triangle';

export interface PartShape {
    kind: ShapeKind;
    size: { w: number; h: number };
    fill: number;
    stroke?: number;
    strokeWidth?: number;
    pupil?: boolean;
}

export const PART_SHAPES: Record<PartId, PartShape> = {
    outline: { kind: 'circle', size: { w: 140, h: 140 }, fill: 0xffe0bd, stroke: 0xd9a066, strokeWidth: 4 },
    eyebrowL: { kind: 'ellipse', size: { w: 44, h: 14 }, fill: 0x5b3a29 },
    eyebrowR: { kind: 'ellipse', size: { w: 44, h: 14 }, fill: 0x5b3a29 },
    eyeL: { kind: 'ellipse', size: { w: 30, h: 22 }, fill: 0xffffff, stroke: 0x333333, strokeWidth: 2, pupil: true },
    eyeR: { kind: 'ellipse', size: { w: 30, h: 22 }, fill: 0xffffff, stroke: 0x333333, strokeWidth: 2, pupil: true },
    nose: { kind: 'triangle', size: { w: 22, h: 26 }, fill: 0xe8b48c },
    mouth: { kind: 'ellipse', size: { w: 46, h: 18 }, fill: 0xc0392b },
};

// Extra padding (px, on top of each shape's visible size) added to the
// draggable hit area only — keeps small parts comfortably tappable without
// changing how large they look. Sized generously because Scale.FIT shrinks
// the whole canvas on anything shorter than the 960px design height (e.g.
// a typical desktop browser window scales it down to ~75%), so the hit
// area needs real margin at design resolution to still be comfortable
// after that shrink. Tray slots are 90px apart (GAME_WIDTH / 6 draggable
// parts), so keep each hit radius under 45 to avoid overlapping a
// neighboring part's hit area.
export const HIT_AREA_PADDING = 36;
export const MIN_HIT_SIZE = 76;

// Hit area is a circle, not a rectangle: a circle centered on the part's
// own origin looks identical at every rotation, so there's no risk of the
// clickable area drifting away from the visible shape as the part rotates
// during a drag (which is what a rotated rectangle hit area risked).
export function hitRadius(shape: PartShape): number {
    return Math.max(Math.max(shape.size.w, shape.size.h) + HIT_AREA_PADDING, MIN_HIT_SIZE) / 2;
}

// Correct placement, relative to PLACEMENT_CENTER — this doubles as the
// "answer" the score is computed against and the reveal-phase preview.
export const PART_ANSWERS: Record<PartId, PartTransform> = {
    outline: { x: 0, y: 0, rotation: 0 },
    eyebrowL: { x: -35, y: -35, rotation: -0.12 },
    eyebrowR: { x: 35, y: -35, rotation: 0.12 },
    eyeL: { x: -32, y: -12, rotation: 0 },
    eyeR: { x: 32, y: -12, rotation: 0 },
    nose: { x: 0, y: 12, rotation: 0 },
    mouth: { x: 0, y: 40, rotation: 0 },
};

function row2Slot(id: DraggablePartId): PartTransform {
    const index = PART_IDS.indexOf(id);
    const cellWidth = GAME_WIDTH / PART_IDS.length;
    return { x: cellWidth * index + cellWidth / 2, y: TRAY_ROW2_Y, rotation: 0 };
}

// Initial position/rotation of each part before it's ever been dragged.
export const TRAY_SLOTS: Record<DraggablePartId, PartTransform> = {
    eyebrowL: row2Slot('eyebrowL'),
    eyebrowR: row2Slot('eyebrowR'),
    eyeL: row2Slot('eyeL'),
    eyeR: row2Slot('eyeR'),
    nose: row2Slot('nose'),
    mouth: row2Slot('mouth'),
};
