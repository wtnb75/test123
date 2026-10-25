import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { DemoDirector, StartGate } from 'title-demo';
import type { DemoAction } from '../core/demoBot';
import { browserStore } from '../core/highScore';
import { padSettingLabel, readPadHidden, writePadHidden } from '../core/padSetting';
import { REFERENCE_CELL, demoLayout, isStartKey, titleLayout, titleSettingsLayout } from '../core/title';
import {
    TITLE_DEMO_OPTIONS,
    createTitleDemoGame,
    type TitleDemoDetail,
    type TitleDemoState
} from '../core/titleDemo';
import { BoardView } from './boardView';

const BACKGROUND_COLOR = 0x0a1f2f;
const GAME_NAME = 'Minefield Rogue';
const BUTTON_FILL = 0x1e3a5f;
const BUTTON_STROKE = 0x60a5fa;
const BUTTON_LABEL_SIZE = 24;

type Demo = DemoDirector<TitleDemoState, DemoAction, TitleDemoDetail>;

/**
 * The title screen (docs/spec/title.md, docs/spec/title-demo.md): the game name, a demo of a bot playing the
 * first stages, a Start button, and the 「パッド」button that hides the virtual pad and FLAG in `Game`. Start (a
 * release over the button, Enter or Space) starts `Game`; the first request wins. The only storage it touches is the
 * pad setting; it never looks at the start stage or the high score.
 */
export class Title extends Scene
{
    private gate = new StartGate();
    private nameText!: Phaser.GameObjects.Text;
    private buttonBg!: Phaser.GameObjects.Rectangle;
    private buttonLabel!: Phaser.GameObjects.Text;
    private padBg!: Phaser.GameObjects.Rectangle;
    private padLabel!: Phaser.GameObjects.Text;
    /** Whether `Game` hides the virtual pad and FLAG (the saved setting; the button switches it). */
    private padHidden = false;
    /** The pointer whose press started on the 「パッド」button (a release switches the setting only for it). */
    private padPressId: number | null = null;
    private view!: BoardView;
    private demo?: Demo;
    /** Elapsed time of this Scene (ms), counted from `update`'s delta. */
    private clock = 0;
    /** What is drawn now (stage, origin, cell): a resize that changes none of it keeps the drawing. */
    private drawnKey = '';

    constructor ()
    {
        super('Title');
    }

    create ()
    {
        // Phaser reuses Scene instances: everything is (re)built here, not in field initialisers.
        this.gate = new StartGate();
        this.demo = undefined;
        this.drawnKey = '';
        this.clock = 0;
        this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);
        this.view = new BoardView(this, { originX: 0, originY: 0, cell: REFERENCE_CELL });

        this.nameText = this.add.text(0, 0, GAME_NAME, {
            fontFamily: 'monospace',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        // Phaser's own hit test: Rectangle.setSize keeps the hit area in step with the drawn button.
        this.buttonBg = this.add.rectangle(0, 0, 1, 1, BUTTON_FILL, 0.95)
            .setStrokeStyle(2, BUTTON_STROKE)
            .setInteractive({ useHandCursor: true });
        this.buttonLabel = this.add.text(0, 0, 'Start', {
            fontFamily: 'monospace',
            fontSize: BUTTON_LABEL_SIZE,
            fontStyle: 'bold',
            color: '#93c5fd'
        }).setOrigin(0.5);

        this.padHidden = readPadHidden(browserStore());
        this.padPressId = null;
        this.padBg = this.add.rectangle(0, 0, 1, 1, BUTTON_FILL, 0.95)
            .setStrokeStyle(2, BUTTON_STROKE)
            .setInteractive({ useHandCursor: true });
        this.padLabel = this.add.text(0, 0, padSettingLabel(this.padHidden), {
            fontFamily: 'monospace',
            fontSize: 14,
            fontStyle: 'bold',
            color: '#93c5fd'
        }).setOrigin(0.5);

        this.buttonBg.on('pointerup', this.onButtonUp, this);
        this.padBg.on('pointerdown', this.onPadDown, this);
        this.padBg.on('pointerup', this.onPadUp, this);
        // A press that ends off the button does not count for a later release over it.
        this.padBg.on('pointerupoutside', () => {
            this.padPressId = null;
        });
        this.input.keyboard?.on('keydown', this.onKeyDown, this);
        // Space must not scroll the page; the capture belongs to the KeyboardManager, so it is released on shutdown.
        this.input.keyboard?.addCapture('SPACE');
        this.scale.on('resize', this.place, this);
        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown', this.onKeyDown, this);
            this.input.keyboard?.removeCapture('SPACE');
            this.scale.off('resize', this.place, this);
            this.view.destroy();
            this.demo = undefined;
        });

        this.place();
    }

    update (_time: number, delta: number)
    {
        const demo = this.demo;
        if (import.meta.env.DEV) {
            // QA only: a read-only view of the scene (never part of the production bundle).
            (window as unknown as { __qa?: unknown }).__qa = {
                scene: 'Title',
                demoStage: demo?.state.stage.stageNo ?? null,
                demoPhase: demo?.phase ?? null,
                demoRounds: demo?.rounds ?? null
            };
        }
        if (!demo || this.gate.leaving) {
            return;
        }

        this.clock += delta;
        const event = demo.tick(this.clock);
        if (event) {
            const stage = demo.state.stage;
            if (event.kind === 'action') {
                this.view.renderChanged(stage, event.detail.changed);
                this.view.updatePlayer(stage);
            } else if (event.kind === 'advance' || event.kind === 'fade-in') {
                // A different stage (maybe another size) is in place: lay it out and draw it again.
                this.drawDemo();
            }
        }
        this.view.setAlpha(demo.opacity(this.clock));
    }

    private place (): void
    {
        const { width, height } = this.scale.gameSize;
        const l = titleLayout(width, height);
        this.nameText.setFontSize(l.fontSize).setPosition(l.centerX, l.nameY);
        this.buttonBg.setSize(l.buttonWidth, l.buttonHeight).setPosition(l.centerX, l.buttonY);
        this.buttonLabel.setPosition(l.centerX, l.buttonY);
        const p = titleSettingsLayout(width);
        this.padBg.setSize(p.width, p.height).setPosition(p.centerX, p.centerY);
        this.padLabel.setPosition(p.centerX, p.centerY);

        if (!demoLayout(width, height).visible) {
            // Too small to read: the demo stops and is dropped; a new run starts when it fits again.
            this.demo = undefined;
            this.drawnKey = '';
            this.view.destroy();
            return;
        }
        if (!this.demo) {
            this.demo = new DemoDirector(createTitleDemoGame(), TITLE_DEMO_OPTIONS, this.clock);
        }
        this.drawDemo(false);
        this.view.setAlpha(this.demo.opacity(this.clock));
    }

    /** Draws the demo's current stage, centred in the area between the name and the button. */
    private drawDemo (force = true): void
    {
        const demo = this.demo;
        if (!demo) {
            return;
        }
        const { width, height } = this.scale.gameSize;
        const d = demoLayout(width, height);
        const stage = demo.state.stage;
        const layout = {
            originX: Math.round(d.centerX - (stage.width * d.cell) / 2),
            originY: Math.round(d.centerY - (stage.height * d.cell) / 2),
            cell: d.cell
        };
        // The same stage at the same place and size is already on screen (a resize that moved nothing): keep it.
        const key = `${stage.stageNo}:${stage.width}:${layout.originX}:${layout.originY}:${layout.cell}`;
        if (force === false && key === this.drawnKey) {
            return;
        }
        this.drawnKey = key;
        this.view.setLayout(layout);
        this.view.render(stage);
    }

    private onButtonUp (pointer: Phaser.Input.Pointer): void
    {
        // A touch the system cancelled (a notification, a gesture) is not a release over the button.
        if (!pointer.wasCanceled) {
            this.begin();
        }
    }

    private onPadDown (pointer: Phaser.Input.Pointer): void
    {
        this.padPressId = pointer.id;
    }

    /** A release over the 「パッド」button, of the press that started on it, switches the setting (not a start). */
    private onPadUp (pointer: Phaser.Input.Pointer): void
    {
        const own = this.padPressId === pointer.id;
        this.padPressId = null;
        if (!own || pointer.wasCanceled) {
            return;
        }
        this.padHidden = !this.padHidden;
        writePadHidden(browserStore(), this.padHidden);
        this.padLabel.setText(padSettingLabel(this.padHidden));
    }

    private onKeyDown (event: KeyboardEvent): void
    {
        if (isStartKey(event.code, event.repeat)) {
            this.begin();
        }
    }

    private begin (): void
    {
        if (!this.gate.start()) {
            return;
        }
        this.scene.start('Game');
    }
}
