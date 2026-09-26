import { Scene } from 'phaser';
import { BG_COLOR, CANVAS_H, CANVAS_W, RESULT_INPUT_DELAY, WAVE_MAX } from '../logic/config';
import { computeScore } from '../logic/wave';
import type { ResultData } from './Game';

const FONT = 'sans-serif';

export class Result extends Scene {
    constructor() {
        super('Result');
    }

    create(data: ResultData) {
        const cx = CANVAS_W / 2;
        const cy = CANVAS_H / 2;
        const score = computeScore(data.kills, data.lives, data.cleared);

        this.cameras.main.setBackgroundColor(BG_COLOR);
        this.add
            .text(cx, cy - 160, data.cleared ? 'クリア！' : 'ゲームオーバー', {
                fontFamily: FONT,
                fontSize: 64,
                color: data.cleared ? '#ffe082' : '#ff5252',
                fontStyle: 'bold'
            })
            .setOrigin(0.5);
        const lines = [`スコア ${score}`, `撃破数 ${data.kills}`, `到達ウェーブ ${data.wave}/${WAVE_MAX}`];
        lines.forEach((line, i) => {
            this.add.text(cx, cy - 40 + i * 56, line, { fontFamily: FONT, fontSize: i === 0 ? 40 : 30, color: '#ffffff' }).setOrigin(0.5);
        });
        this.add.text(cx, CANVAS_H - 120, 'タップでもう一度', { fontFamily: FONT, fontSize: 28, color: '#aaaaaa' }).setOrigin(0.5);

        const restart = () => this.scene.start('Game');
        // Ignore taps right after the switch so a burst of taps during the wave doesn't restart instantly.
        this.time.delayedCall(RESULT_INPUT_DELAY * 1000, () => this.input.once('pointerdown', restart));
        this.events.once('shutdown', () => this.input.off('pointerdown', restart));
    }
}
