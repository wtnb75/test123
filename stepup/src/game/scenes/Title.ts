import { Scale, Scene } from 'phaser';
import { FONT_HELP, FONT_SUB, FONT_TITLE } from '../params';
import { titleBestText } from '../logic/best';
import { HELP_LINES, titleLayout } from '../logic/layout';
import {
    bestStore,
    addButton,
    addLabel,
    type ButtonHandle,
    applyScreenSize,
    BG_CSS,
    COLOR,
    onKeyDown,
    RotateGuard,
    SceneExit,
    screenSizeChanged,
} from './ui';

export class Title extends Scene {
    private guard!: RotateGuard;
    private exit!: SceneExit;

    constructor() {
        super('Title');
    }

    create() {
        const { width, height } = applyScreenSize(this);
        this.cameras.main.setBackgroundColor(BG_CSS);
        const cx = width / 2;
        const layout = titleLayout(height);
        addLabel(this, cx, layout.nameY, '空中足場のぼり', FONT_TITLE);
        addLabel(this, cx, layout.subY, 'STEPUP', FONT_SUB, COLOR.sub);
        addLabel(this, cx, layout.stageY, 'ステージ 1', FONT_SUB, COLOR.accent);
        HELP_LINES.forEach((line, i) => addLabel(this, cx, layout.helpY(i), line, FONT_HELP, COLOR.sub));
        const bestText = titleBestText(bestStore);
        if (bestText) addLabel(this, cx, layout.bestY, bestText, FONT_SUB);
        // The notice first: it reports to the button below when it appears or goes away.
        const buttons: ButtonHandle[] = [];
        this.guard = new RotateGuard(this, () => buttons.forEach((b) => b.reset()));
        this.exit = new SceneExit(this);
        buttons.push(addButton(this, cx, layout.buttonY, 'START', () => this.start(), () => !this.guard.active));
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
