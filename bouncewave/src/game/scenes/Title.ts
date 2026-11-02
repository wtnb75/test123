import { Scale, Scene } from 'phaser';
import { TitleDemoRunner } from 'title-demo';
import { HUD_FONT_SIZE, TITLE_FONT_SIZE } from '../params';
import { formatBest } from '../logic/best';
import {
    createDemoState,
    demoEnded,
    demoLayout,
    demoStepMs,
    stepDemo,
    TITLE_DEMO_GAME,
    TITLE_DEMO_OPTIONS,
    type DemoLayout,
    type DemoState,
} from '../logic/titleDemo';
import { fadeInScene } from './effects';
import { TitleDemoView } from './TitleDemoView';
import {
    addButton,
    addLabel,
    applyScreenSize,
    bestStore,
    makeTextures,
    onKeyPress,
    RotateGuard,
    SceneExit,
    screenSizeChanged,
} from './ui';

const newSeed = (): number => Math.floor(Math.random() * 0x100000000);

export class Title extends Scene {
    private guard!: RotateGuard;
    private exit!: SceneExit;
    private runner!: TitleDemoRunner<number, number, undefined>;
    private demo!: DemoState;
    private layout!: DemoLayout;
    /** The demo window; absent when the screen is too short to show it. */
    private view?: TitleDemoView;

    /** Rebuilt for a new logical size after a rotation: no fade, so rotating doesn't flash the screen black. */
    private relayout = false;

    constructor() {
        super('Title');
    }

    init(data: { relayout?: boolean }) {
        this.relayout = data?.relayout === true;
    }

    create() {
        const { width, height } = applyScreenSize(this);
        if (!this.relayout) fadeInScene(this);
        makeTextures(this);
        const cx = width / 2;
        this.layout = demoLayout(height);
        addLabel(this, cx, this.layout.nameY, '打ち返しインベーダー', TITLE_FONT_SIZE);
        addLabel(this, cx, this.layout.bestY, formatBest(bestStore.load()), HUD_FONT_SIZE, '#ffe680');
        addButton(this, cx, this.layout.startY, 'START', () => this.start());
        onKeyPress(this, ['ENTER', 'SPACE'], () => this.start());

        // A new run at time 0 on every visit; the Run itself is stepped in update() with the frame's delta.
        this.runner = new TitleDemoRunner(TITLE_DEMO_GAME, TITLE_DEMO_OPTIONS);
        this.demo = createDemoState(newSeed());
        this.view = this.layout.visible ? new TitleDemoView(this, this.layout, this.demo.run.dangerY) : undefined;
        this.view?.reset(this.demo);

        this.guard = new RotateGuard(this);
        this.exit = new SceneExit(this);
        // Rotating the device on Title re-decides the logical size (rebuilding the screen at the new size).
        this.scale.on(Scale.Events.RESIZE, this.onResize, this);
        this.events.once('shutdown', () => this.scale.off(Scale.Events.RESIZE, this.onResize, this));
        if (import.meta.env.DEV) {
            // QA only, written inline so none of it reaches the production bundle (docs/spec/title-demo.md).
            Object.defineProperty(window, '__qa', {
                configurable: true,
                get: () => ({
                    scene: 'Title',
                    demoVisible: this.layout.visible,
                    demoPhase: this.runner.director.phase,
                    demoRounds: this.runner.director.rounds,
                    demoWave: this.demo.run.wave,
                    demoPaddleX: this.demo.paddleX,
                }),
            });
        }
    }

    update(_time: number, deltaMs: number) {
        // Cut long frames like the game does, so a hidden tab never skips the demo ahead.
        const ms = demoStepMs(deltaMs);
        const event = this.runner.update(ms);
        if (this.runner.leaving) return;
        if (event?.kind === 'fade-in') this.restartRun();
        stepDemo(this.demo, ms / 1000);
        if (demoEnded(this.demo)) this.restartRun();
        this.view?.sync(this.demo);
        this.view?.setAlpha(this.runner.opacity());
    }

    /** A new Run (new seed, paddle back in the middle) drawn from scratch. */
    private restartRun() {
        this.demo = createDemoState(newSeed());
        this.view?.reset(this.demo);
    }

    private onResize() {
        if (screenSizeChanged(this)) this.exit.to('Title', { relayout: true });
    }

    private start() {
        if (!this.guard.active && this.runner.requestStart()) this.exit.to('Game');
    }
}
