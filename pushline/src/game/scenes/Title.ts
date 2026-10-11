import { Scene, type GameObjects } from 'phaser';
import { PARAMS } from '../params';
import { Demo } from '../logic/demo';
import type { Layout } from '../logic/layout';
import { isStartKey, TitleGate } from '../logic/titleGate';
import { BoardView, qaRows } from './boardView';
import { addLabel, applyLayout, COLORS, createButton, DEPTH, watchOrientation, type ButtonView } from './ui';

/**
 * The title screen: the name, the Start button and a demo (solver-guided auto-play) on a board at the
 * same place as the Game board. The demo's rules and clock live in `logic/demo`; this Scene feeds it the
 * time, draws it, and takes only Start / Space / Enter as input.
 */
export class Title extends Scene {
    private layout!: Layout;
    private nameText!: GameObjects.Text;
    private start!: ButtonView;
    private view!: BoardView;
    private demo!: Demo;
    /** Lets only the first start request through, so two inputs in one frame start the next Scene once. */
    private gate!: TitleGate;

    constructor() {
        super('Title');
    }

    create() {
        this.gate = new TitleGate();
        this.layout = applyLayout(this);
        this.cameras.main.setBackgroundColor(COLORS.bg);

        this.view = new BoardView(this, this.layout);
        // The demo has its own randomness and clock: it never shares state with a Game.
        this.demo = new Demo({ rng: Math.random, now: () => performance.now() }, performance.now());
        this.nameText = addLabel(this, 0, 0, 'pushline', this.layout.titleFontPx).setDepth(DEPTH.hud);
        this.start = createButton(this, 'Start', COLORS.buttonDefault, DEPTH.hud);
        this.start.box.setInteractive({ useHandCursor: true }).on('pointerup', () => this.begin());
        this.cameras.main.fadeIn(PARAMS.sceneFadeMs);
        this.tweens.add({
            targets: [this.start.box, this.start.label], scale: PARAMS.startPulseScale,
            duration: PARAMS.startPulseMs / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
            if (isStartKey(e.code, e.repeat)) this.begin();
        });
        this.input.keyboard?.addCapture('SPACE');
        this.events.once('shutdown', () => this.input.keyboard?.removeCapture('SPACE'));

        this.place();
        this.render();
        this.publishQa();
        watchOrientation(this, () => this.layout, (layout) => {
            this.layout = layout;
            this.view.setLayout(layout);
            this.place();
            this.render();
        });
    }

    update() {
        if (this.gate.leaving) return;
        const now = performance.now();
        const event = this.demo.tick(now);
        if (event?.kind === 'move') {
            this.view.dropStalePops(this.demo.state.grid);
            this.view.playBlockEffects(event.result);
        } else if (event?.kind === 'fade-out') {
            this.view.discardEffects(); // the effects still playing are dropped with the board
        }
        // One redraw per frame: a move, a swap to a new board, or a pop-in that just finished.
        const popFinished = this.view.takeDirty();
        if (event || popFinished) this.render();
        this.view.setAlpha(this.demo.opacity(now));
        this.publishQa();
    }

    private place() {
        const l = this.layout;
        this.nameText.setPosition(l.titleName.x, l.titleName.y).setFontSize(l.titleFontPx);
        this.start.place(l.titleButton);
    }

    private render() {
        this.view.render(this.demo.state);
    }

    /** Dev build only: a read-only snapshot for the browser QA scripts (scripts/qa); removed from production. */
    private publishQa() {
        if (!import.meta.env.DEV) return;
        const s = this.demo.state;
        Object.assign(window, {
            __qa: { scene: 'Title', phase: this.demo.phase, score: s.score, orientation: this.layout.orientation, rows: qaRows(s) },
        });
    }

    private begin() {
        if (!this.gate.start()) return;
        this.view.discardEffects();
        this.scene.start('Game');
    }
}
