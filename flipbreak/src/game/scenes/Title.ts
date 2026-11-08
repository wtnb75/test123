import { Scene, type GameObjects } from 'phaser';
import { BEST_FONT_SIZE, BUTTON_H, HELP_FONT_SIZE, START_PULSE_PERIOD, START_PULSE_SCALE, TITLE_FONT_SIZE, W } from '../params';
import { formatBest } from '../logic/best';
import { addButton, addLabel, bestStore, fadeInScene, onKeyPress, RotateGuard, SceneExit } from './ui';

// Region layout of the Title (logical px): name on top, best below it, START in the lower third, help under it.
const NAME_Y = 140;
const BEST_Y = 210;
const START_Y = 470;
const HELP_Y = START_Y + BUTTON_H / 2 + 36;
const HELP_LINE_H = 28;

export class Title extends Scene {
    private guard!: RotateGuard;
    private exit!: SceneExit;

    constructor() {
        super('Title');
    }

    create() {
        const cx = W / 2;
        addLabel(this, cx, NAME_Y, 'フリップブレイク', TITLE_FONT_SIZE);
        addLabel(this, cx, BEST_Y, formatBest(bestStore.load()), BEST_FONT_SIZE, '#ffe680');
        fadeInScene(this);
        const startButton = addButton(this, cx, START_Y, 'START', () => this.start());
        // The START button breathes (scale 1 <-> START_PULSE_SCALE, one round trip per START_PULSE_PERIOD).
        this.tweens.add({
            targets: [startButton, startButton.getData('label') as GameObjects.Text],
            scale: START_PULSE_SCALE,
            duration: (START_PULSE_PERIOD / 2) * 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1,
        });
        addLabel(this, cx, HELP_Y, '← → / 画面の左右: フリッパー', HELP_FONT_SIZE, '#aab4cc');
        addLabel(this, cx, HELP_Y + HELP_LINE_H, '↓ Space / 押し続けて溜め、離して発射', HELP_FONT_SIZE, '#aab4cc');
        onKeyPress(this, ['ENTER', 'SPACE'], () => this.start());
        this.guard = new RotateGuard(this);
        this.exit = new SceneExit(this);
    }

    private start() {
        if (!this.guard.active) this.exit.to('Game');
    }
}
