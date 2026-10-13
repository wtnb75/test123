import type { GameObjects, Scene } from 'phaser';
import { PARAMS } from '../params';
import type { Layout } from '../logic/layout';
import { stalePopKeys } from '../logic/pops';
import { FIXED, MOVABLE, type Cell, type Grid, type KindPt, type MoveResult, type Pt } from '../logic/types';
import { COLORS, DEPTH } from './ui';

/** What the board needs to be drawn: the grid and where the character stands. */
export interface BoardState {
    grid: Grid;
    px: number;
    py: number;
}

/** The board as ASCII rows (`.` empty, `o` movable, `x` fixed, `@` the character) for the dev QA snapshot. */
export const qaRows = (state: BoardState): string[] =>
    state.grid.map((row, y) => row.map((c, x) => (x === state.px && y === state.py ? '@' : '.ox'[c])).join(''));

/**
 * The board and the block effects played on it (a cleared line shrinking, thinned-out blocks blinking
 * away, new blocks popping in). Shared by Game and the Title demo, so both look the same.
 * It owns no rules and no input: the Scene tells it what happened.
 */
export class BoardView {
    private readonly graphics: GameObjects.Graphics;
    private readonly dot: GameObjects.Arc;
    /** Transient effect objects; dropped on a layout change. */
    private readonly effects = new Set<GameObjects.GameObject>();
    /** Cells whose new block is still being drawn by a pop-in; the board draws them as empty. */
    private readonly popping = new Map<string, { rect: GameObjects.Rectangle; kind: Cell }>();
    /** The board needs redrawing (set by effect completions, handled once per frame by the Scene). */
    private dirty = false;
    private alpha = 1;

    constructor(
        private readonly scene: Scene,
        private layout: Layout,
    ) {
        this.graphics = scene.add.graphics().setDepth(DEPTH.board);
        this.dot = scene.add
            .circle(0, 0, PARAMS.cellSize * PARAMS.playerRadiusRatio, COLORS.player)
            .setDepth(DEPTH.player);
    }

    /** Orientation changed: only the placement changes; effects that are playing are dropped. */
    setLayout(layout: Layout): void {
        this.layout = layout;
        this.discardEffects();
    }

    /** Opacity of the board and the character (the demo fades them between games). */
    setAlpha(alpha: number): void {
        if (alpha === this.alpha) return;
        this.alpha = alpha;
        this.graphics.setAlpha(alpha);
        this.dot.setAlpha(alpha);
    }

    /** True once after an effect finished and the board has to be drawn again. */
    takeDirty(): boolean {
        const was = this.dirty;
        this.dirty = false;
        return was;
    }

    cellOrigin(x: number, y: number): Pt {
        return { x: this.layout.boardX + x * PARAMS.cellSize, y: this.layout.boardY + y * PARAMS.cellSize };
    }

    render(state: BoardState): void {
        const size = PARAMS.cellSize;
        const inset = PARAMS.cellInset;
        const g = this.graphics.clear();
        state.grid.forEach((row, y) => row.forEach((cell, x) => {
            const shown = this.popping.has(`${x},${y}`) ? 0 : cell;
            const o = this.cellOrigin(x, y);
            const color = shown === MOVABLE ? COLORS.movable : shown === FIXED ? COLORS.fixed : COLORS.empty;
            g.fillStyle(color).fillRect(o.x + inset, o.y + inset, size - 2 * inset, size - 2 * inset);
            if (shown === FIXED) {
                const c = PARAMS.crossInset;
                g.lineStyle(PARAMS.crossWidth, COLORS.fixedMark)
                    .lineBetween(o.x + c, o.y + c, o.x + size - c, o.y + size - c)
                    .lineBetween(o.x + size - c, o.y + c, o.x + c, o.y + size - c);
            }
        }));
        const p = this.cellOrigin(state.px, state.py);
        this.dot.setPosition(p.x + size / 2, p.y + size / 2);
    }

    /** A pop-in whose block was pushed away (or covered, or undone) must not keep growing on that cell. */
    dropStalePops(grid: Grid): void {
        for (const k of stalePopKeys(this.popping, grid)) {
            const pop = this.popping.get(k);
            this.popping.delete(k);
            if (pop) this.dispose(pop.rect);
        }
    }

    /**
     * Line clear: blocks shrink away. Relocated fixed blocks shrink at their old cell (they pop in at the
     * new one with the spawns). Thinned leftovers: grey blink then fade. Spawns: pop in.
     */
    playBlockEffects(res: MoveResult): void {
        const color = (kind: number) => (kind === FIXED ? COLORS.fixed : COLORS.movable);
        res.cleared.forEach((p) => this.shrinkAway(p, color(p.kind)));
        // a fixed block moved by the board generation shrinks away here (it pops in at its new cell with the spawns)
        res.relocated.forEach((m) => this.shrinkAway({ ...m.from, kind: FIXED }, color(FIXED)));
        res.pruned.forEach((p) => {
            const r = this.blockRect(p, COLORS.pruned, DEPTH.ghost);
            this.scene.tweens.add({
                targets: r, alpha: PARAMS.pruneBlinkAlpha, duration: PARAMS.pruneBlinkMs, yoyo: true, repeat: 1,
                onComplete: () => {
                    this.scene.tweens.add({ targets: r, alpha: 0, duration: PARAMS.pruneFadeMs, onComplete: () => this.release(r) });
                },
            });
        });
        res.spawned.forEach((p) => {
            const k = `${p.x},${p.y}`;
            const r = this.blockRect(p, color(p.kind), DEPTH.fx).setScale(0);
            this.popping.set(k, { rect: r, kind: p.kind });
            this.scene.tweens.add({
                targets: r, scale: 1, duration: PARAMS.popMs, delay: PARAMS.popDelayMs,
                onComplete: () => {
                    this.release(r);
                    if (this.popping.get(k)?.rect === r) this.popping.delete(k);
                    this.dirty = true; // several pop-ins end in the same frame: one redraw
                },
            });
        });
    }

    /** Registers an effect object of the Scene (a tap mark, a "+N") so a layout change can drop it. */
    track(obj: GameObjects.GameObject): void {
        this.effects.add(obj);
    }

    /** An effect finished by itself: forget and destroy its object. */
    release(obj: GameObjects.GameObject): void {
        this.effects.delete(obj);
        obj.destroy();
    }

    /** Stops every effect that is playing, tweens included: none of their completion handlers run. */
    discardEffects(): void {
        this.effects.forEach((o) => this.dispose(o));
        this.popping.clear();
    }

    /** An effect cut short: its tweens must not run their completion handlers either. */
    private dispose(obj: GameObjects.GameObject): void {
        this.scene.tweens.killTweensOf(obj);
        this.release(obj);
    }

    /** A block that left the board: it shrinks and fades where it stood (the same for a cleared and a moved block). */
    private shrinkAway(p: KindPt, fill: number): void {
        const r = this.blockRect(p, fill, DEPTH.fx);
        this.scene.tweens.add({
            targets: r, scale: PARAMS.clearShrinkScale, alpha: 0, duration: PARAMS.clearMs,
            onComplete: () => this.release(r),
        });
    }

    private blockRect(p: KindPt, fill: number, depth: number): GameObjects.Rectangle {
        const o = this.cellOrigin(p.x, p.y);
        const size = PARAMS.cellSize - 2 * PARAMS.cellInset;
        const rect = this.scene.add
            .rectangle(o.x + PARAMS.cellSize / 2, o.y + PARAMS.cellSize / 2, size, size, fill)
            .setDepth(depth);
        this.effects.add(rect);
        return rect;
    }
}
