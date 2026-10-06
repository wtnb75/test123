import { GameObjects, Scene } from 'phaser';
import { promptAlpha } from '../logic/effects';
import type { Layout } from '../logic/layout';
import { dateToYmd } from '../logic/random';
import { firstSet } from '../logic/set';
import { MENU_HUE, UI_FONT, drawBackdrop } from './draw';
import { bindOrientation } from './orientation';

export class Title extends Scene {
    private backdrop!: GameObjects.Graphics;
    private name!: GameObjects.Text;
    private tagline!: GameObjects.Text;
    private dateText!: GameObjects.Text;
    private prompt!: GameObjects.Text;
    private date = 0;
    private pulseMs = 0;

    constructor() {
        super('Title');
    }

    create() {
        // The date is taken once here and handed to Game as is.
        const today = new Date();
        this.date = dateToYmd(today);
        this.pulseMs = 0;
        const label = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        this.backdrop = this.add.graphics();
        this.name = this.add.text(0, 0, 'SpotDiff', { fontFamily: UI_FONT, fontSize: '72px', color: '#ffffff' }).setOrigin(0.5);
        this.tagline = this.add.text(0, 0, 'Find the differences', { fontFamily: UI_FONT, fontSize: '32px', color: '#dfe6f5' }).setOrigin(0.5);
        this.dateText = this.add.text(0, 0, label, { fontFamily: UI_FONT, fontSize: '28px', color: '#ffd166' }).setOrigin(0.5);
        this.prompt = this.add.text(0, 0, 'TAP TO START', { fontFamily: UI_FONT, fontSize: '36px', color: '#ffffff' }).setOrigin(0.5);

        this.place(bindOrientation(this, (layout) => this.place(layout)));
        this.input.once('pointerdown', () => this.scene.start('Game', firstSet(this.date)));
    }

    update(_time: number, delta: number) {
        // the prompt is at full opacity on the first frame, then breathes
        this.prompt.setAlpha(promptAlpha(this.pulseMs));
        this.pulseMs += delta;
    }

    private place(layout: Layout) {
        const { x, y } = layout.center;
        this.dateText.setFontSize(layout.portrait ? 32 : 28); // portrait texts stay >= 32px on the canvas
        drawBackdrop(this.backdrop, layout.width, layout.height, MENU_HUE);
        this.name.setPosition(x, y - 140);
        this.tagline.setPosition(x, y - 60);
        this.dateText.setPosition(x, y + 20);
        this.prompt.setPosition(x, y + 140);
    }
}
