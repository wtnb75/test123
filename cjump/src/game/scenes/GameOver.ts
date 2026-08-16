import { Scene } from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../logic/constants';

export class GameOver extends Scene {
    constructor() {
        super('GameOver');
    }

    create() {
        this.add
            .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'ゲームオーバー', {
                fontFamily: 'sans-serif',
                fontSize: '36px',
                color: '#ffffff'
            })
            .setOrigin(0.5);

        const box = this.add
            .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, 260, 56, 0x2e86de)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive({ useHandCursor: true });
        this.add
            .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, 'ステージ選択に戻る', {
                fontFamily: 'sans-serif',
                fontSize: '22px',
                color: '#ffffff'
            })
            .setOrigin(0.5);
        box.on('pointerup', () => this.scene.start('StageSelect'));
    }
}
