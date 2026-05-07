import { Scene } from 'phaser';

interface ResultData {
    score?: number;
    collateralClears?: number;
    digitCount?: number;
    finalExpression?: string;
}

export class Result extends Scene
{
    private score = 0;
    private collateralClears = 0;
    private digitCount = 2;
    private finalExpression = '';

    constructor ()
    {
        super('Result');
    }

    init (data: ResultData)
    {
        this.score = data.score ?? 0;
        this.collateralClears = data.collateralClears ?? 0;
        this.digitCount = data.digitCount ?? 2;
        this.finalExpression = data.finalExpression ?? '';
    }

    create ()
    {
        const { width, height } = this.cameras.main;

        this.cameras.main.setBackgroundColor('#2b2d42');

        this.add.text(width / 2, height * 0.18, 'GAME OVER', {
            color: '#ef233c',
            fontFamily: 'sans-serif',
            fontSize: '42px',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.38, `SCORE\n${this.score}`, {
            align: 'center',
            color: '#edf2f4',
            fontFamily: 'sans-serif',
            fontSize: '28px',
            fontStyle: 'bold',
            lineSpacing: 12
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.52, this.finalExpression, {
            align: 'center',
            color: '#ffd166',
            fontFamily: 'monospace',
            fontSize: '42px',
            fontStyle: 'bold',
            stroke: '#14213d',
            strokeThickness: 8,
            wordWrap: { width: width - 36 }
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.66, `COLLATERAL CLEAR\n${this.collateralClears}`, {
            align: 'center',
            color: '#d7e3fc',
            fontFamily: 'sans-serif',
            fontSize: '22px',
            lineSpacing: 12
        }).setOrigin(0.5);

        const retryButton = this.add.rectangle(width / 2, height * 0.8, width * 0.68, 72, 0x8ac926)
            .setInteractive({ useHandCursor: true });
        this.add.text(width / 2, height * 0.8, 'RETRY', {
            color: '#14213d',
            fontFamily: 'sans-serif',
            fontSize: '28px',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const retry = () => {
            this.scene.start('Game', { digitCount: this.digitCount });
        };

        retryButton.on('pointerdown', retry);
        this.input.keyboard?.once('keydown-ENTER', retry);
        this.input.once('pointerdown', retry);
    }
}
