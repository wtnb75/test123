import { Scene, type GameObjects } from 'phaser';
import { TitleDemoRunner } from 'title-demo';
import { C, FONT } from '../palette';
import {
    computeDemoBoardLayout,
    createDemoGame,
    DEMO_OPTIONS,
    DEMO_TURNS,
    describeDemo,
    TITLE_LAYOUT,
    type DemoAction,
    type DemoDetail,
    type DemoState
} from '../titleDemo';

const CENTER_X = 240;
const HEADER_LINE_GAP = 24;
const PANEL_WIDTH = 476;
const BAND_WIDTH = 472;
const BAND_HEIGHT = 48;

interface DemoButton {
    box: GameObjects.Rectangle;
    label: GameObjects.Text;
}

interface DemoRow {
    value: GameObjects.Text;
    buttons: DemoButton[];
}

export class Title extends Scene {
    private runner: TitleDemoRunner<DemoState, DemoAction, DemoDetail> | null = null;
    private block: GameObjects.Container | null = null;
    private headerTop!: GameObjects.Text;
    private headerCurrent!: GameObjects.Text;
    private statusText!: GameObjects.Text;
    private rows: DemoRow[] = [];
    private readonly onStartKey = (): void => {
        this.startGame();
    };

    constructor() {
        super('Title');
    }

    create(): void {
        this.cameras.main.setBackgroundColor(C.BG);
        this.rows = [];

        this.add.text(CENTER_X, TITLE_LAYOUT.nameY, 'Calc Rush', {
            fontFamily: FONT, fontSize: '48px', fontStyle: 'bold', color: C.TEXT
        }).setOrigin(0.5);
        this.add.text(CENTER_X, TITLE_LAYOUT.taglineY, '計算しろ、間に合わせろ!', {
            fontFamily: FONT, fontSize: '20px', color: C.SUB
        }).setOrigin(0.5);
        this.add.text(CENTER_X, TITLE_LAYOUT.hintY, '演算を選んで、目標値に合わせよう', {
            fontFamily: FONT, fontSize: '18px', color: C.SUB
        }).setOrigin(0.5);

        this.buildStartButton();
        this.buildDemo();

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

        this.runner = new TitleDemoRunner(createDemoGame(Math.random), DEMO_OPTIONS);
        this.renderDemo();
    }

    update(_time: number, delta: number): void {
        const runner = this.runner;

        if (runner === null || runner.leaving) {
            return;
        }

        const event = runner.update(delta);

        if (event !== null) {
            this.renderDemo();
        }

        this.block?.setAlpha(runner.opacity());

        if (import.meta.env.DEV) {
            // QA only: a read-only view of the Title and its demo (never part of the production bundle).
            (window as unknown as { __qa?: unknown }).__qa = {
                scene: 'Title',
                demoVisible: true,
                demoPhase: runner.director.phase,
                demoRounds: runner.director.rounds,
                demoRows: runner.state.progress.rows.filter((row) => row.selected !== null).length,
                demoWrong: runner.state.wrong
            };
        }
    }

    private buildStartButton(): void {
        const { startY, startWidth, startHeight } = TITLE_LAYOUT;
        this.add.rectangle(CENTER_X, startY, startWidth, startHeight, C.BTN)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.startGame());
        this.add.text(CENTER_X, startY, 'START', {
            fontFamily: FONT, fontSize: '28px', color: '#f8fafc'
        }).setOrigin(0.5);
    }

    /** The demo board is built once (a Container, so one alpha fades it) and redrawn on each event. */
    private buildDemo(): void {
        const layout = computeDemoBoardLayout();
        const { buttonCenters, buttonWidth, buttonHeight, valueX } = TITLE_LAYOUT;
        const parts: GameObjects.GameObject[] = [];

        this.headerTop = this.add.text(CENTER_X, layout.blockTop, '', {
            fontFamily: FONT, fontSize: '18px', color: C.TEXT
        }).setOrigin(0.5, 0);
        this.headerCurrent = this.add.text(CENTER_X, layout.blockTop + HEADER_LINE_GAP, '', {
            fontFamily: FONT, fontSize: '18px', color: C.TEXT
        }).setOrigin(0.5, 0);
        parts.push(this.headerTop, this.headerCurrent);

        parts.push(this.add.rectangle(CENTER_X, layout.tableTop + layout.panelHeight / 2, PANEL_WIDTH, layout.panelHeight, C.PANEL));

        for (let index = 0; index < DEMO_TURNS; index += 1) {
            const y = layout.rowCenters[index];
            parts.push(this.add.rectangle(CENTER_X, y, BAND_WIDTH, BAND_HEIGHT, index % 2 === 0 ? C.PANEL_ALT : C.PANEL));

            const buttons = buttonCenters.map((x) => {
                const box = this.add.rectangle(x, y, buttonWidth, buttonHeight, C.UNSELECTED);
                const label = this.add.text(x, y, '', { fontFamily: FONT, fontSize: '25px', color: '#f8fafc' }).setOrigin(0.5);
                parts.push(box, label);

                return { box, label };
            });
            const value = this.add.text(valueX, y, '', { fontFamily: FONT, fontSize: '28px', color: C.TEXT }).setOrigin(0, 0.5);
            parts.push(value);
            this.rows.push({ value, buttons });
        }

        this.statusText = this.add.text(CENTER_X, layout.statusY, '', {
            fontFamily: FONT, fontSize: '22px', color: C.WIN
        }).setOrigin(0.5);
        parts.push(this.statusText);

        this.block = this.add.container(0, 0, parts);
    }

    private renderDemo(): void {
        const runner = this.runner;

        if (runner === null) {
            return;
        }

        const view = describeDemo(runner.state);
        this.headerTop.setText(view.headerTop);
        this.headerCurrent.setText(view.headerCurrent).setColor(view.headerCurrentColor);
        this.statusText.setText(view.status).setColor(view.statusColor);

        view.rows.forEach((rowView, index) => {
            const row = this.rows[index];
            row.value.setText(String(rowView.value));

            rowView.buttons.forEach((buttonView, buttonIndex) => {
                const button = row.buttons[buttonIndex];
                button.box.setFillStyle(buttonView.fill);
                button.label.setText(buttonView.label).setColor(buttonView.labelColor);
            });
        });
    }

    private startGame(): void {
        if (this.runner === null || !this.runner.requestStart()) {
            return;
        }

        this.scene.start('Game');
    }
}
