import { Scene } from 'phaser';
import { createInitialProgress } from '../logic/progress';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    create() {
        this.registry.set('progress', createInitialProgress());
        this.scene.start('StageSelect');
    }
}
