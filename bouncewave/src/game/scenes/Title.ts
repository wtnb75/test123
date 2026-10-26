import { Scale, Scene } from 'phaser';
import { HELP_FONT_SIZE, HUD_FONT_SIZE, TITLE_FONT_SIZE } from '../params';
import { formatBest } from '../logic/best';
import { fadeInScene } from './effects';
import {
    addButton,
    addLabel,
    applyScreenSize,
    bestStore,
    onKeyPress,
    RotateGuard,
    SceneExit,
    screenSizeChanged,
    UI_FONT,
} from './ui';

const HELP_LINES = [
    '赤い玉をパドルで受けると、自分の玉になる',
    '自分の玉で敵を倒そう。全滅で次のウェーブ',
    '赤い玉が下に落ちるとライフが減る',
    '敵が赤い点線まで降りてきたらゲームオーバー',
];

export class Title extends Scene {
    private guard!: RotateGuard;
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
        const { width, height } = applyScreenSize(this);
        if (!this.relayout) fadeInScene(this);
        const cx = width / 2;
        addLabel(this, cx, height * 0.17, '打ち返しインベーダー', TITLE_FONT_SIZE);
        this.add
            .text(cx, height * 0.3, HELP_LINES.join('\n'), {
                fontFamily: UI_FONT,
                fontSize: `${HELP_FONT_SIZE}px`,
                color: '#d0d8e8',
                align: 'center',
                lineSpacing: 12,
                wordWrap: { width: width - 40, useAdvancedWrap: true },
            })
            .setOrigin(0.5, 0);
        addLabel(this, cx, height * 0.56, formatBest(bestStore.load()), HUD_FONT_SIZE, '#ffe680');
        addButton(this, cx, height * 0.8, 'START', () => this.start());
        onKeyPress(this, ['ENTER', 'SPACE'], () => this.start());

        this.guard = new RotateGuard(this);
        this.exit = new SceneExit(this);
        // Rotating the device on Title re-decides the logical size (rebuilding the screen at the new size).
        this.scale.on(Scale.Events.RESIZE, this.onResize, this);
        this.events.once('shutdown', () => this.scale.off(Scale.Events.RESIZE, this.onResize, this));
    }

    private onResize() {
        if (screenSizeChanged(this)) this.exit.to('Title', { relayout: true });
    }

    private start() {
        if (!this.guard.active) this.exit.to('Game');
    }
}
