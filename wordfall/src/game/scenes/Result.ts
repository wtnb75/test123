import { Scene, type Cameras, type GameObjects, type Input } from 'phaser';
import {
    COUNT_UP_MS,
    FONT_RESULT,
    FONT_RESULT_SCORE,
    FONT_RESULT_TITLE,
    RESULT_BUTTON_FROM_BOTTOM,
    RESULT_BUTTON_GAP,
    RESULT_BUTTON_W,
    RESULT_INPUT_GUARD_MS,
    RESULT_LIST_BOTTOM_MARGIN,
    RESULT_LIST_TOP,
    RESULT_ROW_H,
    SCREEN_WIDTH,
} from '../params';
import { formatBest } from '../logic/best';
import { blinkTween, countUpValue } from '../logic/effects';
import { WORDS } from '../logic/words';
import { clampScroll, isDragLive, resultInputBlocked, wheelStep, type ResultRow } from '../logic/results';
import {
    addButton,
    addLabel,
    BG_COLOR,
    bestStore,
    type ButtonHandle,
    COLOR,
    MONO_FONT,
    onKeyDown,
    RotateGuard,
    SceneExit,
} from './ui';

export interface ResultData {
    score: number;
    completedCount: number;
    rows: ResultRow[];
}

/** The list is drawn far below the screen so only its own camera (a window onto it) shows it. */
const LIST_WORLD_Y = 10000;
const LIST_LEFT = 16;

export class Result extends Scene {
    private guard!: RotateGuard;
    private exit!: SceneExit;
    private readonly buttons: ButtonHandle[] = [];
    /** Whether input was blocked in the previous frame (to notice the moment it stops being). */
    private wasBlocked = true;
    /** Milliseconds since Result started, summed from frame deltas (Phaser's clock only moves in update). */
    private sinceStartMs = 0;
    private scroll = 0;
    private contentHeight = 0;
    private viewHeight = 0;
    private listCamera?: Cameras.Scene2D.Camera;
    /** Drag in progress on the list: the pointer, its y and the scroll offset when it started. */
    private drag: { id: number; startY: number; startScroll: number } | null = null;

    constructor() {
        super('Result');
    }

    create(data: ResultData) {
        if (import.meta.env.DEV) {
            // Dev-only QA aid: `?qarows=<n>` fills the list with n words so scrolling can be checked.
            const n = Number(new URLSearchParams(window.location.search).get('qarows'));
            if (n > 0) {
                const rows = WORDS.slice(0, n).map((w, i) => ({ en: w.en, ja: w.ja, done: i % 2 === 0 }));
                data = { ...data, rows };
            }
        }
        // The logical size is not re-decided here: it stays what the play used.
        const { width, height } = this.scale.gameSize;
        const cx = width / 2;
        this.cameras.main.setBackgroundColor(BG_COLOR);
        this.sinceStartMs = 0;
        this.scroll = 0;
        this.drag = null;

        const { best, isNew } = bestStore.record(data.score);
        addLabel(this, cx, 24, 'TIME UP', FONT_RESULT_TITLE);
        const scoreText = addLabel(this, cx, 56, `SCORE ${data.score}`, FONT_RESULT_SCORE, COLOR.accent);
        addLabel(this, cx, 84, `WORDS ${data.completedCount}   ${formatBest(best)}`, FONT_RESULT);
        const newBest = isNew ? addLabel(this, cx, 106, 'NEW BEST!', FONT_RESULT, COLOR.accent) : null;
        this.playScoreEffects(scoreText, newBest, data.score);

        this.buildList(data.rows, height);

        // The notice first: it reports to the buttons below when it appears or goes away. The list camera draws
        // above the main camera, so it is hidden while the notice covers the screen.
        const buttons = this.buttons;
        buttons.length = 0; // the Scene instance is reused
        this.wasBlocked = true;
        this.guard = new RotateGuard(this, (active) => {
            this.listCamera?.setVisible(!active);
            buttons.forEach((b) => b.reset());
        });
        this.exit = new SceneExit(this);
        const buttonY = height - RESULT_BUTTON_FROM_BOTTOM;
        const dx = (RESULT_BUTTON_W + RESULT_BUTTON_GAP) / 2;
        const accepting = () => !this.blocked();
        buttons.push(
            addButton(this, cx - dx, buttonY, 'もう一度', () => this.exit.to('Game'), RESULT_BUTTON_W, accepting),
            addButton(this, cx + dx, buttonY, 'タイトルへ', () => this.exit.to('Title'), RESULT_BUTTON_W, accepting),
        );
        onKeyDown(this, (key) => {
            if (this.blocked()) return;
            if (key === ' ' || key === 'Enter') this.exit.to('Game');
        });
        onKeyDown(
            this,
            (key) => {
                if (this.blocked()) return;
                if (key === 'ArrowUp') this.scrollBy(-RESULT_ROW_H);
                if (key === 'ArrowDown') this.scrollBy(RESULT_ROW_H);
            },
            true,
        );
        if (import.meta.env.DEV) {
            const qa = {};
            Object.defineProperties(qa, {
                scene: { get: () => 'Result' },
                size: { get: () => ({ w: this.scale.gameSize.width, h: this.scale.gameSize.height }) },
                scroll: { get: () => this.scroll },
                blocked: { get: () => this.blocked() },
                rows: { get: () => data.rows.length },
            });
            (window as unknown as { __qa: unknown }).__qa = qa;
        }
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.endDrag, this);
        this.input.on('pointerupoutside', this.endDrag, this);
        this.input.on('wheel', this.onWheel, this);
        this.events.once('shutdown', () => {
            this.input.off('pointerdown', this.onPointerDown, this);
            this.input.off('pointermove', this.onPointerMove, this);
            this.input.off('pointerup', this.endDrag, this);
            this.input.off('pointerupoutside', this.endDrag, this);
            this.input.off('wheel', this.onWheel, this);
        });
    }

    /** Buttons and keys do nothing while the rotate notice shows or just after Result started. */
    private blocked(): boolean {
        return this.guard.active || resultInputBlocked(this.sinceStartMs, RESULT_INPUT_GUARD_MS);
    }

    update(_time: number, delta: number) {
        this.sinceStartMs += delta;
        // When input starts being accepted (the guard time ends), a mouse resting on a button shows its hover look:
        // no pointer event will announce it.
        const blocked = this.blocked();
        if (this.wasBlocked && !blocked) this.buttons.forEach((b) => b.refresh());
        this.wasBlocked = blocked;
    }

    /**
     * The score counts up from 0, then NEW BEST! blinks (docs/spec.md "演出・UI（Result）"). Both are Phaser
     * tweens; they don't take input, and they are destroyed with the Scene.
     */
    private playScoreEffects(scoreText: GameObjects.Text, newBest: GameObjects.Text | null, score: number) {
        if (score > 0) {
            scoreText.setText('SCORE 0');
            this.tweens.addCounter({
                from: 0,
                to: COUNT_UP_MS,
                duration: COUNT_UP_MS,
                onUpdate: (tween) => scoreText.setText(`SCORE ${countUpValue(tween.getValue() ?? COUNT_UP_MS, score)}`),
                onComplete: () => scoreText.setText(`SCORE ${score}`),
            });
        }
        if (newBest) {
            const blink = blinkTween();
            this.tweens.add({
                targets: newBest,
                alpha: blink.alphaTo,
                duration: blink.halfMs,
                yoyo: true,
                repeat: blink.repeat,
                delay: blink.delayMs,
            });
        }
    }

    // ---- word list -----------------------------------------------------------------------------------

    private buildList(rows: ResultRow[], height: number) {
        this.viewHeight = height - RESULT_LIST_BOTTOM_MARGIN - RESULT_LIST_TOP;
        this.contentHeight = rows.length * RESULT_ROW_H;
        rows.forEach((row, i) => {
            const mark = row.done ? '✓' : '・';
            this.add
                .text(LIST_LEFT, LIST_WORLD_Y + i * RESULT_ROW_H, `${mark} ${row.en.padEnd(9)} ${row.ja}`, {
                    fontFamily: MONO_FONT,
                    fontSize: `${FONT_RESULT}px`,
                    color: row.done ? COLOR.good : COLOR.muted,
                })
                .setOrigin(0, 0);
        });
        // A camera whose window is the list region, looking at the list's world position.
        this.listCamera = this.cameras.add(0, RESULT_LIST_TOP, SCREEN_WIDTH, this.viewHeight);
        this.applyScroll();
    }

    private scrollBy(delta: number) {
        this.scroll = clampScroll(this.scroll + delta, this.contentHeight, this.viewHeight);
        this.applyScroll();
    }

    private applyScroll() {
        this.listCamera?.setScroll(0, LIST_WORLD_Y + this.scroll);
    }

    private inList(p: Input.Pointer): boolean {
        return p.y >= RESULT_LIST_TOP && p.y < RESULT_LIST_TOP + this.viewHeight;
    }

    private onPointerDown(p: Input.Pointer) {
        // Only the first finger on the list drags; a second finger is ignored until it lets go. A drag whose
        // finger is gone without a pointerup (cancelled touch, rotate notice) is dropped first.
        if (this.drag && !isDragLive(this.drag.id, [this.input.mousePointer, ...this.input.manager.pointers])) {
            this.drag = null;
        }
        if (this.guard.active || this.drag || !this.inList(p)) return;
        this.drag = { id: p.id, startY: p.y, startScroll: this.scroll };
    }

    private onPointerMove(p: Input.Pointer) {
        if (!this.drag || p.id !== this.drag.id || !p.isDown || this.guard.active) return;
        this.scroll = clampScroll(this.drag.startScroll - (p.y - this.drag.startY), this.contentHeight, this.viewHeight);
        this.applyScroll();
    }

    private endDrag(p: Input.Pointer) {
        if (this.drag && p.id === this.drag.id) this.drag = null;
    }

    /** The wheel scrolls the list only while the pointer is over it, a fixed number of rows per notch. */
    private onWheel(p: Input.Pointer, _over: GameObjects.GameObject[], _dx: number, dy: number) {
        if (this.guard.active || !this.inList(p)) return;
        this.scrollBy(wheelStep(dy));
    }
}
