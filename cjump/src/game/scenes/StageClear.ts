import { Scene } from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../logic/constants';
import { isFinalStage, unlockNextStage, type ProgressState } from '../logic/progress';

export class StageClear extends Scene {
    constructor() {
        super('StageClear');
    }

    create(data: { stage: number }) {
        const stage = data.stage;
        const progress = this.registry.get('progress') as ProgressState;
        this.registry.set('progress', unlockNextStage(progress, stage));

        const final = isFinalStage(stage);

        this.add
            .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, final ? '全ステージクリア！' : `ステージ${stage} クリア！`, {
                fontFamily: 'sans-serif',
                fontSize: '36px',
                color: '#ffffff'
            })
            .setOrigin(0.5);

        if (!final) {
            this.addButton(GAME_WIDTH / 2, GAME_HEIGHT / 2, '次のステージへ', () => {
                this.scene.start('Game', { stage: stage + 1 });
            });
        }

        this.addButton(GAME_WIDTH / 2, GAME_HEIGHT / 2 + (final ? 0 : 70), 'ステージ選択に戻る', () => {
            this.scene.start('StageSelect');
        });
    }

    private addButton(x: number, y: number, label: string, onClick: () => void) {
        const box = this.add.rectangle(x, y, 260, 56, 0x2e86de).setStrokeStyle(2, 0xffffff);
        this.add
            .text(x, y, label, { fontFamily: 'sans-serif', fontSize: '22px', color: '#ffffff' })
            .setOrigin(0.5);
        box.setInteractive({ useHandCursor: true });
        box.on('pointerup', onClick);
    }
}
