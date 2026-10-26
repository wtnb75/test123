import type { GameObjects, Scene } from 'phaser';
import { PARAMS } from '../params';
import { cellSizeOf, type Layout } from '../logic/layout';
import { stalePopKeys } from '../logic/pops';
import { NEXT_EFFECT_MS, spawnDelayMs, STAGING_END_MS } from '../logic/staging';
import { FIXED, MOVABLE, type Cell, type Grid, type KindPt, type MoveResult, type Pt } from '../logic/types';
import { COLORS, DEPTH } from './ui';

/** A block popping in at a cell; once an input completed it, `done` is set and `mark` holds a fixed block's cross. */
interface Pop {
    rect: GameObjects.Rectangle;
    kind: Cell;
    startedAt: number;
    done: boolean;
    mark?: GameObjects.Graphics;
}

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
 * The board and the block effects played on it (a cleared line glowing and shrinking, then thinned-out
 * blocks blinking away and new blocks popping in). Shared by Game and the Title demo, so both look the same.
 * It owns no rules and no input: the Scene tells it what happened.
 */
export class BoardView {
    private readonly graphics: GameObjects.Graphics;
    private readonly dot: GameObjects.Arc;
    /** Transient effect objects; dropped on a layout change. */
    private readonly effects = new Set<GameObjects.GameObject>();
    /** Cells whose new block is still being drawn by a pop-in; the board draws them as empty. */
    private readonly popping = new Map<string, Pop>();
    /** Fixed blocks waiting at their old cell to shrink away (relocated by the board generation). */
    private readonly relocating = new Set<GameObjects.GameObject>();
    /** The board needs redrawing (set by effect completions, handled once per frame by the Scene). */
    private dirty = false;
    private alpha = 1;
    /** Cell size of the board on screen: 80 px at the start, 66 px once the board has grown. */
    private cell: number = PARAMS.cellSize;

    constructor(
        private readonly scene: Scene,
        private layout: Layout,
    ) {
        this.graphics = scene.add.graphics().setDepth(DEPTH.board);
        this.dot = scene.add
            .circle(0, 0, this.cell * PARAMS.playerRadiusRatio, COLORS.player)
            .setDepth(DEPTH.player);
    }

    get cellSize(): number {
        return this.cell;
    }

    /** Sets the cell size for a board of `cols` columns (the switch when the board grows is instant). */
    setCols(cols: number): void {
        const next = cellSizeOf(cols);
        if (next === this.cell) return;
        // effects still playing keep the old cell geometry: drop them, as a layout change does
        this.discardEffects();
        this.cell = next;
        this.dot.setRadius(next * PARAMS.playerRadiusRatio);
        this.dirty = true;
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
        return { x: this.layout.boardX + x * this.cell, y: this.layout.boardY + y * this.cell };
    }

    render(state: BoardState): void {
        const size = this.cell;
        const inset = PARAMS.cellInset;
        const g = this.graphics.clear();
        state.grid.forEach((row, y) => row.forEach((cell, x) => {
            const shown = this.popping.get(`${x},${y}`)?.done === false ? 0 : cell;
            const o = this.cellOrigin(x, y);
            const color = shown === MOVABLE ? COLORS.movable : shown === FIXED ? COLORS.fixed : COLORS.empty;
            g.fillStyle(color).fillRect(o.x + inset, o.y + inset, size - 2 * inset, size - 2 * inset);
            if (shown === FIXED) this.drawCross(g, o);
        }));
        const p = this.cellOrigin(state.px, state.py);
        this.dot.setPosition(p.x + size / 2, p.y + size / 2);
    }

    /** The cross that marks a fixed block, at the cell whose corner is `o`. */
    private drawCross(g: GameObjects.Graphics, o: Pt): void {
        const size = this.cell;
        const c = PARAMS.crossInset;
        g.lineStyle(PARAMS.crossWidth, COLORS.fixedMark)
            .lineBetween(o.x + c, o.y + c, o.x + size - c, o.y + size - c)
            .lineBetween(o.x + size - c, o.y + c, o.x + c, o.y + size - c);
    }

    /** Drops a pop-in's objects (its tweens must not run their completion handlers). */
    private disposePop(pop: Pop): void {
        this.dispose(pop.rect);
        if (pop.mark) this.dispose(pop.mark);
    }

    /** A pop-in whose block was pushed away (or covered, or undone) must not keep growing on that cell. */
    dropStalePops(grid: Grid): void {
        for (const k of stalePopKeys(this.popping, grid)) {
            const pop = this.popping.get(k);
            this.popping.delete(k);
            if (pop) this.disposePop(pop);
        }
    }

    /**
     * Line clear (see logic/staging for the timeline): the cleared line glows white and shrinks away. Once it
     * is gone the rest starts together: thinned leftovers turn grey, blink and fade; relocated fixed blocks
     * shrink at their old cell; spawns (and the relocated blocks at their new cell) pop in.
     * Until then the leftovers and the old cells are drawn as they were: the grid is already updated.
     */
    playBlockEffects(res: MoveResult): void {
        const color = (kind: number) => (kind === FIXED ? COLORS.fixed : COLORS.movable);
        res.cleared.forEach((p) => this.glowAndShrink(p, color(p.kind))); // each cell once, even at a row/column crossing
        res.relocated.forEach((m) => {
            const r = this.shrinkAway({ ...m.from, kind: FIXED }, color(FIXED), NEXT_EFFECT_MS);
            this.relocating.add(r);
        });
        res.pruned.forEach((p) => {
            const r = this.blockRect(p, COLORS.movable, DEPTH.ghost);
            this.scene.tweens.chain({
                targets: r,
                tweens: [
                    {
                        alpha: PARAMS.pruneBlinkAlpha, duration: PARAMS.pruneBlinkMs, yoyo: true, repeat: 1, delay: NEXT_EFFECT_MS,
                        onStart: () => r.setFillStyle(COLORS.pruned),
                    },
                    { alpha: 0, duration: PARAMS.pruneFadeMs, onComplete: () => this.release(r) },
                ],
            });
        });
        res.spawned.forEach((p) => {
            const k = `${p.x},${p.y}`;
            const r = this.blockRect(p, color(p.kind), DEPTH.fx).setScale(0);
            const earlier = this.popping.get(k); // a block kept on the effect layer by an earlier clear
            if (earlier) this.disposePop(earlier);
            this.popping.set(k, { rect: r, kind: p.kind, startedAt: this.scene.time.now, done: false });
            this.scene.tweens.add({
                targets: r, scale: 1, duration: PARAMS.popMs, delay: spawnDelayMs(res, p),
                onComplete: () => {
                    this.release(r);
                    if (this.popping.get(k)?.rect === r) this.popping.delete(k);
                    this.dirty = true; // several pop-ins end in the same frame: one redraw
                },
            });
        });
    }

    /**
     * An input arrived while a clear is staged: the pop-ins and the relocations, begun or not, jump to their
     * final look so no block the grid already holds stays unseen. Glow, shrink and thinning play on.
     * The caller redraws the board.
     */
    completeStaging(): void {
        let completed = false;
        this.popping.forEach((pop, k) => {
            if (pop.done) return;
            completed = true;
            // The finished block stays on the effect layer until the glow, shrink and thinning on its cell
            // are over, so it is drawn above them (a spawn is drawn over the effects of the same cell).
            this.scene.tweens.killTweensOf(pop.rect);
            pop.rect.setScale(1);
            pop.done = true;
            if (pop.kind === FIXED) {
                // the rectangle has no cross: draw the one the board shows under it
                const [x, y] = k.split(',').map(Number);
                pop.mark = this.scene.add.graphics().setDepth(DEPTH.fx);
                this.effects.add(pop.mark);
                this.drawCross(pop.mark, this.cellOrigin(x, y));
            }
            const rest = Math.max(0, STAGING_END_MS - (this.scene.time.now - pop.startedAt));
            this.scene.tweens.add({
                targets: pop.rect, alpha: 1, duration: rest,
                onComplete: () => {
                    this.release(pop.rect);
                    if (pop.mark) this.release(pop.mark);
                    if (this.popping.get(k) === pop) this.popping.delete(k);
                },
            });
        });
        if (this.relocating.size > 0) completed = true;
        this.relocating.forEach((r) => this.dispose(r));
        this.relocating.clear();
        if (completed) this.dirty = true;
    }

    /** Registers an effect object of the Scene (a tap mark, a "+N") so a layout change can drop it. */
    track(obj: GameObjects.GameObject): void {
        this.effects.add(obj);
    }

    /** An effect finished by itself: forget and destroy its object. */
    release(obj: GameObjects.GameObject): void {
        this.effects.delete(obj);
        this.relocating.delete(obj);
        obj.destroy();
    }

    /** Stops every effect that is playing, tweens included: none of their completion handlers run. */
    discardEffects(): void {
        this.effects.forEach((o) => this.dispose(o));
        this.popping.clear();
        this.relocating.clear();
    }

    /** An effect cut short: its tweens must not run their completion handlers either. */
    private dispose(obj: GameObjects.GameObject): void {
        this.scene.tweens.killTweensOf(obj);
        this.release(obj);
    }

    /** A block that left the board: after `delay` it shrinks and fades where it stood (a cleared or a moved block). */
    private shrinkAway(p: KindPt, fill: number, delay: number): GameObjects.Rectangle {
        const r = this.blockRect(p, fill, DEPTH.fx);
        this.scene.tweens.add({
            targets: r, scale: PARAMS.clearShrinkScale, alpha: 0, duration: PARAMS.clearMs, delay,
            onComplete: () => this.release(r),
        });
        return r;
    }

    /** A cleared block: a white layer grows over it, then both shrink away and fade. */
    private glowAndShrink(p: KindPt, fill: number): void {
        this.shrinkAway(p, fill, PARAMS.glowMs);
        const glow = this.blockRect(p, COLORS.glow, DEPTH.fx).setAlpha(0);
        this.scene.tweens.chain({
            targets: glow,
            tweens: [
                { alpha: PARAMS.glowAlpha, duration: PARAMS.glowMs },
                { scale: PARAMS.clearShrinkScale, alpha: 0, duration: PARAMS.clearMs, onComplete: () => this.release(glow) },
            ],
        });
    }

    private blockRect(p: KindPt, fill: number, depth: number): GameObjects.Rectangle {
        const o = this.cellOrigin(p.x, p.y);
        const size = this.cell - 2 * PARAMS.cellInset;
        const rect = this.scene.add
            .rectangle(o.x + this.cell / 2, o.y + this.cell / 2, size, size, fill)
            .setDepth(depth);
        this.effects.add(rect);
        return rect;
    }
}
