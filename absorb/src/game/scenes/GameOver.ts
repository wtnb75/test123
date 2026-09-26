import { Input, Scene } from 'phaser';

export class GameOver extends Scene {
    constructor() {
        super('GameOver');
    }

    create(data: { score?: number }) {
        const score = data?.score ?? 0;
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        this.add.text(cx, cy - 80, 'GAME OVER', { fontFamily: 'monospace', fontSize: 56, color: '#ff5252' }).setOrigin(0.5);
        this.add.text(cx, cy, `SCORE ${score}`, { fontFamily: 'monospace', fontSize: 36, color: '#ffffff' }).setOrigin(0.5);
        this.add.text(cx, cy + 80, 'Press R or tap to retry', { fontFamily: 'monospace', fontSize: 22, color: '#aaaaaa' }).setOrigin(0.5);

        const restart = () => this.scene.start('Game');
        this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.R).once('down', restart);
        this.input.once('pointerdown', restart);
        this.events.once('shutdown', () => this.input.keyboard?.removeAllKeys(true));
    }
}
