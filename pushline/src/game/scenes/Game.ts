import { Scene, type GameObjects, type Input } from 'phaser';
import { PARAMS } from '../params';
import type { Deps, Dir, MoveResult, Pt, State } from '../logic/types';
import { BestKeeper, bestLabel, browserStorage } from '../logic/best';
import { Flow, QuitConfirm, type PointerAction } from '../logic/flow';
import { cellAt, type Layout } from '../logic/layout';
import { canUndo, createState, move, tapOutcome, undo } from '../logic/rules';
import { minClearPlan } from '../logic/solve';
import { tensionOf, type Tension } from '../logic/tension';
import { BoardView, qaRows } from './boardView';
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

    private view!: BoardView;
    private movesText!: GameObjects.Text;
    private linesText!: GameObjects.Text;
    /** The best record of this run: read once when the Game starts, saved as the line count beats it. */
    private best!: BestKeeper;
    private bestText!: GameObjects.Text;
    private undoButton!: ButtonView;
    private quitButton!: ButtonView;
    /** Red frame around the canvas that pulses in the `critical` tension (never interactive). */
    private edge!: GameObjects.Graphics;
    private tension: Tension = 'none';

    constructor() {
        super('Game');
    }

    create() {
        // Phaser reuses Scene instances, so everything is (re)built here, not in field initialisers.
        this.layout = applyLayout(this);
        this.deps = { rng: Math.random, now: () => performance.now() };
        this.state = createState(this.deps);
        // Dev build only: start at a line count (?qaLines=9) so the board growth can be checked in a browser.
        // ?qaSolve replays the shortest path to the next line clear, so the growth itself can be seen.
        if (import.meta.env.DEV) {
            const qa = new URLSearchParams(window.location.search);
            const lines = Number(qa.get('qaLines'));
            if (lines > 0) this.state.score = lines;
            if (qa.has('qaSolve')) {
                const plan = minClearPlan(this.state.grid, this.state.px, this.state.py, PARAMS.maxMoves) ?? [];
                let next = 0;
                if (plan.length > 0) {
                    this.time.addEvent({
                        delay: 400,
                        repeat: plan.length - 1,
                        callback: () => {
                            this.step(plan[next]);
                            next += 1;
                        },
                    });
                }
            }
        }
        this.flow = new Flow();
        this.quit = new QuitConfirm();
        this.quitShown = false;
        this.cameras.main.fadeIn(PARAMS.sceneFadeMs);

        this.cameras.main.setBackgroundColor(COLORS.bg);
        this.view = new BoardView(this, this.layout);
        this.movesText = addLabel(this, 0, 0, '', FONT_SIZE.hud).setDepth(DEPTH.hud);
        this.linesText = addLabel(this, 0, 0, '', FONT_SIZE.hud).setDepth(DEPTH.hud);
        this.best = new BestKeeper(browserStorage());
        this.bestText = addLabel(this, 0, 0, '', FONT_SIZE.best, COLORS.captionText).setDepth(DEPTH.hud);
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
        if (this.view.takeDirty()) this.render();
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
                this.view.completeStaging();
                this.flow.cancelWalk();
                undo(this.state);
                this.view.dropStalePops(this.state.grid);
                this.render();
                break;
            case 'quit':
                // Two taps: the first only arms the button (a walk in progress goes on).
                if (this.quit.press(this.deps.now())) this.quitNow();
                else this.refreshQuitButton();
                break;
            case 'swipe':
                // swipes and keys both: one cell in a direction
                this.view.completeStaging();
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
        const cell = cellAt(this.layout, x, y, this.state.grid[0].length);
        if (!cell) return;
        this.flow.cancelWalk();
        const outcome = tapOutcome(this.state, cell.x, cell.y);
        if (outcome.kind !== 'none') this.view.completeStaging();
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
        if (tick.ended) {
            const best = this.best.update(this.state.score);
            this.scene.start('Result', { lines: this.state.score, shortest: this.state.bonusCount, best });
        }
    }

    /** One move; returns false when blocked. Starts the `ending` wait when the moves run out. */
    private step(dir: Dir): boolean {
        const result = move(this.state, dir, this.deps);
        if (!result.moved) return false;
        // a board that grew on this clear is drawn at its new cell size from this move on (instant switch)
        this.view.setCols(this.state.grid[0].length);
        this.view.dropStalePops(this.state.grid);
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
        this.view.setLayout(layout);
        this.flow.discardPress();
        this.placeUi();
        this.render();
    }

    private placeUi() {
        const l = this.layout;
        this.movesText.setPosition(l.hudMoves.x, l.hudMoves.y).setOrigin(l.hudMoves.originX, 0.5);
        this.linesText.setPosition(l.hudLines.x, l.hudLines.y).setOrigin(l.hudLines.originX, 0.5);
        this.bestText.setPosition(l.hudBest.x, l.hudBest.y).setOrigin(0.5);
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

    private render() {
        const s = this.state;
        // every path that changes the grid (move, undo) reaches the view through here
        this.view.setCols(s.grid[0].length);
        this.view.render(s);
        this.movesText.setText(this.movesLabel());
        this.linesText.setText(`ライン ${s.score}`);
        this.renderBest();
        this.updateTension();
        // Undo looks disabled while it can do nothing (empty history, or the run is over)
        const undoAlpha = canUndo(s) ? 1 : PARAMS.disabledAlpha;
        this.undoButton.box.setAlpha(undoAlpha);
        this.undoButton.label.setAlpha(undoAlpha);
        // Dev build only: a read-only snapshot for the browser QA scripts (scripts/qa); removed from production.
        if (import.meta.env.DEV) {
            Object.assign(window, {
                __qa: {
                    scene: 'Game',
                    phase: this.flow.phase,
                    moves: s.moves,
                    score: s.score,
                    spent: s.spent,
                    shortest: s.shortest,
                    bonusCount: s.bonusCount,
                    orientation: this.layout.orientation,
                    rows: qaRows(s),
                },
            });
        }
    }

    /** The HUD's best row: decided (and saved, when beaten) from the current line count; hidden when there is none. */
    private renderBest() {
        const row = this.best.update(this.state.score);
        this.bestText.setVisible(row !== null);
        if (row === null) return;
        this.bestText.setText(bestLabel(row)).setColor(row.updated ? COLORS.recoveredText : COLORS.captionText);
    }

    private movesLabel(): string {
        return `手数 ${this.state.moves}/${PARAMS.maxMoves}`;
    }

    /** Where a tap landed: a ring spreading on the walk's target, a red frame on a cell that failed. */
    private playTapMark(cell: Pt, kind: 'walk' | 'fail') {
        const o = this.view.cellOrigin(cell.x, cell.y);
        const size = this.view.cellSize;
        const cx = o.x + size / 2;
        const cy = o.y + size / 2;
        const inner = size - 2 * PARAMS.cellInset;
        const mark = kind === 'walk'
            ? this.add.circle(cx, cy, size * PARAMS.tapRingRatio).setStrokeStyle(PARAMS.tapRingWidth, COLORS.player)
            : this.add.rectangle(cx, cy, inner, inner).setStrokeStyle(PARAMS.tapFrameWidth, COLORS.alarm);
        mark.setDepth(DEPTH.mark);
        this.view.track(mark);
        this.tweens.add({
            targets: mark, alpha: 0, scale: kind === 'walk' ? 2 : 1, duration: PARAMS.tapMarkMs,
            onComplete: () => this.view.release(mark),
        });
    }

    /**
     * "+N" next to the moves counter after a clear, with a differently coloured "最短!" after it when the
     * shortest-clear bonus was earned: rises and fades; kept inside the canvas.
     */
    private playRecovered(amount: number, bonus: boolean) {
        // The counter already shows the new value (its width is read unscaled, so a pulse doesn't move it).
        // Portrait: to the right of the counter. Landscape: right above it, so it stays out of the board.
        this.movesText.setText(this.movesLabel());
        const m = this.movesText;
        const landscape = this.layout.orientation === 'landscape';
        const startY = landscape ? m.y - m.height / 2 - PARAMS.recoveredGap : m.y;
        const parts = [addLabel(this, 0, startY, `+${amount}`, FONT_SIZE.hud, COLORS.recoveredText)];
        if (bonus) parts.push(addLabel(this, 0, startY, '最短!', FONT_SIZE.hud, COLORS.bonusText));
        parts.forEach((t) => t.setOrigin(0, 0.5).setDepth(DEPTH.hud));
        // Landscape: "+N" and "最短!" side by side, centred over the counter. Portrait: "最短!" under "+N", so
        // the pair stays clear of the "ライン N" at the right end of the same row.
        const margin = PARAMS.recoveredEdgeMargin;
        const room = this.layout.viewW - margin;
        const total = parts.reduce((w, t) => w + t.width, 0) + PARAMS.recoveredGap * (parts.length - 1);
        const left = landscape ? m.x - total / 2 : m.x + m.width * (1 - m.originX) + PARAMS.recoveredGap;
        let x = Math.max(margin, Math.min(left, room - (landscape ? total : Math.max(...parts.map((t) => t.width)))));
        const rise = Math.min(PARAMS.recoveredRisePx, startY - (parts[0].height / 2 + margin));
        parts.forEach((t, i) => {
            const y = landscape ? startY : startY + i * t.height;
            t.setPosition(x, y);
            if (landscape) x += t.width + PARAMS.recoveredGap;
            this.view.track(t);
            this.tweens.add({
                targets: t, y: y - rise, alpha: 0, duration: PARAMS.recoveredMs, ease: 'Sine.easeOut',
                onComplete: () => this.view.release(t),
            });
        });
    }

    /** The effects of one move: the "+N" of a recovery, and the blocks' clear / thin-out / pop-in. */
    private playEffects(res: MoveResult) {
        if (res.recovered > 0) this.playRecovered(res.recovered, res.bonus);
        this.view.playBlockEffects(res);
    }
}
