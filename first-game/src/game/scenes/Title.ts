import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { StartGate } from 'title-demo';
import { isStartKey, titleLayout } from '../core/title';

const BACKGROUND_COLOR = 0x0a1f2f;
const GAME_NAME = 'Minefield Rogue';
const BUTTON_FILL = 0x1e3a5f;
const BUTTON_STROKE = 0x60a5fa;
const BUTTON_LABEL_SIZE = 24;

/**
 * The title screen (docs/spec/title.md): the game name and a Start button. Start (a release over the button,
 * Enter or Space) starts `Game`; the first request wins. It reads and writes no storage.
 */
export class Title extends Scene
{
    private gate = new StartGate();
    private nameText!: Phaser.GameObjects.Text;
    private buttonBg!: Phaser.GameObjects.Rectangle;
    private buttonLabel!: Phaser.GameObjects.Text;

    constructor ()
    {
        super('Title');
    }

    create ()
    {
        // Phaser reuses Scene instances: everything is (re)built here, not in field initialisers.
        this.gate = new StartGate();
        this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);

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

        this.buttonBg.on('pointerup', this.onButtonUp, this);
        this.input.keyboard?.on('keydown', this.onKeyDown, this);
        // Space must not scroll the page; the capture belongs to the KeyboardManager, so it is released on shutdown.
        this.input.keyboard?.addCapture('SPACE');
        this.scale.on('resize', this.place, this);
        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown', this.onKeyDown, this);
            this.input.keyboard?.removeCapture('SPACE');
            this.scale.off('resize', this.place, this);
        });

        this.place();
    }

    private place (): void
    {
        const { width, height } = this.scale.gameSize;
        const l = titleLayout(width, height);
        this.nameText.setFontSize(l.fontSize).setPosition(l.centerX, l.nameY);
        this.buttonBg.setSize(l.buttonWidth, l.buttonHeight).setPosition(l.centerX, l.buttonY);
        this.buttonLabel.setPosition(l.centerX, l.buttonY);
    }

    private onButtonUp (pointer: Phaser.Input.Pointer): void
    {
        // A touch the system cancelled (a notification, a gesture) is not a release over the button.
        if (!pointer.wasCanceled) {
            this.begin();
        }
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
