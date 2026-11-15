import { Scene } from 'phaser';
import { NORMA } from '../params';
import { resultInputOpen } from '../logic/guard';
import { displaySeconds } from '../logic/run';
import type { ResultData } from './Game';
import { addButton, addLabel, applyScreenSize, fadeInScene, onKeyPress, SceneExit, screenCenter } from './ui';

/** Result layout, relative to the screen centre O (docs/spec.md "レイアウト方針"). */
const HEADING_DY = -150;
const DETAIL_DY = -80;
const RETRY_DY = 30;
const TITLE_DY = 130;

export class Result extends Scene {
    private play: ResultData = { outcome: 'fail', progress: 0, timeLeft: 0 };
    private exit!: SceneExit;
    private openedAtMs = 0;

    constructor() {
        super('Result');
    }

    init(data: ResultData) {
        this.play = data;
    }

    create() {
        applyScreenSize(this);
        fadeInScene(this);
        // The game loop's clock, not this.time.now: a Scene's clock only advances while it runs, so in create()
        // it still holds the time of the Scene's previous frame (or of boot), which would open the guard at once.
        this.openedAtMs = this.game.loop.time;
        const o = screenCenter(this);
        const clear = this.play.outcome === 'clear';
        addLabel(this, o.x, o.y + HEADING_DY, clear ? 'クリア！' : 'タイムアップ', 48, clear ? '#ffe066' : '#ff9f9f');
        const detail = clear
            ? `のこり ${displaySeconds(this.play.timeLeft)}秒`
            : `モグラ ${this.play.progress}/${NORMA}`;
        addLabel(this, o.x, o.y + DETAIL_DY, detail, 30);

        const open = () => resultInputOpen((this.game.loop.time - this.openedAtMs) / 1000);
        addButton(this, o.x, o.y + RETRY_DY, 'もう一度', () => this.exit.to('Game'), open);
        addButton(this, o.x, o.y + TITLE_DY, 'タイトルへ', () => this.exit.to('Title'), open);
        onKeyPress(this, ['ENTER', 'SPACE'], () => {
            if (open()) this.exit.to('Game');
        });
        onKeyPress(this, ['ESC'], () => {
            if (open()) this.exit.to('Title');
        });
        this.exit = new SceneExit(this);
        if (import.meta.env.DEV) {
            // QA only, written inline so none of it reaches the production bundle.
            Object.defineProperty(window, '__qa', {
                configurable: true,
                get: () => ({ scene: 'Result', outcome: this.play.outcome, progress: this.play.progress }),
            });
        }
    }
}
