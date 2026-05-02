import * as Phaser from 'phaser';
const { Scene } = Phaser;
import { GAME_WIDTH, GAME_HEIGHT } from '../core/constants';

export class GameOver extends Scene {
    constructor() {
        super('GameOver');
    }

    create(data: { score: number }) {
        const score = data?.score ?? 0;

        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);

        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, 'GAME OVER', {
            fontFamily: 'monospace',
            fontSize: 48,
            color: '#ff4444'
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `SCORE: ${score}`, {
            fontFamily: 'monospace',
            fontSize: 32,
            color: '#ffffff'
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80, 'Press R or Tap to Retry', {
            fontFamily: 'monospace',
            fontSize: 22,
            color: '#aaaaaa'
        }).setOrigin(0.5);

        // キーボード
        const keyR = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        keyR.once('down', () => this.scene.start('Game'));

        // タッチ / クリック
        this.input.once('pointerdown', () => this.scene.start('Game'));
    }
}
