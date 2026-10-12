import { Scene, type GameObjects } from 'phaser';
import { TitleDemoRunner } from 'title-demo';
import { PARAMS } from '../params';
import { DEMO_RUN_GAME, DEMO_RUN_OPTIONS } from '../logic/demoRun';
import type { Layout } from '../logic/layout';
import { computeTitleLayout } from '../logic/titleLayout';
import type { DemoData } from './DemoGame';
import { addButton, addLabel, applyLayout, fadeInScene } from './ui';

const DEPTH_VEIL = 0;
const DEPTH_CURTAIN = 1;
const DEPTH_UI = 2;
const STROKE = '#000000';
const STROKE_WIDTH = 4;

/** The explanation lines (docs/spec/title-demo.md "Title のレイアウト"). */
const infoLines = (): string[] => [
    `モグラ +${PARAMS.scoreMole}\u3000／\u3000ネコは叩いちゃダメ ${PARAMS.scoreFriend}`,
    'スクロール: ドラッグ ／ 矢印キー',
    '叩く: タップ ／ クリック ／ Space',
];

/**
 * The first screen: name, tagline, how to play and START over the real game played by a bot (the Demo scene,
 * which sits below this one). The shared clock rebuilds the demo now and then behind a black curtain.
 */
export class Title extends Scene {
    private runner: TitleDemoRunner<null, 0, null> | null = null;
    private curtain!: GameObjects.Rectangle;
    private layout!: Layout;

    constructor() {
        super('Title');
    }

    create() {
        this.layout = applyLayout(this);
        const t = computeTitleLayout(this.layout);
        const cx = this.layout.viewW / 2;
        const { viewW, viewH } = this.layout;
        fadeInScene(this);

        // The demo is the backdrop: a veil for legibility, a curtain for the rebuilds, then the texts.
        this.add.rectangle(cx, viewH / 2, viewW, viewH, 0x000000, PARAMS.titleVeilAlpha).setDepth(DEPTH_VEIL);
        this.curtain = this.add.rectangle(cx, viewH / 2, viewW, viewH, 0x000000, 1).setAlpha(0).setDepth(DEPTH_CURTAIN);
        const outline = (label: GameObjects.Text) => label.setStroke(STROKE, STROKE_WIDTH).setDepth(DEPTH_UI);
        outline(addLabel(this, cx, t.nameY, 'モグラ巡り', 96));
        outline(addLabel(this, cx, t.taglineY, '広い盤面を動き回って、モグラを叩こう！', 34, '#e8f5e9'));
        outline(addLabel(this, cx, t.infoY, infoLines().join('\n'), t.infoSize)).setLineSpacing(10);
        addButton(this, cx, t.buttonY, 'スタート', () => this.begin(), DEPTH_UI);

        this.input.keyboard?.on('keydown-ENTER', this.onKey, this);
        this.input.keyboard?.on('keydown-SPACE', this.onKey, this);
        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown-ENTER', this.onKey, this);
            this.input.keyboard?.off('keydown-SPACE', this.onKey, this);
            // Whatever way the Title ends, the demo behind it does not outlive it.
            this.scene.stop('Demo');
        });

        this.runner = new TitleDemoRunner(DEMO_RUN_GAME, DEMO_RUN_OPTIONS);
        const data: DemoData = { layout: this.layout };
        this.scene.launch('Demo', data);
        this.scene.bringToTop();
    }

    update(_time: number, delta: number) {
        const runner = this.runner;
        if (runner === null || runner.leaving) return;

        const event = runner.update(delta);
        if (event !== null && event.kind === 'fade-in') {
            // The screen is black: a new board starts under the lifting curtain.
            const data: DemoData = { layout: this.layout };
            this.scene.stop('Demo');
            this.scene.launch('Demo', data);
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
                curtain: this.curtain.alpha,
            };
        }
    }

    private onKey(event: KeyboardEvent) {
        if (!event.repeat) this.begin();
    }

    private begin() {
        if (this.runner === null || !this.runner.requestStart()) return;
        this.scene.stop('Demo');
        this.scene.start('Game');
    }
}
