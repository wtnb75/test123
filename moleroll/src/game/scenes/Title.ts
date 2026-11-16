import { Scale, Scene } from 'phaser';
import { showGameListLink } from 'game-list-link';
import {
    addButton,
    addLabel,
    applyScreenSize,
    fadeInScene,
    onKeyPress,
    SceneExit,
    screenCenter,
    screenSizeChanged,
} from './ui';

/** Title layout, relative to the screen centre O (docs/spec.md "レイアウト方針"). */
const NAME_DY = -170;
const TAGLINE_DY = -105;
const HOW_TO_DY = [-35, -5, 25];
const START_DY = 140;
const HOW_TO = ['ドラッグで立体を回す', '裏のモグラは矢印の向きへ', 'モグラをタップ。ネコはダメ'];

export class Title extends Scene {
    private exit!: SceneExit;
    /** Rebuilt for a new logical size after a rotation: no fade, so rotating doesn't flash the screen black. */
    private relayout = false;

    constructor() {
        super('Title');
    }

    init(data: { relayout?: boolean }) {
        this.relayout = data?.relayout === true;
    }

    create() {
        showGameListLink(this);
        applyScreenSize(this);
        if (!this.relayout) fadeInScene(this);
        const o = screenCenter(this);
        addLabel(this, o.x, o.y + NAME_DY, 'モグラロール', 56);
        addLabel(this, o.x, o.y + TAGLINE_DY, '矢印の先は、モグラとは限らない！', 24);
        HOW_TO.forEach((line, i) => addLabel(this, o.x, o.y + HOW_TO_DY[i], line, 22, '#d6dcea'));
        addButton(this, o.x, o.y + START_DY, 'START', () => this.start());
        onKeyPress(this, ['ENTER', 'SPACE'], () => this.start());

        this.exit = new SceneExit(this);
        // Rotating the device on Title re-decides the logical size (rebuilding the screen at the new size).
        this.scale.on(Scale.Events.RESIZE, this.onResize, this);
        this.events.once('shutdown', () => this.scale.off(Scale.Events.RESIZE, this.onResize, this));
        if (import.meta.env.DEV) {
            // QA only, written inline so none of it reaches the production bundle.
            Object.defineProperty(window, '__qa', {
                configurable: true,
                get: () => ({ scene: 'Title' }),
            });
        }
    }

    private onResize() {
        if (screenSizeChanged(this)) this.exit.to('Title', { relayout: true });
    }

    private start() {
        this.exit.to('Game');
    }
}
