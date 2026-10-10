import { Scene, type GameObjects } from 'phaser';
import { PARAMS } from '../params';
import type { Layout } from '../logic/layout';
import { addLabel, applyLayout, COLORS, createButton, DEPTH, FONT_SIZE, watchOrientation, type ButtonView } from './ui';

export class Title extends Scene {
    private layout!: Layout;
    private nameText!: GameObjects.Text;
    private start!: ButtonView;
    /** Set once the Scene is on its way out, so two inputs in one frame start the next Scene only once. */
    private leaving = false;

    constructor() {
        super('Title');
    }

    create() {
        this.leaving = false;
        this.layout = applyLayout(this);
        this.cameras.main.setBackgroundColor(COLORS.bg);

        this.nameText = addLabel(this, 0, 0, 'pushline', FONT_SIZE.headline);
        this.start = createButton(this, 'Start', COLORS.buttonDefault, DEPTH.hud);
        this.start.box.setInteractive({ useHandCursor: true }).on('pointerup', () => this.begin());
        this.cameras.main.fadeIn(PARAMS.sceneFadeMs);
        this.tweens.add({
            targets: [this.start.box, this.start.label], scale: PARAMS.startPulseScale,
            duration: PARAMS.startPulseMs / 2, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });

        this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
            if (!e.repeat && (e.code === 'Space' || e.code === 'Enter')) this.begin();
        });
        this.input.keyboard?.addCapture('SPACE');
        this.events.once('shutdown', () => this.input.keyboard?.removeCapture('SPACE'));

        this.place();
        watchOrientation(this, () => this.layout, (layout) => {
            this.layout = layout;
            this.place();
        });
    }

    private place() {
        const l = this.layout;
        this.nameText.setPosition(l.titleName.x, l.titleName.y);
        this.start.place(l.titleButton);
    }

    private begin() {
        if (this.leaving) return;
        this.leaving = true;
        this.scene.start('Game');
    }
}
