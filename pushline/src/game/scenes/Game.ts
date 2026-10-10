import { Scene, type GameObjects, type Input } from 'phaser';
import { PARAMS } from '../params';
import {
    FIXED, MOVABLE, type Cell, type Deps, type Dir, type KindPt, type MoveResult, type Pt, type State,
} from '../logic/types';
import { Flow, QuitConfirm, type PointerAction } from '../logic/flow';
import { stalePopKeys } from '../logic/pops';
import { cellAt, type Layout } from '../logic/layout';
import { canUndo, createState, move, tapOutcome, undo } from '../logic/rules';
import { tensionOf, type Tension } from '../logic/tension';
import { addLabel, applyLayout, COLORS, createButton, DEPTH, FONT_SIZE, watchOrientation, type ButtonView } from './ui';

const KEY_DIRS: Record<string, Dir> = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
};

/**
 * The play screen. Rules live in `logic/rules`, the phases / walking / press session in `logic/flow`;
 * this Scene forwards input and the clock to them and draws the result.
 */
export class Game extends Scene {
    private state!: State;
    private deps!: Deps;
    private flow!: Flow;
    private quit = new QuitConfirm();
    /** What the Quit button currently shows (armed = "Quit?"). */
    private quitShown = false;
    private layout!: Layout;

    private board!: GameObjects.Graphics;
    private playerDot!: GameObjects.Arc;
    private movesText!: GameObjects.Text;
    private linesText!: GameObjects.Text;
    private undoButton!: ButtonView;
    private quitButton!: ButtonView;
    /** Red frame around the canvas that pulses in the `critical` tension (never interactive). */
    private edge!: GameObjects.Graphics;
    private tension: Tension = 'none';

    /** Transient effect objects (shrinking, popping, thinned-out ghosts); dropped on a layout change. */
    private effects = new Set<GameObjects.GameObject>();
    /** Cells whose new block is still being drawn by a pop-in; the board draws them as empty. */
    private popping = new Map<string, { rect: GameObjects.Rectangle; kind: Cell }>();
    /** The board needs redrawing (set by effect completions, handled once per frame in `update`). */
    private dirty = false;

    constructor() {
        super('Game');
    }

    create() {
        // Phaser reuses Scene instances, so everything is (re)built here, not in field initialisers.
        this.layout = applyLayout(this);
        this.deps = { rng: Math.random, now: () => performance.now() };
        this.state = createState(this.deps);
        this.flow = new Flow();
        this.quit = new QuitConfirm();
        this.quitShown = false;
        this.cameras.main.fadeIn(PARAMS.sceneFadeMs);
        this.effects.clear();
        this.popping.clear();
        this.dirty = false;

        this.cameras.main.setBackgroundColor(COLORS.bg);
        this.board = this.add.graphics().setDepth(DEPTH.board);
        this.playerDot = this.add
            .circle(0, 0, PARAMS.cellSize * PARAMS.playerRadiusRatio, COLORS.player)
            .setDepth(DEPTH.player);
        this.movesText = addLabel(this, 0, 0, '', FONT_SIZE.hud).setDepth(DEPTH.hud);
        this.linesText = addLabel(this, 0, 0, '', FONT_SIZE.hud).setDepth(DEPTH.hud);
        this.undoButton = createButton(this, 'Undo', COLORS.buttonDefault, DEPTH.hud);
        this.quitButton = createButton(this, 'Quit', COLORS.buttonDanger, DEPTH.hud);
        this.edge = this.add.graphics().setDepth(DEPTH.alert).setAlpha(0);
        this.tension = 'none';

        this.registerInput();
        watchOrientation(this, () => this.layout, (layout) => this.relayout(layout));
        this.placeUi();
        this.render();
    }

    update() {
        const now = this.deps.now();
        this.pump(now);
        if (this.quitShown) this.refreshQuitButton(now); // takes the label back when the time is up
        if (this.dirty) {
            this.dirty = false;
            this.render();
        }
    }

    // ---- input -------------------------------------------------------------------------------

    private registerInput() {
        this.input.on('pointerdown', (p: Input.Pointer) => {
            const isDown = (id: number) => this.input.manager.pointers.some((q) => q.id === id && q.isDown);
            this.handle(this.flow.pointerDown(p.id, p.x, p.y, this.layout, isDown));
        });
        const release = (p: Input.Pointer) => this.handle(this.flow.pointerUp(p.id, p.x, p.y));
        this.input.on('pointerup', release);
        this.input.on('pointerupoutside', release);
        const keyboard = this.input.keyboard;
        keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
        // Captures belong to the KeyboardManager, not the Scene: they must be released on shutdown.
        const captured = 'UP,DOWN,LEFT,RIGHT,SPACE,BACKSPACE';
        keyboard?.addCapture(captured);
        this.events.once('shutdown', () => keyboard?.removeCapture(captured));
    }

    private onKey(e: KeyboardEvent) {
        if (e.repeat || this.flow.phase !== 'playing') return;
        if (e.code === 'KeyZ' || e.code === 'Backspace') this.handle({ kind: 'undo' });
        else if (e.code === 'KeyR') this.quitNow();
        else if (KEY_DIRS[e.code]) this.handle({ kind: 'swipe', dir: KEY_DIRS[e.code] });
    }

    private handle(action: PointerAction) {
        switch (action.kind) {
            case 'undo':
                // With nothing to undo the press does nothing at all (a walk in progress goes on).
                if (!canUndo(this.state)) break;
                this.flow.cancelWalk();
                undo(this.state);
                this.dropStalePops();
                this.render();
                break;
            case 'quit':
                // Two taps: the first only arms the button (a walk in progress goes on).
                if (this.quit.press(this.deps.now())) this.quitNow();
                else this.refreshQuitButton();
                break;
            case 'swipe':
                // swipes and keys both: one cell in a direction
                this.flow.cancelWalk();
                this.step(action.dir);
                break;
            case 'tap':
                this.onTap(action.x, action.y);
                break;
            default:
                break;
        }
    }

    /** Tap on the board: walk to an empty cell, push an adjacent block, or fail with a small shake. */
    private onTap(x: number, y: number) {
        const cell = cellAt(this.layout, x, y);
        if (!cell) return;
        this.flow.cancelWalk();
        const outcome = tapOutcome(this.state, cell.x, cell.y);
        if (outcome.kind === 'walk') {
            this.playTapMark(cell, 'walk');
            this.flow.startWalk(outcome.path, this.deps.now());
            this.pump(); // the first step happens together with the tap
        } else if (outcome.kind === 'push') {
            this.step(outcome.dir);
        } else if (outcome.kind === 'fail') {
            this.playTapMark(cell, 'fail');
            this.cameras.main.shake(PARAMS.shakeMs, PARAMS.shakeIntensity);
        }
    }

    /** An interruption, not a game over: no result, straight back to the title. */
    private quitNow() {
        if (this.flow.phase !== 'playing') return;
        this.flow.cancelWalk();
        this.scene.start('Title');
    }

    /** The Quit button shows "Quit?" while a second tap would confirm. */
    private refreshQuitButton(now: number = this.deps.now()) {
        const armed = this.quit.armed(now);
        if (armed === this.quitShown) return;
        this.quitShown = armed;
        this.quitButton.label.setText(armed ? 'Quit?' : 'Quit');
        this.quitButton.box.setFillStyle(armed ? COLORS.buttonDangerArmed : COLORS.buttonDanger);
    }

    // ---- moves and the clock -----------------------------------------------------------------

    /** Feeds the clock to the flow and acts on what is due. */
    private pump(now: number = this.deps.now()) {
        const tick = this.flow.tick(now);
        if (tick.walkStep && !this.step(tick.walkStep)) this.flow.cancelWalk();
        if (tick.ended) this.scene.start('Result', { lines: this.state.score });
    }

    /** One move; returns false when blocked. Starts the `ending` wait when the moves run out. */
    private step(dir: Dir): boolean {
        const result = move(this.state, dir, this.deps);
        if (!result.moved) return false;
        this.dropStalePops();
        this.playEffects(result);
        this.render();
        if (this.state.over) {
            this.flow.beginEnding(this.deps.now());
            this.quit.reset();
            this.refreshQuitButton();
        }
        return true;
    }

    // ---- layout ------------------------------------------------------------------------------

    /** Orientation changed while the Scene is shown: only the placement changes, never the run. */
    private relayout(layout: Layout) {
        this.layout = layout;
        this.effects.forEach((o) => this.dispose(o));
        this.popping.clear();
        this.flow.discardPress();
        this.placeUi();
        this.render();
    }

    private placeUi() {
        const l = this.layout;
        this.movesText.setPosition(l.hudMoves.x, l.hudMoves.y).setOrigin(l.hudMoves.originX, 0.5);
        this.linesText.setPosition(l.hudLines.x, l.hudLines.y).setOrigin(l.hudLines.originX, 0.5);
        this.undoButton.place(l.undoButton);
        this.quitButton.place(l.quitButton);
        // Four bars along the canvas border (a stroked rectangle would notch the corners).
        const t = PARAMS.edgeWidth;
        this.edge.clear().fillStyle(COLORS.alarm)
            .fillRect(0, 0, l.viewW, t)
            .fillRect(0, l.viewH - t, l.viewW, t)
            .fillRect(0, t, t, l.viewH - 2 * t)
            .fillRect(l.viewW - t, t, t, l.viewH - 2 * t);
    }

    /** Red pulse on the moves counter (and the screen edge when critical), driven by the moves left. */
    private updateTension() {
        const next = tensionOf(this.state.moves);
        if (next === this.tension) return;
        this.tension = next;
        this.tweens.killTweensOf([this.movesText, this.edge]);
        this.movesText.setScale(1).setColor(next === 'none' ? COLORS.text : COLORS.alarmText);
        this.edge.setAlpha(0);
        if (next === 'none') return;

        const half = (next === 'critical' ? PARAMS.criticalPeriodMs : PARAMS.warnPeriodMs) / 2;
        this.tweens.add({
            targets: this.movesText, scale: PARAMS.warnScale, duration: half, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        if (next === 'critical') {
            this.tweens.add({
                targets: this.edge, alpha: PARAMS.criticalEdgeAlpha, duration: half, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        }
    }

    // ---- drawing -----------------------------------------------------------------------------

    private cellOrigin(x: number, y: number): Pt {
        return { x: this.layout.boardX + x * PARAMS.cellSize, y: this.layout.boardY + y * PARAMS.cellSize };
    }

    private render() {
        const s = this.state;
        const size = PARAMS.cellSize;
        const inset = PARAMS.cellInset;
        const g = this.board.clear();
        s.grid.forEach((row, y) => row.forEach((cell, x) => {
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
        const p = this.cellOrigin(s.px, s.py);
        this.playerDot.setPosition(p.x + size / 2, p.y + size / 2);
        this.movesText.setText(this.movesLabel());
        this.linesText.setText(`ライン ${s.score}`);
        this.updateTension();
        // Undo looks disabled while it can do nothing (empty history, or the run is over)
        const undoAlpha = canUndo(s) ? 1 : PARAMS.disabledAlpha;
        this.undoButton.box.setAlpha(undoAlpha);
        this.undoButton.label.setAlpha(undoAlpha);
        // Dev build only: a read-only snapshot for the browser QA scripts (scripts/qa); removed from production.
        if (import.meta.env.DEV) {
            const rows = s.grid.map((row, y) =>
                row.map((c, x) => (x === s.px && y === s.py ? '@' : '.ox'[c])).join(''));
            Object.assign(window, {
                __qa: {
                    scene: 'Game',
                    phase: this.flow.phase,
                    moves: s.moves,
                    score: s.score,
                    orientation: this.layout.orientation,
                    rows,
                },
            });
        }
    }

    /** A pop-in whose block was pushed away (or covered, or undone) must not keep growing on that cell. */
    private dropStalePops() {
        for (const k of stalePopKeys(this.popping, this.state.grid)) {
            const pop = this.popping.get(k);
            this.popping.delete(k);
            if (pop) this.dispose(pop.rect);
        }
    }

    private movesLabel(): string {
        return `手数 ${this.state.moves}/${PARAMS.maxMoves}`;
    }

    private blockRect(p: KindPt, fill: number, depth: number): GameObjects.Rectangle {
        const o = this.cellOrigin(p.x, p.y);
        const size = PARAMS.cellSize - 2 * PARAMS.cellInset;
        const rect = this.add.rectangle(o.x + PARAMS.cellSize / 2, o.y + PARAMS.cellSize / 2, size, size, fill).setDepth(depth);
        this.effects.add(rect);
        return rect;
    }

    /** An effect finished by itself: forget and destroy its object. */
    private release(obj: GameObjects.GameObject) {
        this.effects.delete(obj);
        obj.destroy();
    }

    /** An effect cut short (layout change): its tweens must not run their completion handlers either. */
    private dispose(obj: GameObjects.GameObject) {
        this.tweens.killTweensOf(obj);
        this.release(obj);
    }

    /** Where a tap landed: a ring spreading on the walk's target, a red frame on a cell that failed. */
    private playTapMark(cell: Pt, kind: 'walk' | 'fail') {
        const o = this.cellOrigin(cell.x, cell.y);
        const cx = o.x + PARAMS.cellSize / 2;
        const cy = o.y + PARAMS.cellSize / 2;
        const inner = PARAMS.cellSize - 2 * PARAMS.cellInset;
        const mark = kind === 'walk'
            ? this.add.circle(cx, cy, PARAMS.cellSize * PARAMS.tapRingRatio).setStrokeStyle(PARAMS.tapRingWidth, COLORS.player)
            : this.add.rectangle(cx, cy, inner, inner).setStrokeStyle(PARAMS.tapFrameWidth, COLORS.alarm);
        mark.setDepth(DEPTH.mark);
        this.effects.add(mark);
        this.tweens.add({
            targets: mark, alpha: 0, scale: kind === 'walk' ? 2 : 1, duration: PARAMS.tapMarkMs,
            onComplete: () => this.release(mark),
        });
    }

    /** "+N" next to the moves counter after a clear: rises and fades; kept inside the canvas. */
    private playRecovered(amount: number) {
        // The counter already shows the new value (its width is read unscaled, so a pulse doesn't move it).
        // Portrait: to the right of the counter. Landscape: right above it, so it stays out of the board.
        this.movesText.setText(this.movesLabel());
        const m = this.movesText;
        const landscape = this.layout.orientation === 'landscape';
        const x = landscape ? m.x : m.x + m.width * (1 - m.originX) + PARAMS.recoveredGap;
        const startY = landscape ? m.y - m.height / 2 - PARAMS.recoveredGap : m.y;
        const text = addLabel(this, x, startY, `+${amount}`, FONT_SIZE.hud, COLORS.recoveredText)
            .setOrigin(landscape ? 0.5 : 0, 0.5)
            .setDepth(DEPTH.hud);
        this.effects.add(text);
        const top = text.height / 2 + PARAMS.recoveredEdgeMargin;
        const toY = Math.max(startY - PARAMS.recoveredRisePx, top);
        this.tweens.add({
            targets: text, y: toY, alpha: 0, duration: PARAMS.recoveredMs, ease: 'Sine.easeOut',
            onComplete: () => this.release(text),
        });
    }

    /** Line clear: blocks shrink away. Thinned leftovers: grey blink then fade. Spawns: pop in. */
    private playEffects(res: MoveResult) {
        const color = (kind: number) => (kind === FIXED ? COLORS.fixed : COLORS.movable);
        if (res.recovered > 0) this.playRecovered(res.recovered);
        res.cleared.forEach((p) => {
            const r = this.blockRect(p, color(p.kind), DEPTH.fx);
            this.tweens.add({
                targets: r, scale: PARAMS.clearShrinkScale, alpha: 0, duration: PARAMS.clearMs,
                onComplete: () => this.release(r),
            });
        });
        res.pruned.forEach((p) => {
            const r = this.blockRect(p, COLORS.pruned, DEPTH.ghost);
            this.tweens.add({
                targets: r, alpha: PARAMS.pruneBlinkAlpha, duration: PARAMS.pruneBlinkMs, yoyo: true, repeat: 1,
                onComplete: () => {
                    this.tweens.add({ targets: r, alpha: 0, duration: PARAMS.pruneFadeMs, onComplete: () => this.release(r) });
                },
            });
        });
        res.spawned.forEach((p) => {
            const k = `${p.x},${p.y}`;
            const r = this.blockRect(p, color(p.kind), DEPTH.fx).setScale(0);
            this.popping.set(k, { rect: r, kind: p.kind });
            this.tweens.add({
                targets: r, scale: 1, duration: PARAMS.popMs, delay: PARAMS.popDelayMs,
                onComplete: () => {
                    this.release(r);
                    if (this.popping.get(k)?.rect === r) this.popping.delete(k);
                    this.dirty = true; // several pop-ins end in the same frame: one redraw in update()
                },
            });
        });
    }
}
