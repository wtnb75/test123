import { Scene } from 'phaser';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        // No external assets to load
    }

    async create() {
        await document.fonts.ready;
        this.scene.start('Title');
    }
}
