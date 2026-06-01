import { Scene } from 'phaser';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        // No external assets to load
    }

    create() {
        this.scene.start('Title');
    }
}
