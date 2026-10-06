import type { GameObjects } from 'phaser';
import { PARAMS } from '../params';
import { hslToHex } from '../logic/color';
import type { Diff, Dot, Shape, Stage } from '../logic/generate';

export const UI_FONT = 'sans-serif';
export const MENU_HUE = 215;

/** Screen background: a dark tint of `hue` with a few large soft circles for depth. */
export const drawBackdrop = (g: GameObjects.Graphics, width: number, height: number, hue: number): void => {
    g.clear();
    g.fillStyle(hslToHex(hue, 0.35, 0.16), 1);
    g.fillRect(0, 0, width, height);
    g.fillStyle(hslToHex(hue, 0.4, 0.22), 1);
    g.fillCircle(width * 0.12, height * 0.15, width * 0.22);
    g.fillCircle(width * 0.9, height * 0.85, width * 0.26);
    g.fillStyle(hslToHex(hue + 40, 0.4, 0.2), 1);
    g.fillCircle(width * 0.85, height * 0.1, width * 0.12);
};

/** Origin and display scale of a panel on the canvas. */
export interface PanelFrame {
    x: number;
    y: number;
    scale: number;
}

const drawShape = (g: GameObjects.Graphics, s: Shape, f: PanelFrame): void => {
    g.fillStyle(hslToHex(s.hue, s.sat, s.light), 1);
    const x = f.x + s.x * f.scale;
    const y = f.y + s.y * f.scale;
    const r = s.size * f.scale;
    if (s.kind === 'circle') g.fillCircle(x, y, r);
    else if (s.kind === 'rect') g.fillRect(x - r, y - r, r * 2, r * 2);
    else g.fillTriangle(x, y - r, x - r, y + r, x + r, y + r);
};

const DOT_SEGMENTS = 24;

/** A circle as a polygon whose vertices are clamped into the panel rectangle (cut off at the edge). */
const clippedCircle = (d: Dot, f: PanelFrame): { x: number; y: number }[] =>
    Array.from({ length: DOT_SEGMENTS }, (_, i) => {
        const a = (i / DOT_SEGMENTS) * Math.PI * 2;
        const x = Math.min(Math.max(d.x + Math.cos(a) * d.r, 0), PARAMS.panelSize);
        const y = Math.min(Math.max(d.y + Math.sin(a) * d.r, 0), PARAMS.panelSize);
        return { x: f.x + x * f.scale, y: f.y + y * f.scale };
    });

/** One picture: panel background, decoration dots (identical on both sides), then shapes in index order. */
export const drawPanel = (
    g: GameObjects.Graphics,
    f: PanelFrame,
    shapes: readonly (Shape | null)[],
    stage: Stage,
): void => {
    const px = PARAMS.panelSize * f.scale;
    g.fillStyle(hslToHex(stage.bgHue, 0.3, 0.9), 1);
    g.fillRect(f.x, f.y, px, px);
    g.fillStyle(hslToHex(stage.bgHue, 0.3, 0.82), 1);
    for (const d of stage.dots) {
        g.beginPath();
        clippedCircle(d, f).forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
        g.closePath();
        g.fillPath();
    }
    for (const s of shapes) if (s) drawShape(g, s, f);
};

/** A difference's hit circle as a ring; `radiusFactor` < 1 while it pops in. The line width never scales. */
export const strokeMark = (
    g: GameObjects.Graphics,
    f: PanelFrame,
    d: Diff,
    color: number = PARAMS.markColor,
    radiusFactor = 1,
): void => {
    g.lineStyle(PARAMS.markLineWidth, color, 1);
    g.strokeCircle(f.x + d.x * f.scale, f.y + d.y * f.scale, d.r * f.scale * radiusFactor);
};

/** The red cross of a miss, centred on a canvas point. */
export const strokeCross = (g: GameObjects.Graphics, x: number, y: number, alpha: number): void => {
    const h = PARAMS.missMarkSize / 2;
    g.lineStyle(PARAMS.missMarkLineWidth, PARAMS.markColor, alpha);
    g.lineBetween(x - h, y - h, x + h, y + h);
    g.lineBetween(x - h, y + h, x + h, y - h);
};
