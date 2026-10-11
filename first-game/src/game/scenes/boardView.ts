import * as Phaser from 'phaser';
import type { LogicalAnalysis } from '../core/solver';
import { REFERENCE_CELL } from '../core/title';
import type { Position, Stage } from '../core/types';

/** Text is never drawn smaller than this (px), also in the smallest demo cell. */
export const MIN_FONT_PX = 8;

const HINT_COLORS: Record<number, string> = {
    1: '#4da3ff',
    2: '#7bed9f',
    3: '#ff6b81',
    4: '#70a1ff',
    5: '#ff9f43',
    6: '#34e7e4',
    7: '#f1f2f6',
    8: '#ced6e0'
};

export type BoardViewLayout = {
    /** Top-left corner of cell (0, 0), in world px. */
    originX: number;
    originY: number;
    /** Size of one cell (px). */
    cell: number;
};

/**
 * Draws a stage: the cells (with hints and flags), the start / goal markers, the player's highlight and mark.
 * Shared by `Game` (cell 30) and the Title demo (a smaller cell). With the reference cell size the shapes are
 * exactly the ones `Game` always drew. `logical` is the game-over colouring (known bombs / safe cells), or none.
 */
export class BoardView
{
    private readonly scene: Phaser.Scene;
    private layout: BoardViewLayout;
    private boardLayer?: Phaser.GameObjects.Container;
    private cellLayers: Array<Phaser.GameObjects.Container | undefined> = [];
    private playerHighlight?: Phaser.GameObjects.Rectangle;
    private playerMarker?: Phaser.GameObjects.Text;
    private alpha = 1;

    constructor (scene: Phaser.Scene, layout: BoardViewLayout)
    {
        this.scene = scene;
        this.layout = { ...layout };
    }

    /** A dimension drawn at the reference size, scaled to this view's cell (at least 1 px). */
    private px (value: number): number
    {
        return Math.max(1, Math.round(value * this.layout.cell / REFERENCE_CELL));
    }

    /** A font size scaled like `px`, but never under MIN_FONT_PX (the smallest cell must stay readable). */
    private font (value: number): number
    {
        return Math.max(MIN_FONT_PX, this.px(value));
    }

    /** Rebuilds everything for `stage`. */
    render (stage: Stage, logical?: LogicalAnalysis): void
    {
        this.boardLayer?.destroy(true);
        this.boardLayer = this.scene.add.container(0, 0);
        this.boardLayer.setAlpha(this.alpha);
        this.cellLayers = new Array(stage.cells.length);

        for (let y = 0; y < stage.height; y += 1) {
            for (let x = 0; x < stage.width; x += 1) {
                const idx = y * stage.width + x;
                const layer = this.createCellLayer(stage, x, y, idx, logical);
                this.cellLayers[idx] = layer;
                this.boardLayer.add(layer);
            }
        }

        this.drawEdgeMarker(stage, stage.start, 0x7bed9f);
        this.drawEdgeMarker(stage, stage.goal, 0xffa502);
        this.updatePlayer(stage);
    }

    /** True when only the cells in `changed` need redrawing from `prev` to `next`. */
    canDiff (prev: Stage, next: Stage, logical?: LogicalAnalysis): boolean
    {
        return this.boardLayer != null &&
            this.cellLayers.length === next.cells.length &&
            prev.stageNo === next.stageNo &&
            prev.width === next.width &&
            prev.height === next.height &&
            prev.start.x === next.start.x &&
            prev.start.y === next.start.y &&
            prev.goal.x === next.goal.x &&
            prev.goal.y === next.goal.y &&
            logical == null;
    }

    renderChanged (stage: Stage, changedIndices: number[], logical?: LogicalAnalysis): void
    {
        if (!this.boardLayer || changedIndices.length === 0) {
            return;
        }

        for (const idx of changedIndices) {
            this.cellLayers[idx]?.destroy();

            const x = idx % stage.width;
            const y = Math.floor(idx / stage.width);
            const layer = this.createCellLayer(stage, x, y, idx, logical);
            this.cellLayers[idx] = layer;
            this.boardLayer.add(layer);
        }
    }

    /** Puts the highlight and the mark on the player's cell. */
    updatePlayer (stage: Stage): void
    {
        const cell = this.layout.cell;
        const k = cell / REFERENCE_CELL;
        const left = this.layout.originX + stage.player.x * cell;
        const top = this.layout.originY + stage.player.y * cell;

        if (!this.playerHighlight) {
            const size = cell - 2 * k;
            this.playerHighlight = this.scene.add.rectangle(0, 0, size, size, 0x57606f, 0.32)
                .setOrigin(0)
                .setStrokeStyle(this.px(2), 0xdfe4ea, 0.75)
                .setDepth(5);
            this.playerHighlight.setAlpha(this.alpha);
        }
        this.playerHighlight.setPosition(left, top);

        if (!this.playerMarker) {
            this.playerMarker = this.scene.add.text(0, 0, '@', {
                fontFamily: 'monospace',
                fontSize: this.font(12),
                color: '#ffffff'
            }).setOrigin(0.5).setDepth(12);
            this.playerMarker.setAlpha(this.alpha);
        }
        this.playerMarker.setPosition(left + cell / 2 - 9 * k, top + cell / 2 - 8 * k);
    }

    /** Opacity of the whole board (the fade of the Title demo). */
    setAlpha (alpha: number): void
    {
        if (alpha === this.alpha) {
            return;
        }
        this.alpha = alpha;
        this.boardLayer?.setAlpha(alpha);
        this.playerHighlight?.setAlpha(alpha);
        this.playerMarker?.setAlpha(alpha);
    }

    /** Moves and resizes the view; call `render` afterwards. */
    setLayout (layout: BoardViewLayout): void
    {
        this.layout = { ...layout };
        // The highlight and the mark are sized for the old cell: rebuild them with the board.
        this.playerHighlight?.destroy();
        this.playerHighlight = undefined;
        this.playerMarker?.destroy();
        this.playerMarker = undefined;
    }

    destroy (): void
    {
        this.boardLayer?.destroy(true);
        this.boardLayer = undefined;
        this.playerHighlight?.destroy();
        this.playerHighlight = undefined;
        this.playerMarker?.destroy();
        this.playerMarker = undefined;
        this.cellLayers = [];
    }

    private createCellLayer (stage: Stage, x: number, y: number, idx: number, logical?: LogicalAnalysis): Phaser.GameObjects.Container
    {
        const cell = stage.cells[idx];
        const size = this.layout.cell;
        const k = size / REFERENCE_CELL;
        const px = this.layout.originX + x * size;
        const py = this.layout.originY + y * size;
        const layer = this.scene.add.container(px, py);

        const rect = this.scene.add.rectangle(0, 0, size - 2 * k, size - 2 * k, this.cellFillColor(stage, x, y, cell, logical)).setOrigin(0);
        layer.add(rect);

        if (cell.hasBomb && cell.revealed) {
            const isDeducible = logical?.knownBombs.has(idx) ?? false;
            const bomb = this.scene.add.text(size / 2, size / 2, '*', {
                fontFamily: 'monospace',
                fontSize: this.font(20),
                fontStyle: 'bold',
                color: isDeducible ? '#ffb347' : '#ff3b30',
                stroke: '#0b1220',
                strokeThickness: this.px(3)
            }).setOrigin(0.5);
            layer.add(bomb);
        }

        if (!cell.hasBomb && cell.revealed) {
            const text = this.scene.add.text(size / 2, size / 2, cell.hint === 0 ? '' : String(cell.hint), {
                fontFamily: 'monospace',
                fontSize: this.font(16),
                fontStyle: 'bold',
                color: HINT_COLORS[cell.hint] ?? '#ffffff',
                stroke: '#0b1220',
                strokeThickness: this.px(3)
            }).setOrigin(0.5);
            layer.add(text);
        }

        if (cell.flagged) {
            const isWrongFlag = logical != null && !cell.hasBomb;
            const flag = this.scene.add.text(5 * k, 3 * k, 'F', {
                fontFamily: 'monospace',
                fontSize: this.font(16),
                fontStyle: isWrongFlag ? 'bold' : 'normal',
                color: isWrongFlag ? '#a29bfe' : '#ff4757'
            });
            layer.add(flag);
            if (isWrongFlag) {
                const cross = this.scene.add.text(size / 2, size / 2, '×', {
                    fontFamily: 'monospace',
                    fontSize: this.font(18),
                    fontStyle: 'bold',
                    color: '#a29bfe',
                    stroke: '#0b1220',
                    strokeThickness: this.px(2)
                }).setOrigin(0.5);
                layer.add(cross);
            }
        }

        if (logical && !cell.revealed && !cell.flagged) {
            if (logical.knownBombs.has(idx)) {
                const hint = this.scene.add.text(size / 2, size / 2, '!', {
                    fontFamily: 'monospace',
                    fontSize: this.font(16),
                    fontStyle: 'bold',
                    color: '#ffb347'
                }).setOrigin(0.5);
                layer.add(hint);
            } else if (logical.knownSafe.has(idx)) {
                const hint = this.scene.add.text(size / 2, size / 2, '○', {
                    fontFamily: 'monospace',
                    fontSize: this.font(12),
                    color: '#7bed9f'
                }).setOrigin(0.5);
                layer.add(hint);
            }
        }

        return layer;
    }

    private cellFillColor (stage: Stage, x: number, y: number, cell: Stage['cells'][number], logical?: LogicalAnalysis): number
    {
        if (logical) {
            const idx = y * stage.width + x;
            if (cell.hasBomb && cell.revealed) {
                // A revealed bomb: amber when it was certain from the numbers, the plain colour otherwise
                return logical.knownBombs.has(idx) ? 0x7d3800 : 0x2f3542;
            }
            if (!cell.revealed) {
                if (cell.flagged && !cell.hasBomb) {
                    return 0x3d1f6e; // A wrong flag (purple)
                }
                if (logical.knownBombs.has(idx)) {
                    return 0x7d3800; // A certain bomb that is still closed
                }
                if (logical.knownSafe.has(idx)) {
                    return 0x0d2b1a; // A certain safe cell
                }
            }
        }
        if (cell.revealed) {
            return 0x2f3542;
        }
        return 0x1e272e;
    }

    private drawEdgeMarker (stage: Stage, pos: Position, color: number): void
    {
        const cell = this.layout.cell;
        const k = cell / REFERENCE_CELL;
        const thickness = this.px(Math.max(8, Math.floor(REFERENCE_CELL * 0.35)));
        const along = cell - 2 * k;
        let px = this.layout.originX + pos.x * cell;
        let py = this.layout.originY + pos.y * cell;
        let markerWidth: number;
        let markerHeight: number;

        if (pos.y === 0) {
            markerWidth = along;
            markerHeight = thickness;
            py = this.layout.originY - markerHeight;
        } else if (pos.y === stage.height - 1) {
            markerWidth = along;
            markerHeight = thickness;
            py = this.layout.originY + stage.height * cell;
        } else if (pos.x === 0) {
            markerWidth = thickness;
            markerHeight = along;
            px = this.layout.originX - markerWidth;
        } else {
            markerWidth = thickness;
            markerHeight = along;
            px = this.layout.originX + stage.width * cell;
        }

        const marker = this.scene.add.rectangle(px, py, markerWidth, markerHeight, color)
            .setOrigin(0)
            .setStrokeStyle(this.px(2), 0xf1f2f6);

        this.boardLayer?.add(marker);
    }
}
