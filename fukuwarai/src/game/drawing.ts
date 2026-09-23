import type { GameObjects, Scene } from 'phaser';
import { BACKGROUND_CSS, SCORE_BLUR_RADIUS_PX } from './logic/constants';
import { PART_IDS, PART_SHAPES, type PartShape } from './logic/parts';
import type { DraggablePartId, PartId, PartTransform, Point } from './logic/types';

const FULL_FACE_IDS: PartId[] = ['outline', ...PART_IDS];

/** Faint outline showing the part's actual (circular) hit area, so the
 * player can see exactly where to grab it (docs/spec.md 操作仕様). */
export function drawHitAreaIndicator(g: GameObjects.Graphics, radius: number): void {
    g.lineStyle(1.5, 0x666666, 0.35);
    g.strokeCircle(0, 0, radius);
}

/** Draws a part shape centered on (0, 0) of the given Phaser Graphics object. */
export function drawPartShape(g: GameObjects.Graphics, shape: PartShape): void {
    g.clear();
    const { w, h } = shape.size;
    if (shape.kind === 'circle') {
        const r = w / 2;
        g.fillStyle(shape.fill, 1);
        g.fillCircle(0, 0, r);
        if (shape.stroke !== undefined) {
            g.lineStyle(shape.strokeWidth ?? 2, shape.stroke, 1);
            g.strokeCircle(0, 0, r);
        }
        return;
    }
    if (shape.kind === 'ellipse') {
        g.fillStyle(shape.fill, 1);
        g.fillEllipse(0, 0, w, h);
        if (shape.stroke !== undefined) {
            g.lineStyle(shape.strokeWidth ?? 2, shape.stroke, 1);
            g.strokeEllipse(0, 0, w, h);
        }
        if (shape.pupil) {
            g.fillStyle(0x222222, 1);
            g.fillCircle(0, 0, Math.min(w, h) * 0.22);
        }
        return;
    }
    // triangle
    g.fillStyle(shape.fill, 1);
    g.fillTriangle(0, -h / 2, -w / 2, h / 2, w / 2, h / 2);
}

/** Small marker shown at the grabbed point while dragging a part (docs/spec.md 操作仕様). */
export function drawGrabMarker(g: GameObjects.Graphics, at: Point): void {
    g.clear();
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(at.x, at.y, 6);
    g.lineStyle(2, 0x333333, 1);
    g.strokeCircle(at.x, at.y, 6);
}

function colorToCss(hex: number): string {
    return '#' + hex.toString(16).padStart(6, '0');
}

/** Draws a part shape centered on (0, 0) of the given 2D canvas context. */
export function drawPartShapeOnCanvas(ctx: CanvasRenderingContext2D, shape: PartShape): void {
    const { w, h } = shape.size;
    ctx.save();
    if (shape.kind === 'circle') {
        const r = w / 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = colorToCss(shape.fill);
        ctx.fill();
        if (shape.stroke !== undefined) {
            ctx.lineWidth = shape.strokeWidth ?? 2;
            ctx.strokeStyle = colorToCss(shape.stroke);
            ctx.stroke();
        }
    } else if (shape.kind === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = colorToCss(shape.fill);
        ctx.fill();
        if (shape.stroke !== undefined) {
            ctx.lineWidth = shape.strokeWidth ?? 2;
            ctx.strokeStyle = colorToCss(shape.stroke);
            ctx.stroke();
        }
        if (shape.pupil) {
            ctx.beginPath();
            ctx.arc(0, 0, Math.min(w, h) * 0.22, 0, Math.PI * 2);
            ctx.fillStyle = '#222222';
            ctx.fill();
        }
    } else {
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(-w / 2, h / 2);
        ctx.lineTo(w / 2, h / 2);
        ctx.closePath();
        ctx.fillStyle = colorToCss(shape.fill);
        ctx.fill();
    }
    ctx.restore();
}

/** Fills the whole canvas with the shared background color (see score.ts —
 * this is what "nothing drawn here" means for score comparison). */
export function fillBackground(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = BACKGROUND_CSS;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/**
 * Renders the 6 draggable/scored parts onto a 2D canvas, each at
 * `center + transforms[id]`, for score comparison ('outline' is excluded —
 * see docs/spec.md). The canvas is filled with the shared background color
 * first so score.ts can tell "nothing drawn here" apart from a real diff.
 *
 * Parts are drawn with a blur filter (SCORE_BLUR_RADIUS_PX) so a few pixels
 * of position error partially overlaps blurred edges instead of landing
 * fully outside the answer's shape — see docs/spec.md ルール「位置ズレへの
 * 許容度」. The blur applies equally to both the player and answer canvases
 * (this function draws both), so it doesn't favor either side; a blank
 * (no-parts) canvas has no edges to blur and is unaffected.
 */
export function drawFaceOnCanvas(
    ctx: CanvasRenderingContext2D,
    center: Point,
    transforms: Record<DraggablePartId, PartTransform>,
): void {
    fillBackground(ctx);
    ctx.filter = `blur(${SCORE_BLUR_RADIUS_PX}px)`;
    for (const id of PART_IDS) {
        const t = transforms[id];
        ctx.save();
        ctx.translate(center.x + t.x, center.y + t.y);
        ctx.rotate(t.rotation);
        drawPartShapeOnCanvas(ctx, PART_SHAPES[id]);
        ctx.restore();
    }
    ctx.filter = 'none';
}

/**
 * Builds a visible (on-screen) group showing a full face — the fixed
 * outline plus all 6 parts — at the given per-part transforms (relative to
 * the group's own origin). The caller positions/scales the returned
 * container (e.g. large for the player's result, small for the answer
 * reference) — see docs/spec.md Result Scene layout.
 */
export function drawFaceGroup(scene: Scene, transforms: Record<PartId, PartTransform>): GameObjects.Container {
    const group = scene.add.container(0, 0);
    for (const id of FULL_FACE_IDS) {
        const t = transforms[id];
        const g = scene.add.graphics();
        drawPartShape(g, PART_SHAPES[id]);
        const part = scene.add.container(t.x, t.y, [g]);
        part.setRotation(t.rotation);
        group.add(part);
    }
    return group;
}
