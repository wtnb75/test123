import { GameObjects, Scene, Tweens } from 'phaser';
import {
    GAME_WIDTH,
    RESULT_FACE_CENTER_Y,
    RESULT_FACE_LABEL_Y,
    RESULT_FADE_MS,
    RESULT_HOLD_MS,
    RESULT_RETRY_HEIGHT_PX,
    RESULT_RETRY_Y,
    RESULT_TOGGLE_HEIGHT_PX,
    RESULT_TOGGLE_Y,
} from '../logic/constants';
import { TOPICS } from '../logic/topics';
import type { DraggablePartId, PartId, PartTransform } from '../logic/types';
import { drawFaceGroup } from '../drawing';

interface ResultData {
    score?: number;
    playerTransforms?: Record<DraggablePartId, PartTransform>;
    topicIndex?: number;
}

const LABEL_PLAYER = 'あなたの顔';
const LABEL_ANSWER = '正解';
const TOGGLE_STOP = '正解との切り替えを止める';
const TOGGLE_PLAY = '正解と切り替えて見る';

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

        // The correct face in the same place, crossfading with the player's
        // face to see where each part went (docs/spec.md「Result の見比べ表示」).
        const bigAnswerFace = drawFaceGroup(this, TOPICS[this.topicIndex]);
        bigAnswerFace.setPosition(GAME_WIDTH / 2, RESULT_FACE_CENTER_Y);
        bigAnswerFace.setAlpha(0);

        const faceLabel = this.add.text(GAME_WIDTH / 2, RESULT_FACE_LABEL_Y, LABEL_PLAYER, {
            color: '#5b3a29',
            fontFamily: 'sans-serif',
            fontSize: '16px',
        }).setOrigin(0.5);

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

        this.addFadeToggle(playerFace, bigAnswerFace, faceLabel);

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
     * Crossfades the player's face and the correct face (the correct face's
     * alpha runs 0 -> 1 -> 0 with a hold at each end; the player's face is
     * always 1 - that), and adds the button that stops/restarts it. The tween
     * is the state: running means "playing". Only the background rectangle is
     * interactive; the label sits on top and passes taps through to it.
     */
    private addFadeToggle(
        playerFace: GameObjects.Container,
        answerFace: GameObjects.Container,
        faceLabel: GameObjects.Text,
    ) {
        const sync = () => {
            playerFace.setAlpha(1 - answerFace.alpha);
            faceLabel.setText(answerFace.alpha >= 0.5 ? LABEL_ANSWER : LABEL_PLAYER);
        };
        const startFade = (): Tweens.Tween => this.tweens.add({
            targets: answerFace,
            alpha: 1,
            duration: RESULT_FADE_MS,
            ease: 'Linear',
            hold: RESULT_HOLD_MS,
            yoyo: true,
            repeat: -1,
            repeatDelay: RESULT_HOLD_MS,
            onUpdate: sync,
        });
        let fade: Tweens.Tween | null = startFade();

        const toggleBtn = this.add.rectangle(GAME_WIDTH / 2, RESULT_TOGGLE_Y, GAME_WIDTH * 0.6, RESULT_TOGGLE_HEIGHT_PX, 0xcccccc)
            .setInteractive({ useHandCursor: true });
        const toggleLabel = this.add.text(GAME_WIDTH / 2, RESULT_TOGGLE_Y, TOGGLE_STOP, {
            color: '#333333',
            fontFamily: 'sans-serif',
            fontSize: '20px',
        }).setOrigin(0.5);
        toggleBtn.on('pointerdown', () => {
            if (fade) {
                // Stop on the player's face.
                fade.remove();
                fade = null;
                answerFace.setAlpha(0);
                sync();
                toggleLabel.setText(TOGGLE_PLAY);
            } else {
                answerFace.setAlpha(0);
                fade = startFade();
                toggleLabel.setText(TOGGLE_STOP);
            }
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
