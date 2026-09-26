import { Input, Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../logic/constants';

export class GameOver extends Scene {
    constructor() {
        super('GameOver');
    }

    create(data: { score?: number }) {
        const score = data?.score ?? 0;
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT / 2;

        this.add.text(cx, cy - 80, 'GAME OVER', { fontFamily: 'monospace', fontSize: 56, color: '#ff5252' }).setOrigin(0.5);
        this.add.text(cx, cy, `SCORE ${score}`, { fontFamily: 'monospace', fontSize: 36, color: '#ffffff' }).setOrigin(0.5);
        this.add.text(cx, cy + 80, 'Press R or click to retry', { fontFamily: 'monospace', fontSize: 22, color: '#aaaaaa' }).setOrigin(0.5);

        const restart = () => this.scene.start('Game');
        this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.R).once('down', restart);
        this.input.once('pointerdown', restart);
        this.events.once('shutdown', () => this.input.keyboard?.removeAllKeys(true));
    }
}
