import { Scene, type GameObjects } from 'phaser';
import { TitleDemoRunner } from 'title-demo';
import {
    TITLE_HINT_SIZE, TITLE_NAME_SIZE, TITLE_START_SIZE, TITLE_TAGLINE_SIZE, TITLE_VEIL_ALPHA
} from '../logic/constants';
import { DEMO_RUN_GAME, DEMO_RUN_OPTIONS } from '../logic/demoRun';
import { computeScreenSize } from '../logic/screen';
import { computeTitleLayout } from '../logic/titleLayout';

const FONT = 'monospace';
const START_FILL = 0x3b82f6;
const TAGLINE_COLOR = '#cccccc';
const HINT_COLOR = '#aaaaaa';
const WHITE = '#ffffff';
/** Left and right margin kept free beside a hint line. */
const HINT_MARGIN = 40;
const DEPTH_VEIL = 0;
const DEPTH_CURTAIN = 1;
const DEPTH_UI = 2;

/**
 * The first screen: name, tagline, START and the controls over the real game played by a bot (the Demo
 * scene, which sits below this one). START begins a normal run; the clock rebuilds the demo now and then.
 */
export class Title extends Scene {
    private runner: TitleDemoRunner<null, 0, null> | null = null;
    private curtain!: GameObjects.Rectangle;
    private readonly onStartKey = (): void => {
        this.startGame();
    };

    constructor() {
        super('Title');
    }

    create(): void {
        const size = computeScreenSize(window.innerWidth, window.innerHeight);
        if (this.scale.width !== size.width || this.scale.height !== size.height) {
            this.scale.setGameSize(size.width, size.height);
        }
        this.cameras.main.setSize(size.width, size.height);

        this.buildTexts(size);

        // The Demo scene is registered after this one; keep this scene above it.
        this.scene.launch('Demo');
        this.scene.bringToTop();

        const keyboard = this.input.keyboard;
        // Space must not scroll the page; the capture belongs to the KeyboardManager, so it is released on shutdown.
        keyboard?.addCapture('SPACE');
        keyboard?.on('keydown-ENTER', this.onStartKey);
        keyboard?.on('keydown-SPACE', this.onStartKey);
        this.events.once('shutdown', () => {
            keyboard?.removeCapture('SPACE');
            keyboard?.off('keydown-ENTER', this.onStartKey);
            keyboard?.off('keydown-SPACE', this.onStartKey);
        });

        this.runner = new TitleDemoRunner(DEMO_RUN_GAME, DEMO_RUN_OPTIONS);
    }

    update(_time: number, delta: number): void {
        const runner = this.runner;
        if (runner === null || runner.leaving) return;

        const event = runner.update(delta);
        if (event !== null && event.kind === 'fade-in') {
            // The screen is black: a new world starts under the lifting curtain.
            this.scene.stop('Demo');
            this.scene.launch('Demo');
        }
        this.curtain.setAlpha(1 - runner.opacity());

        if (import.meta.env.DEV) {
            // QA only: a read-only view of the Title and its demo (never part of the production bundle).
            (window as unknown as { __qa?: unknown }).__qa = {
                scene: 'Title',
                demoVisible: true,
                demoPhase: runner.director.phase,
                demoRounds: runner.director.rounds,
                clock: runner.clock,
                curtain: this.curtain.alpha
            };
        }
    }

    private buildTexts(size: { width: number; height: number }): void {
        const layout = computeTitleLayout(size);
        const x = layout.centerX;

        this.add.rectangle(x, size.height / 2, size.width, size.height, 0x000000, TITLE_VEIL_ALPHA).setDepth(DEPTH_VEIL);
        this.curtain = this.add.rectangle(x, size.height / 2, size.width, size.height, 0x000000, 1)
            .setAlpha(0).setDepth(DEPTH_CURTAIN);

        this.add.text(x, layout.nameY, 'absorb', {
            fontFamily: FONT, fontSize: TITLE_NAME_SIZE, fontStyle: 'bold', color: WHITE
        }).setOrigin(0.5).setDepth(DEPTH_UI);
        this.add.text(x, layout.taglineY, '弾を吸って、撃ち返せ', {
            fontFamily: FONT, fontSize: TITLE_TAGLINE_SIZE, color: TAGLINE_COLOR
        }).setOrigin(0.5).setDepth(DEPTH_UI);

        this.add.rectangle(x, layout.startY, layout.startWidth, layout.startHeight, START_FILL)
            .setDepth(DEPTH_UI)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.startGame());
        this.add.text(x, layout.startY, 'START', {
            fontFamily: FONT, fontSize: TITLE_START_SIZE, color: WHITE
        }).setOrigin(0.5).setDepth(DEPTH_UI);

        this.addHint(x, layout.hint1Y, '移動: 矢印 / WASD　解放: Space / X / Enter', size.width);
        this.addHint(x, layout.hint2Y, 'タッチ: ドラッグで移動 / ボタンか 2 本目の指で解放', size.width);
    }

    /** A one-line hint, shrunk to fit if the font renders it wider than the screen allows. */
    private addHint(x: number, y: number, label: string, screenWidth: number): void {
        const text = this.add.text(x, y, label, {
            fontFamily: FONT, fontSize: TITLE_HINT_SIZE, color: HINT_COLOR
        }).setOrigin(0.5).setDepth(DEPTH_UI);
        const room = screenWidth - HINT_MARGIN * 2;
        if (text.width > room) text.setScale(room / text.width);
    }

    private startGame(): void {
        if (this.runner === null || !this.runner.requestStart()) return;

        this.scene.stop('Demo');
        this.scene.start('Game');
    }
}
