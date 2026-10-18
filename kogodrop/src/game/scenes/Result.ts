import { Scene } from 'phaser';
import type { GameConfig, KogoEntry } from '../logic/types';
import {
    RESULT_REVIEW_BUTTON_Y,
    RESULT_WIDE_BUTTON_WIDTH_RATIO,
    resultLayout,
    resultTexts,
    uniqueEntries,
    type RetryGameData,
} from '../logic/retry';

interface ResultData {
    correctCount?: number;
    totalCount?: number;
    wrongEntries?: KogoEntry[];
    correctEntries?: KogoEntry[];
    config?: GameConfig;
    isRetry?: boolean;
}

export class Result extends Scene {
    private correctCount = 0;
    private totalCount = 0;
    private wrongEntries: KogoEntry[] = [];
    private correctEntries: KogoEntry[] = [];
    private config!: GameConfig;
    private isRetry = false;

    constructor() {
        super('Result');
    }

    init(data: ResultData) {
        this.correctCount = data.correctCount ?? 0;
        this.totalCount = data.totalCount ?? 0;
        this.wrongEntries = data.wrongEntries ?? [];
        this.correctEntries = data.correctEntries ?? [];
        this.config = data.config ?? { langMode: { tile: 'kogo', slot: 'jp' }, difficulty: 'normal', questionCount: 20 };
        this.isRetry = data.isRetry ?? false;
    }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#2b2d42');

        const missedEntries = uniqueEntries(this.wrongEntries);
        const layout = resultLayout(missedEntries.length);
        const texts = resultTexts(this.isRetry, missedEntries.length);

        this.add.text(width / 2, height * 0.1, texts.heading, {
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

        const reviewLabel = incorrectCount > 0
            ? `間違えた単語を復習する (${incorrectCount}語)`
            : `全単語を復習する (${this.totalCount}語)`;
        const reviewBtn = this.add.rectangle(width / 2, RESULT_REVIEW_BUTTON_Y, width * RESULT_WIDE_BUTTON_WIDTH_RATIO, 64, 0x778da9)
            .setInteractive({ useHandCursor: true });
        this.add.text(width / 2, RESULT_REVIEW_BUTTON_Y, reviewLabel, {
            color: '#f1faee',
            fontFamily: 'sans-serif',
            fontSize: '20px',
        }).setOrigin(0.5);
        reviewBtn.on('pointerdown', () => {
            this.scene.start('Review', {
                wrongEntries: this.wrongEntries,
                correctEntries: this.correctEntries,
                config: this.config,
                isRetry: this.isRetry,
            });
        });

        if (layout.showRetry) {
            const retryWidth = width * RESULT_WIDE_BUTTON_WIDTH_RATIO;
            const retryRoundBtn = this.add.rectangle(width / 2, layout.retryY, retryWidth, layout.retryHeight, 0xffd166)
                .setInteractive({ useHandCursor: true });
            this.add.text(width / 2, layout.retryY, texts.retryLabel, {
                color: '#14213d',
                fontFamily: 'sans-serif',
                fontSize: '22px',
                fontStyle: 'bold',
                align: 'center',
                wordWrap: { width: retryWidth - 24, useAdvancedWrap: true },
            }).setOrigin(0.5);
            retryRoundBtn.on('pointerdown', () => {
                const data: RetryGameData = { ...this.config, retryEntries: missedEntries };
                this.scene.start('Game', data);
            });
        }

        const nextButtonY = layout.bottomRowY;

        const retryBtn = this.add.rectangle(width / 2 - width * 0.26, nextButtonY, width * 0.44, 60, 0x8ac926)
            .setInteractive({ useHandCursor: true });
        this.add.text(width / 2 - width * 0.26, nextButtonY, texts.restartLabel, {
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
