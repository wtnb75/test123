import { Scene } from 'phaser';
import { BUTTON_WIDTH, HUD_FONT_SIZE, TITLE_FONT_SIZE } from '../params';
import { formatBest, type Best } from '../logic/best';
import { fadeInScene } from './effects';
import { addButton, addLabel, bestStore, onKeyPress, RotateGuard, SceneExit } from './ui';

export interface ResultData {
    score: number;
    wave: number;
}

export class Result extends Scene {
    private play: ResultData = { score: 0, wave: 1 };
    private best: Best | null = null;
    private isNew = false;
    private guard!: RotateGuard;
    private exit!: SceneExit;

    constructor() {
        super('Result');
    }

    init(data: ResultData) {
        this.play = data;
        const rec = bestStore.record(data.score, data.wave);
        this.best = rec.best;
        this.isNew = rec.isNew;
    }

    create() {
        const { width, height } = this.scale.gameSize;
        const cx = width / 2;
        fadeInScene(this);
        addLabel(this, cx, height * 0.16, 'GAME OVER', TITLE_FONT_SIZE);
        addLabel(this, cx, height * 0.3, `SCORE ${this.play.score}`, HUD_FONT_SIZE);
        addLabel(this, cx, height * 0.37, `WAVE ${this.play.wave}`, HUD_FONT_SIZE);
        addLabel(this, cx, height * 0.47, formatBest(this.best), HUD_FONT_SIZE, '#ffe680');
        if (this.isNew) addLabel(this, cx, height * 0.53, 'NEW BEST!', HUD_FONT_SIZE, '#ff9f43');

        const gap = 20;
        const dx = (BUTTON_WIDTH + gap) / 2;
        addButton(this, cx - dx, height * 0.8, 'もう一度', () => this.retry());
        addButton(this, cx + dx, height * 0.8, 'タイトルへ', () => this.toTitle());
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
