import * as Phaser from 'phaser';
import {
    cellAppearance, cellAppearanceKey, cellStateOf, changedCellIndices, glyphKey, GLYPH_OUTLINE_COLOR, sameBoardShape,
    scaledDimension, scaledFont, scaledShape, shapeKey, HIGHLIGHT_FILL, HIGHLIGHT_FILL_ALPHA, HIGHLIGHT_STROKE, HIGHLIGHT_STROKE_ALPHA,
    HIGHLIGHT_STROKE_COLOR, PLAYER_MARK_CENTER, PLAYER_MARK_SIZE, PLAYER_MARK_STROKE, DOOR_COLOR,
    type BoardShape, type CellGlyph, type CellShape
} from '../core/cellAppearance';
import type { LogicalAnalysis } from '../core/solver';
import { REFERENCE_CELL } from '../core/title';
import { DOOR_FRAME_COLOR, WALL_COLOR, doorCellOf, roomWalls } from '../core/walls';
import type { Stage } from '../core/types';

/** The cell rectangles are drawn into render textures of at most this many cells on a side (texture size limits). */
const CHUNK_CELLS = 32;
/** The player's highlight and "@" are part of the board: both sit behind the HUD band (docs/spec.md "HUD のメッセージとステータス"). */
const PLAYER_HIGHLIGHT_DEPTH = 5;
const PLAYER_MARKER_DEPTH = 6;

export type BoardViewLayout = {
    /** Top-left corner of cell (0, 0), in world px. */
    originX: number;
    originY: number;
    /** Size of one cell (px). */
    cell: number;
};

type Chunk = {
    texture: Phaser.GameObjects.RenderTexture;
    /** Where the chunk's first cell starts inside its texture (the texture sits on a whole pixel). */
    offsetX: number;
    offsetY: number;
};

/**
 * Draws a stage: the cells (with hints, flags and the stairs), the player's highlight and mark.
 * Shared by `Game` (cell 30) and the Title demo (a smaller cell). With the reference cell size the shapes are
 * exactly the ones `Game` always drew. `logical` is the game-over colouring (known bombs / safe cells), or none.
 *
 * The cells live in a few render textures: a changed cell is cleared and drawn again (its rectangle, then its
 * glyphs: digit, flag, bomb, "!", "○", "×", stamped from one text object per distinct look). What a cell looks
 * like is decided by `core/cellAppearance` (pure); only cells whose appearance changed are touched.
 */
export class BoardView
{
    private readonly scene: Phaser.Scene;
    private layout: BoardViewLayout;
    private boardLayer?: Phaser.GameObjects.Container;
    private chunks: Chunk[] = [];
    private chunkCols = 0;
    private dirtyChunks = new Set<number>();
    /** The appearance key each cell was last drawn with. */
    private cellKeys: Array<string | undefined> = [];
    /** Text objects (never on the display list) whose textures the glyph images share. */
    private glyphStamps = new Map<string, Phaser.GameObjects.Text>();
    /** Graphics objects (never on the display list) the figures of a cell are drawn into the cell's texture from. */
    private shapeStamps = new Map<string, Phaser.GameObjects.Graphics>();
    private cellGlyphs: Array<Phaser.GameObjects.Image[] | undefined> = [];
    private drawn?: BoardShape;
    private playerHighlight?: Phaser.GameObjects.Rectangle;
    private playerMarker?: Phaser.GameObjects.Text;
    private playerShown = true;
    /** What the player's mark shows: "@", or "†" after a death (docs/spec/game-over.md). */
    private playerGlyph = '@';
    private alpha = 1;

    /** What was drawn last: the cells are redrawn from it when the WebGL context comes back. */
    private lastStage?: Stage;
    private lastLogical?: LogicalAnalysis;
    private readonly renderer?: Phaser.Events.EventEmitter;

    constructor (scene: Phaser.Scene, layout: BoardViewLayout)
    {
        this.scene = scene;
        this.layout = { ...layout };
        // A render texture loses its contents with the WebGL context (the old per-cell shapes did not).
        this.renderer = scene.sys.game.renderer as unknown as Phaser.Events.EventEmitter | undefined;
    }

    /** Draws every cell again (the render textures were emptied by a lost WebGL context). */
    private redrawAll (): void
    {
        const stage = this.lastStage;
        if (!this.boardLayer || !stage) {
            return;
        }
        this.cellKeys = new Array(stage.cells.length);
        for (let idx = 0; idx < stage.cells.length; idx += 1) {
            this.updateCell(stage, idx, this.lastLogical);
        }
        this.flush();
    }

    /** A dimension drawn at the reference size, scaled to this view's cell (at least 1 px). */
    private px (value: number): number
    {
        return scaledDimension(value, this.layout.cell);
    }

    /** A font size scaled like `px`, but never under the smallest readable size. */
    private font (value: number): number
    {
        return scaledFont(value, this.layout.cell);
    }

    /** Draws `stage`: the cells that differ from what is on screen are updated, or the board is built when its shape changed. */
    render (stage: Stage, logical?: LogicalAnalysis): void
    {
        this.lastStage = stage;
        this.lastLogical = logical;
        if (this.boardLayer && this.drawn && sameBoardShape(this.drawn, stage)) {
            for (const idx of changedCellIndices(this.cellKeys, stage, logical)) {
                this.updateCell(stage, idx, logical);
            }
            this.flush();
        } else {
            this.build(stage, logical);
        }
        this.updatePlayer(stage);
    }

    /** True when only the cells in `changed` need redrawing from `prev` to `next`. */
    canDiff (_prev: Stage, next: Stage, _logical?: LogicalAnalysis): boolean
    {
        return this.boardLayer != null &&
            this.cellKeys.length === next.cells.length &&
            this.drawn != null &&
            sameBoardShape(this.drawn, next);
    }

    renderChanged (stage: Stage, changedIndices: number[], logical?: LogicalAnalysis): void
    {
        if (!this.boardLayer || changedIndices.length === 0) {
            return;
        }
        if (!this.drawn || !sameBoardShape(this.drawn, stage) || stage.cells.length !== this.cellKeys.length) {
            // Not the board that is drawn: a cell list for another board cannot be applied.
            this.render(stage, logical);
            return;
        }
        this.lastStage = stage;
        this.lastLogical = logical;

        for (const idx of changedIndices) {
            this.updateCell(stage, idx, logical);
        }
        this.flush();
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
            this.playerHighlight = this.scene.add.rectangle(0, 0, size, size, HIGHLIGHT_FILL, HIGHLIGHT_FILL_ALPHA)
                .setOrigin(0)
                .setStrokeStyle(this.px(HIGHLIGHT_STROKE), HIGHLIGHT_STROKE_COLOR, HIGHLIGHT_STROKE_ALPHA)
                .setDepth(PLAYER_HIGHLIGHT_DEPTH);
            this.playerHighlight.setAlpha(this.alpha);
        }
        this.playerHighlight.setPosition(left, top);

        if (!this.playerMarker) {
            this.playerMarker = this.scene.add.text(0, 0, this.playerGlyph, {
                fontFamily: 'monospace',
                fontSize: this.font(PLAYER_MARK_SIZE),
                fontStyle: 'bold',
                color: '#ffffff',
                stroke: GLYPH_OUTLINE_COLOR,
                strokeThickness: this.px(PLAYER_MARK_STROKE)
            }).setOrigin(0.5).setDepth(PLAYER_MARKER_DEPTH);
            this.playerMarker.setAlpha(this.alpha);
        }
        this.playerMarker.setPosition(left + PLAYER_MARK_CENTER.x * k, top + PLAYER_MARK_CENTER.y * k);
        this.playerHighlight.setVisible(this.playerShown);
        this.playerMarker.setVisible(this.playerShown);
    }

    /** Changes what the player's mark shows ("†" from the death on, "@" again when a stage starts). */
    setPlayerGlyph (glyph: string): void
    {
        if (glyph === this.playerGlyph) {
            return;
        }
        this.playerGlyph = glyph;
        this.playerMarker?.setText(glyph);
    }

    /** Shows or hides the player's highlight and mark (only the room the player is in has them). */
    setPlayerVisible (visible: boolean): void
    {
        this.playerHighlight?.setVisible(visible);
        this.playerMarker?.setVisible(visible);
        this.playerShown = visible;
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
        this.disposeBoard();
        this.playerHighlight?.destroy();
        this.playerHighlight = undefined;
        this.playerMarker?.destroy();
        this.playerMarker = undefined;
    }

    destroy (): void
    {
        this.renderer?.off(Phaser.Renderer.Events.RESTORE_WEBGL, this.redrawAll, this);
        this.lastStage = undefined;
        this.lastLogical = undefined;
        this.disposeBoard();
        this.playerHighlight?.destroy();
        this.playerHighlight = undefined;
        this.playerMarker?.destroy();
        this.playerMarker = undefined;
    }

    private disposeBoard (): void
    {
        this.boardLayer?.destroy(true);
        this.boardLayer = undefined;
        this.chunks = [];
        this.dirtyChunks.clear();
        this.cellKeys = [];
        this.cellGlyphs = [];
        for (const stamp of this.glyphStamps.values()) {
            stamp.destroy();
        }
        this.glyphStamps.clear();
        for (const stamp of this.shapeStamps.values()) {
            stamp.destroy();
        }
        this.shapeStamps.clear();
        this.drawn = undefined;
    }

    /** Builds the board layer from nothing: the render textures, every cell. */
    private build (stage: Stage, logical?: LogicalAnalysis): void
    {
        this.disposeBoard();
        // Registered per build (not in the constructor): destroy() removes it and a view may be built again after.
        this.renderer?.off(Phaser.Renderer.Events.RESTORE_WEBGL, this.redrawAll, this);
        this.renderer?.on(Phaser.Renderer.Events.RESTORE_WEBGL, this.redrawAll, this);
        const layer = this.scene.add.container(0, 0);
        layer.setAlpha(this.alpha);
        this.boardLayer = layer;

        const cell = this.layout.cell;
        this.chunkCols = Math.ceil(stage.width / CHUNK_CELLS);
        const chunkRows = Math.ceil(stage.height / CHUNK_CELLS);
        for (let cy = 0; cy < chunkRows; cy += 1) {
            for (let cx = 0; cx < this.chunkCols; cx += 1) {
                const worldX = this.layout.originX + cx * CHUNK_CELLS * cell;
                const worldY = this.layout.originY + cy * CHUNK_CELLS * cell;
                const x = Math.floor(worldX);
                const y = Math.floor(worldY);
                const offsetX = worldX - x;
                const offsetY = worldY - y;
                const cols = Math.min(CHUNK_CELLS, stage.width - cx * CHUNK_CELLS);
                const rows = Math.min(CHUNK_CELLS, stage.height - cy * CHUNK_CELLS);
                const texture = this.scene.add.renderTexture(x, y, Math.ceil(cols * cell + offsetX), Math.ceil(rows * cell + offsetY))
                    .setOrigin(0);
                // Nearest: with a fractional camera scroll the cells keep the crisp edges the shapes had.
                texture.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
                layer.add(texture);
                this.chunks.push({ texture, offsetX, offsetY });
            }
        }

        this.cellKeys = new Array(stage.cells.length);
        this.cellGlyphs = new Array(stage.cells.length);
        for (let idx = 0; idx < stage.cells.length; idx += 1) {
            this.updateCell(stage, idx, logical);
        }
        this.flush();
        this.drawWalls(stage, layer);

        this.drawn = {
            width: stage.width,
            height: stage.height,
            start: { x: stage.start.x, y: stage.start.y },
            goal: { x: stage.goal.x, y: stage.goal.y },
            startKind: stage.startKind,
            goalKind: stage.goalKind,
            doorSide: stage.doorSide
        };
    }

    /** The wall around the room, with a gap and a "+" where the door is (docs/spec/rooms-and-floors.md). */
    private drawWalls (stage: Stage, layer: Phaser.GameObjects.Container): void
    {
        const walls = roomWalls(stage.width, stage.height, this.layout.cell, stage.doorSide, doorCellOf(stage));
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(WALL_COLOR, 1);
        for (const bar of walls.bars) {
            graphics.fillRect(this.layout.originX + bar.x, this.layout.originY + bar.y, bar.width, bar.height);
        }
        layer.add(graphics);
        if (walls.door) {
            const frame = this.scene.add.graphics();
            frame.fillStyle(DOOR_FRAME_COLOR, 1);
            for (const post of walls.posts ?? []) {
                frame.fillRect(this.layout.originX + post.x, this.layout.originY + post.y, post.width, post.height);
            }
            layer.add(frame);
            const mark = this.scene.add.text(this.layout.originX + walls.door.x, this.layout.originY + walls.door.y, '+', {
                fontFamily: 'monospace',
                fontSize: this.font(24),
                fontStyle: 'bold',
                color: DOOR_COLOR,
                stroke: GLYPH_OUTLINE_COLOR,
                strokeThickness: this.px(3)
            }).setOrigin(0.5);
            layer.add(mark);
        }
    }

    /** Redraws cell `idx` when its appearance differs from what is drawn. */
    private updateCell (stage: Stage, idx: number, logical?: LogicalAnalysis): void
    {
        const appearance = cellAppearance(cellStateOf(stage, idx, logical));
        const key = cellAppearanceKey(appearance);
        const previous = this.cellKeys[idx];
        if (previous === key) {
            return;
        }
        this.cellKeys[idx] = key;

        const size = this.layout.cell;
        const k = size / REFERENCE_CELL;
        const x = idx % stage.width;
        const y = Math.floor(idx / stage.width);
        const chunkIndex = Math.floor(y / CHUNK_CELLS) * this.chunkCols + Math.floor(x / CHUNK_CELLS);
        const chunk = this.chunks[chunkIndex];
        const left = chunk.offsetX + (x % CHUNK_CELLS) * size;
        const top = chunk.offsetY + (y % CHUNK_CELLS) * size;
        // The fill is opaque and covers the same rectangle every time: no clearing is needed.
        chunk.texture.fill(appearance.fill, 1, left, top, size - 2 * k, size - 2 * k);
        // Figures (the flag) are stamped over the fill; the next fill of this cell covers them again.
        for (const shape of appearance.shapes) {
            chunk.texture.draw(this.shapeStamp(shape), left, top);
        }
        this.dirtyChunks.add(chunkIndex);

        for (const image of this.cellGlyphs[idx] ?? []) {
            image.destroy();
        }
        const worldLeft = this.layout.originX + x * size;
        const worldTop = this.layout.originY + y * size;
        const images = appearance.glyphs.map((glyph) => {
            const image = this.scene.add.image(
                worldLeft + size / 2,
                worldTop + size / 2,
                this.stampFor(glyph).texture
            ).setOrigin(0.5);
            this.boardLayer?.add(image);
            return image;
        });
        this.cellGlyphs[idx] = images.length > 0 ? images : undefined;
    }

    /**
     * The text object whose canvas is the picture of a glyph look. It is never shown itself: each cell shows
     * an image that shares its texture, so a board of thousands of digits creates one text object per look
     * (a few dozen), not one per cell.
     */
    private stampFor (glyph: CellGlyph): Phaser.GameObjects.Text
    {
        const key = glyphKey(glyph);
        let stamp = this.glyphStamps.get(key);
        if (!stamp) {
            const style: Phaser.Types.GameObjects.Text.TextStyle = {
                fontFamily: 'monospace',
                fontSize: this.font(glyph.size),
                fontStyle: glyph.bold ? 'bold' : 'normal',
                color: glyph.color
            };
            if (glyph.stroke > 0) {
                style.stroke = GLYPH_OUTLINE_COLOR;
                style.strokeThickness = this.px(glyph.stroke);
            }
            stamp = this.scene.make.text({ text: glyph.text, style }, false);
            this.glyphStamps.set(key, stamp);
        }
        return stamp;
    }

    /** The Graphics holding one figure at this view's cell size (shared by every cell with that figure). */
    private shapeStamp (shape: CellShape): Phaser.GameObjects.Graphics
    {
        const key = `${shapeKey(shape)}@${this.layout.cell}`;
        let stamp = this.shapeStamps.get(key);
        if (!stamp) {
            const g = this.scene.make.graphics({}, false);
            const { kind, points: p, color } = scaledShape(shape, this.layout.cell);
            g.fillStyle(color, 1);
            if (kind === 'rect') {
                g.fillRect(p[0], p[1], p[2], p[3]);
            } else {
                g.fillTriangle(p[0], p[1], p[2], p[3], p[4], p[5]);
            }
            stamp = g;
            this.shapeStamps.set(key, stamp);
        }
        return stamp;
    }

    /** Executes the fills queued on the render textures that changed. */
    private flush (): void
    {
        for (const index of this.dirtyChunks) {
            this.chunks[index].texture.render();
        }
        this.dirtyChunks.clear();
    }
}
