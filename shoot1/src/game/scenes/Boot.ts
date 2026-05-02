import { Scene } from 'phaser';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        // アセットは Graphics で描画するため読み込みなし
    }

    create() {
        this.scene.start('Game');
    }
}
