import { Scale, Scene } from 'phaser';
import { FONT_HELP, FONT_RESULT, FONT_TITLE, FONT_TITLE_SUB, MOVES } from '../params';
import { titleLayout } from '../logic/layout';
import { formatBest } from '../logic/score';
import {
    addButton,
    addLabel,
    type ButtonHandle,
    applyScreenSize,
    bestStore,
    COLOR,
    onKeyDown,
    RotateGuard,
    SceneExit,
    screenSizeChanged,
} from './ui';

const HELP_LINES = [
    'となり合う石を入れかえて',
    '同じ色を 3 つ以上そろえて消そう',
    `手数 ${MOVES}。連鎖と 4 個以上でボーナス`,
];

export class Title extends Scene {
    private guard!: RotateGuard;
    private exit!: SceneExit;

    constructor() {
        super('Title');
    }

    create() {
        const { width, height } = applyScreenSize(this);
        const layout = titleLayout(height);
        const cx = width / 2;
        addLabel(this, cx, layout.nameY, '3マッチパズル', FONT_TITLE);
        addLabel(this, cx, layout.subY, 'MATCH 3', FONT_TITLE_SUB, COLOR.sub);
        HELP_LINES.forEach((line, i) => addLabel(this, cx, layout.helpY[i], line, FONT_HELP, COLOR.sub));
        addLabel(this, cx, layout.bestY, formatBest(bestStore.load()), FONT_RESULT, COLOR.accent);
        // The notice first: it reports to the button below when it appears or goes away.
        const buttons: ButtonHandle[] = [];
        this.guard = new RotateGuard(this, () => buttons.forEach((b) => b.reset()));
        this.exit = new SceneExit(this);
        buttons.push(
            addButton(this, cx, layout.buttonY, 'START', () => this.start(), undefined, () => !this.guard.active),
        );
        onKeyDown(this, (key) => {
            if (key === ' ' || key === 'Enter') this.start();
        });
        // Rotating the device on Title re-decides the logical size (the Scene is rebuilt at the new size).
        this.scale.on(Scale.Events.RESIZE, this.onResize, this);
        this.events.once('shutdown', () => this.scale.off(Scale.Events.RESIZE, this.onResize, this));

        if (import.meta.env.DEV) {
            const qa = {};
            Object.defineProperties(qa, {
                scene: { get: () => 'Title' },
                size: { get: () => ({ w: this.scale.gameSize.width, h: this.scale.gameSize.height }) },
                guard: { get: () => this.guard.active },
            });
            (window as unknown as { __qa: unknown }).__qa = qa;
        }
    }

    private onResize() {
        if (screenSizeChanged(this)) this.exit.to('Title');
    }

    private start() {
        if (!this.guard.active) this.exit.to('Game');
    }
}
