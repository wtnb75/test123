import { Scene } from 'phaser';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    create() {
        // No external assets: every part is drawn with Phaser.Graphics.
        this.scene.start('Title');
    }
}
