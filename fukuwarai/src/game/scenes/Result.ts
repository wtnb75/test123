import { Scene } from 'phaser';
import { GAME_WIDTH } from '../logic/constants';
import { PART_ANSWERS } from '../logic/parts';
import type { DraggablePartId, PartId, PartTransform } from '../logic/types';
import { drawFaceGroup } from '../drawing';

interface ResultData {
    score?: number;
    playerTransforms?: Record<DraggablePartId, PartTransform>;
}

export class Result extends Scene {
    private score = 0;
    private playerTransforms: Record<DraggablePartId, PartTransform> | null = null;

    constructor() {
        super('Result');
    }

    init(data: ResultData) {
        this.score = data.score ?? 0;
        this.playerTransforms = data.playerTransforms ?? null;
    }

    create() {
        this.cameras.main.setBackgroundColor('#fff4e6');

        this.add.text(GAME_WIDTH / 2, 40, 'けっか', {
            color: '#5b3a29',
            fontFamily: 'sans-serif',
            fontSize: '24px',
        }).setOrigin(0.5);

        // Player's finished face is the star of the screen — 福笑い is a
        // game you look at and laugh, not just a number (docs/spec.md).
        const playerFaceTransforms: Record<PartId, PartTransform> = {
            outline: PART_ANSWERS.outline,
            ...(this.playerTransforms ?? this.emptyPlayerTransforms()),
        };
        const playerFace = drawFaceGroup(this, playerFaceTransforms);
        playerFace.setPosition(GAME_WIDTH / 2, 210);

        this.add.text(GAME_WIDTH / 2, 355, `${this.score}点`, {
            color: '#e76f51',
            fontFamily: 'sans-serif',
            fontSize: '64px',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        // Small answer reference, for comparison — not the main attraction.
        this.add.text(GAME_WIDTH / 2, 440, '正解', {
            color: '#8a6d3b',
            fontFamily: 'sans-serif',
            fontSize: '14px',
        }).setOrigin(0.5);
        const answerFace = drawFaceGroup(this, PART_ANSWERS);
        answerFace.setPosition(GAME_WIDTH / 2, 500);
        answerFace.setScale(0.4);

        const btnY = 650;

        const retryBtn = this.add.rectangle(GAME_WIDTH / 2, btnY, GAME_WIDTH * 0.6, 60, 0xffb703)
            .setInteractive({ useHandCursor: true });
        const retryLabel = this.add.text(GAME_WIDTH / 2, btnY, 'もう一度', {
            color: '#3a2a1a',
            fontFamily: 'sans-serif',
            fontSize: '22px',
            fontStyle: 'bold',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const retry = () => this.scene.start('Game');
        retryBtn.on('pointerdown', retry);
        retryLabel.on('pointerdown', retry);

        const titleY = btnY + 80;
        const titleBtn = this.add.rectangle(GAME_WIDTH / 2, titleY, GAME_WIDTH * 0.6, 60, 0xcccccc)
            .setInteractive({ useHandCursor: true });
        const titleLabel = this.add.text(GAME_WIDTH / 2, titleY, 'タイトルへ', {
            color: '#333333',
            fontFamily: 'sans-serif',
            fontSize: '20px',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const toTitle = () => this.scene.start('Title');
        titleBtn.on('pointerdown', toTitle);
        titleLabel.on('pointerdown', toTitle);
    }

    /** Defensive fallback if Result is ever entered without player data
     * (e.g. navigated to directly) — draws all parts at the origin rather
     * than crashing on a missing transform. */
    private emptyPlayerTransforms(): Record<DraggablePartId, PartTransform> {
        const zero: PartTransform = { x: 0, y: 0, rotation: 0 };
        return {
            eyebrowL: zero, eyebrowR: zero, eyeL: zero, eyeR: zero, nose: zero, mouth: zero,
        };
    }
}
