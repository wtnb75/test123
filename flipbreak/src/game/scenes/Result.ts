import { Scene } from 'phaser';
import { RESULT_BUTTON_GAP, RESULT_BUTTON_W, RESULT_FONT_SIZE, RESULT_TITLE_FONT_SIZE, W } from '../params';
import { formatBest, recordPlay, stageLabel, type Best } from '../logic/best';
import type { ResultData } from '../logic/session';
import { addButton, addLabel, bestStore, fadeInScene, onKeyPress, RotateGuard, SceneExit } from './ui';

// Region layout of the Result (logical px): lines from the top, the two buttons in the lower third.
const HEADING_Y = 140;
const SCORE_Y = 220;
const STAGE_Y = 260;
const BEST_Y = 320;
const NEW_BEST_Y = 360;
const BUTTONS_Y = 500;

export class Result extends Scene {
    private play: ResultData = { score: 0, stage: 1, cleared: false };
    private best: Best | null = null;
    private isNew = false;
    private guard!: RotateGuard;
    private exit!: SceneExit;

    constructor() {
        super('Result');
    }

    init(data: ResultData) {
        this.play = data;
        const { best, isNew } = recordPlay(bestStore, data);
        this.best = best;
        this.isNew = isNew;
    }

    create() {
        const cx = W / 2;
        fadeInScene(this);
        addLabel(this, cx, HEADING_Y, this.play.cleared ? 'ALL CLEAR' : 'GAME OVER', RESULT_TITLE_FONT_SIZE);
        addLabel(this, cx, SCORE_Y, `SCORE ${this.play.score}`, RESULT_FONT_SIZE);
        addLabel(this, cx, STAGE_Y, stageLabel(this.play.stage), RESULT_FONT_SIZE);
        addLabel(this, cx, BEST_Y, formatBest(this.best), RESULT_FONT_SIZE, '#ffe680');
        if (this.isNew) addLabel(this, cx, NEW_BEST_Y, 'NEW BEST!', RESULT_FONT_SIZE, '#ff9f43');

        const dx = (RESULT_BUTTON_W + RESULT_BUTTON_GAP) / 2;
        addButton(this, cx - dx, BUTTONS_Y, 'もう一度', () => this.retry(), RESULT_BUTTON_W);
        addButton(this, cx + dx, BUTTONS_Y, 'タイトルへ', () => this.toTitle(), RESULT_BUTTON_W);
        onKeyPress(this, ['ENTER', 'SPACE'], () => this.retry());
        onKeyPress(this, ['ESC'], () => this.toTitle());
        this.guard = new RotateGuard(this);
        this.exit = new SceneExit(this);
    }

    private retry() {
        if (!this.guard.active) this.exit.to('Game');
    }

    private toTitle() {
        if (!this.guard.active) this.exit.to('Title');
    }
}
