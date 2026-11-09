import { Scene } from 'phaser';
import { bestStore } from './bestStore';
import { titleBestText } from '../logic/best';
import { BEST_TEXT_COLOR, GAME_WIDTH, GAME_HEIGHT, TITLE_BEST_FONT_PX, TITLE_BEST_Y } from '../logic/constants';

export class Title extends Scene {
    constructor() {
        super('Title');
    }

    create() {
        this.cameras.main.setBackgroundColor('#fff4e6');

        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.35, 'ふくわらい', {
            color: '#5b3a29',
            fontFamily: 'sans-serif',
            fontSize: '48px',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.45, '顔を覚えて、パーツを並べよう', {
            color: '#8a6d3b',
            fontFamily: 'sans-serif',
            fontSize: '18px',
        }).setOrigin(0.5);

        // Best score from earlier plays; nothing is shown before the first record.
        const bestText = titleBestText(bestStore.load());
        if (bestText !== null) {
            this.add.text(GAME_WIDTH / 2, TITLE_BEST_Y, bestText, {
                color: BEST_TEXT_COLOR,
                fontFamily: 'sans-serif',
                fontSize: `${TITLE_BEST_FONT_PX}px`,
            }).setOrigin(0.5);
        }

        const startY = GAME_HEIGHT * 0.6;
        const startBtn = this.add.rectangle(GAME_WIDTH / 2, startY, GAME_WIDTH * 0.6, 64, 0xffb703)
            .setInteractive({ useHandCursor: true });
        const startLabel = this.add.text(GAME_WIDTH / 2, startY, 'スタート', {
            color: '#3a2a1a',
            fontFamily: 'sans-serif',
            fontSize: '22px',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        const start = () => this.scene.start('Game');
        startBtn.on('pointerdown', start);
        startLabel.setInteractive({ useHandCursor: true }).on('pointerdown', start);
    }
}
