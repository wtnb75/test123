import { Scene } from 'phaser';

const DIGIT_OPTIONS = [2, 3, 4] as const;

export class Title extends Scene
{
    private selectedDigitIndex = 0;

    constructor ()
    {
        super('Title');
    }

    create ()
    {
        const { width, height } = this.cameras.main;
        let hasStarted = false;

        this.cameras.main.setBackgroundColor('#101820');

        this.add.text(width / 2, height * 0.2, 'PRIMTRIS', {
            color: '#f8f4e3',
            fontFamily: 'sans-serif',
            fontSize: '48px',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.34, '素因数で落とし分ける\n縦画面パズル', {
            align: 'center',
            color: '#f8f4e3',
            fontFamily: 'sans-serif',
            fontSize: '24px'
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.49, '桁数を選択', {
            color: '#d7e3fc',
            fontFamily: 'sans-serif',
            fontSize: '22px',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const selectorBackground = this.add.rectangle(width / 2, height * 0.56, width * 0.7, 72, 0x1d3557)
            .setStrokeStyle(2, 0xa8dadc);
        const leftArrow = this.add.text(selectorBackground.x - selectorBackground.width / 2 + 28, selectorBackground.y, '◀', {
            color: '#f1faee',
            fontFamily: 'sans-serif',
            fontSize: '28px',
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        const rightArrow = this.add.text(selectorBackground.x + selectorBackground.width / 2 - 28, selectorBackground.y, '▶', {
            color: '#f1faee',
            fontFamily: 'sans-serif',
            fontSize: '28px',
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        const digitText = this.add.text(width / 2, selectorBackground.y, '', {
            color: '#ffd166',
            fontFamily: 'sans-serif',
            fontSize: '30px',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const updateDigitText = () => {
            digitText.setText(`${DIGIT_OPTIONS[this.selectedDigitIndex]}桁`);
        };

        const moveSelection = (delta: number) => {
            const maxIndex = DIGIT_OPTIONS.length - 1;
            this.selectedDigitIndex = Math.min(maxIndex, Math.max(0, this.selectedDigitIndex + delta));
            updateDigitText();
        };

        leftArrow.on('pointerdown', () => {
            moveSelection(-1);
        });
        rightArrow.on('pointerdown', () => {
            moveSelection(1);
        });

        this.add.text(width / 2, height * 0.66, '操作\n・数字は中央で停止して待機\n・左右キー or ドラッグで移動\n・離す / ↓ / Enter で投入確定', {
            align: 'center',
            color: '#d7e3fc',
            fontFamily: 'sans-serif',
            fontSize: '18px',
            lineSpacing: 10
        }).setOrigin(0.5);

        const startButton = this.add.rectangle(width / 2, height * 0.84, width * 0.68, 72, 0xffd166)
            .setInteractive({ useHandCursor: true });
        const startLabel = this.add.text(width / 2, height * 0.84, 'START', {
            color: '#222222',
            fontFamily: 'sans-serif',
            fontSize: '28px',
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const startGame = () => {
            if (hasStarted) {
                return;
            }

            hasStarted = true;
            this.scene.start('Game', {
                digitCount: DIGIT_OPTIONS[this.selectedDigitIndex]
            });

            // If scene transition does not happen, allow retrying START.
            this.time.delayedCall(200, () => {
                if (this.scene.isActive('Title')) {
                    hasStarted = false;
                }
            });
        };

        updateDigitText();
        startButton.on('pointerdown', startGame);
        startLabel.on('pointerdown', startGame);
        this.input.keyboard?.on('keydown-LEFT', () => moveSelection(-1));
        this.input.keyboard?.on('keydown-RIGHT', () => moveSelection(1));
        this.input.keyboard?.on('keydown-ENTER', startGame);
    }
}
