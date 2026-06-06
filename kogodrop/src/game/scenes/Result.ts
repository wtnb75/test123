import { Scene } from 'phaser';
import type { GameConfig, KogoEntry } from '../logic/types';

interface ResultData {
    correctCount?: number;
    totalCount?: number;
    wrongEntries?: KogoEntry[];
    correctEntries?: KogoEntry[];
    config?: GameConfig;
}

export class Result extends Scene {
    private correctCount = 0;
    private totalCount = 0;
    private wrongEntries: KogoEntry[] = [];
    private correctEntries: KogoEntry[] = [];
    private config!: GameConfig;

    constructor() {
        super('Result');
    }

    init(data: ResultData) {
        this.correctCount = data.correctCount ?? 0;
        this.totalCount = data.totalCount ?? 0;
        this.wrongEntries = data.wrongEntries ?? [];
        this.correctEntries = data.correctEntries ?? [];
        this.config = data.config ?? { langMode: 'kogo-to-jp', difficulty: 'normal', questionCount: 20 };
    }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#2b2d42');

        this.add.text(width / 2, height * 0.1, 'リザルト', {
            color: '#f1faee',
            fontFamily: 'sans-serif',
            fontSize: '40px',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        const incorrectCount = this.totalCount - this.correctCount;
        const pct = this.totalCount > 0
            ? ((this.correctCount / this.totalCount) * 100).toFixed(1)
            : '0.0';

        this.add.text(width / 2, height * 0.3, [
            `出題数:   ${this.totalCount}問`,
            `正答数:   ${this.correctCount}問`,
            `不正答数: ${incorrectCount}問`,
            `正答率:  ${pct} %`,
        ].join('\n'), {
            color: '#edf2f4',
            fontFamily: 'sans-serif',
            fontSize: '24px',
            lineSpacing: 16,
        }).setOrigin(0.5);

        let nextButtonY = height * 0.72;

        if (incorrectCount > 0) {
            const reviewBtn = this.add.rectangle(width / 2, height * 0.56, width * 0.82, 64, 0x778da9)
                .setInteractive({ useHandCursor: true });
            this.add.text(width / 2, height * 0.56, `間違えた単語を復習する (${incorrectCount}語)`, {
                color: '#f1faee',
                fontFamily: 'sans-serif',
                fontSize: '20px',
            }).setOrigin(0.5);
            reviewBtn.on('pointerdown', () => {
                this.scene.start('Review', {
                    wrongEntries: this.wrongEntries,
                    correctEntries: this.correctEntries,
                    config: this.config,
                });
            });
            nextButtonY = height * 0.72;
        }

        const retryBtn = this.add.rectangle(width / 2 - width * 0.26, nextButtonY, width * 0.44, 60, 0x8ac926)
            .setInteractive({ useHandCursor: true });
        this.add.text(width / 2 - width * 0.26, nextButtonY, 'もう一度', {
            color: '#14213d',
            fontFamily: 'sans-serif',
            fontSize: '22px',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        retryBtn.on('pointerdown', () => {
            this.scene.start('Game', this.config);
        });

        const titleBtn = this.add.rectangle(width / 2 + width * 0.26, nextButtonY, width * 0.44, 60, 0x415a77)
            .setInteractive({ useHandCursor: true });
        this.add.text(width / 2 + width * 0.26, nextButtonY, 'タイトルへ', {
            color: '#f1faee',
            fontFamily: 'sans-serif',
            fontSize: '22px',
        }).setOrigin(0.5);
        titleBtn.on('pointerdown', () => {
            this.scene.start('Title');
        });
    }
}
