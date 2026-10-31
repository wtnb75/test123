import { GameObjects, Scene } from 'phaser';
import {
    GAME_WIDTH,
    RESULT_FACE_CENTER_Y,
    RESULT_OVERLAY_COLOR,
    RESULT_OVERLAY_LINE_PX,
    RESULT_RETRY_HEIGHT_PX,
    RESULT_RETRY_Y,
    RESULT_TOGGLE_HEIGHT_PX,
    RESULT_TOGGLE_Y,
} from '../logic/constants';
import { TOPICS } from '../logic/topics';
import type { DraggablePartId, PartId, PartTransform } from '../logic/types';
import { drawDashedFaceOutline, drawFaceGroup } from '../drawing';

interface ResultData {
    score?: number;
    playerTransforms?: Record<DraggablePartId, PartTransform>;
    topicIndex?: number;
}

export class Result extends Scene {
    private score = 0;
    private playerTransforms: Record<DraggablePartId, PartTransform> | null = null;
    private topicIndex = 0;

    constructor() {
        super('Result');
    }

    init(data: ResultData) {
        this.score = data.score ?? 0;
        this.playerTransforms = data.playerTransforms ?? null;
        const index = data.topicIndex ?? 0;
        this.topicIndex = Number.isInteger(index) && index >= 0 && index < TOPICS.length ? index : 0;
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
            outline: TOPICS[this.topicIndex].outline,
            ...(this.playerTransforms ?? this.emptyPlayerTransforms()),
        };
        const playerFace = drawFaceGroup(this, playerFaceTransforms);
        playerFace.setPosition(GAME_WIDTH / 2, RESULT_FACE_CENTER_Y);

        // The correct outline laid over the player's face, to see where each
        // part went (docs/spec.md「Result の重ね表示」). Shown on every visit.
        const overlay = this.add.graphics();
        overlay.setPosition(GAME_WIDTH / 2, RESULT_FACE_CENTER_Y);
        drawDashedFaceOutline(overlay, TOPICS[this.topicIndex], RESULT_OVERLAY_COLOR, RESULT_OVERLAY_LINE_PX);

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
        const answerFace = drawFaceGroup(this, TOPICS[this.topicIndex]);
        answerFace.setPosition(GAME_WIDTH / 2, 500);
        answerFace.setScale(0.4);

        this.addOverlayToggle(overlay);

        const btnY = RESULT_RETRY_Y;

        const retryBtn = this.add.rectangle(GAME_WIDTH / 2, btnY, GAME_WIDTH * 0.6, RESULT_RETRY_HEIGHT_PX, 0xffb703)
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
        const titleBtn = this.add.rectangle(GAME_WIDTH / 2, titleY, GAME_WIDTH * 0.6, RESULT_RETRY_HEIGHT_PX, 0xcccccc)
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

    /**
     * The button that shows or hides the correct-outline overlay
     * (docs/spec.md「Result の重ね表示」). Only the background rectangle is
     * interactive; the label sits on top and passes taps through to it.
     */
    private addOverlayToggle(overlay: GameObjects.Graphics) {
        const toggleBtn = this.add.rectangle(GAME_WIDTH / 2, RESULT_TOGGLE_Y, GAME_WIDTH * 0.6, RESULT_TOGGLE_HEIGHT_PX, 0xcccccc)
            .setInteractive({ useHandCursor: true });
        const toggleLabel = this.add.text(GAME_WIDTH / 2, RESULT_TOGGLE_Y, '正解の輪郭を消す', {
            color: '#333333',
            fontFamily: 'sans-serif',
            fontSize: '20px',
        }).setOrigin(0.5);
        toggleBtn.on('pointerdown', () => {
            overlay.setVisible(!overlay.visible);
            toggleLabel.setText(overlay.visible ? '正解の輪郭を消す' : '正解の輪郭を重ねる');
        });
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
