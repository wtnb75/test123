import { Scene } from 'phaser';
import { createBulletTextures } from './bulletTextures';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        // アセットは Graphics で描画するため読み込みなし
    }

    create() {
        createBulletTextures(this);
        this.scene.start('Game');
    }
}
