import { Scene } from 'phaser';
import { STAGE_COUNT, GAME_WIDTH } from '../logic/constants';
import { isStageUnlocked, type ProgressState } from '../logic/progress';

const COLUMNS = 5;
const BUTTON_SIZE = 100;
const BUTTON_GAP = 24;

export class StageSelect extends Scene {
    constructor() {
        super('StageSelect');
    }

    create() {
        const progress = this.registry.get('progress') as ProgressState;

        this.add
            .text(GAME_WIDTH / 2, 60, 'ステージ選択', {
                fontFamily: 'sans-serif',
                fontSize: '32px',
                color: '#ffffff'
            })
            .setOrigin(0.5);

        const gridWidth = COLUMNS * BUTTON_SIZE + (COLUMNS - 1) * BUTTON_GAP;
        const startX = (GAME_WIDTH - gridWidth) / 2 + BUTTON_SIZE / 2;
        const startY = 160;

        for (let stage = 1; stage <= STAGE_COUNT; stage++) {
            const col = (stage - 1) % COLUMNS;
            const row = Math.floor((stage - 1) / COLUMNS);
            const x = startX + col * (BUTTON_SIZE + BUTTON_GAP);
            const y = startY + row * (BUTTON_SIZE + BUTTON_GAP);
            const unlocked = isStageUnlocked(progress, stage);

            const box = this.add
                .rectangle(x, y, BUTTON_SIZE, BUTTON_SIZE, unlocked ? 0x2e86de : 0x555555)
                .setStrokeStyle(2, 0xffffff);
            const label = this.add
                .text(x, y, String(stage), { fontFamily: 'sans-serif', fontSize: '28px', color: '#ffffff' })
                .setOrigin(0.5);

            if (unlocked) {
                box.setInteractive({ useHandCursor: true });
                box.on('pointerup', () => this.scene.start('Game', { stage }));
            } else {
                label.setAlpha(0.5);
            }
        }
    }
}
