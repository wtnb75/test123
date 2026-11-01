import { Scale, Scene } from 'phaser';
import {
    FONT_HELP,
    FONT_RESULT,
    FONT_TITLE,
    FONT_TITLE_SUB,
    TITLE_BUTTON_FROM_BOTTOM,
    TRAY_CAPACITY,
} from '../params';
import { formatBest } from '../logic/best';
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
    UI_FONT,
} from './ui';

const HELP_LINES = [
    '落ちてくる文字をタップしてひろう',
    'お題の文字がそろうと単語が完成',
    '長い単語ほど高得点。時間も増える',
    `トレイは ${TRAY_CAPACITY} 文字まで。いらない文字は捨てる`,
];

const NAME_Y = 70;
const SUB_Y = 106;
const HELP_TOP = 133;
const HELP_LINE_STEP = 22;
const HELP_WRAP_MARGIN = 32;
const BEST_GAP = 20;

export class Title extends Scene {
    private guard!: RotateGuard;
    private exit!: SceneExit;

    constructor() {
        super('Title');
    }

    create() {
        const { width, height } = applyScreenSize(this);
        const cx = width / 2;
        addLabel(this, cx, NAME_Y, '文字集め', FONT_TITLE);
        addLabel(this, cx, SUB_Y, 'WORDFALL', FONT_TITLE_SUB, COLOR.sub);
        const help = this.add
            .text(cx, HELP_TOP, HELP_LINES.join('\n'), {
                fontFamily: UI_FONT,
                fontSize: `${FONT_HELP}px`,
                color: COLOR.sub,
                align: 'center',
                // Line step = font line height + spacing; aim for HELP_LINE_STEP.
                lineSpacing: HELP_LINE_STEP - Math.ceil(FONT_HELP * 1.2),
                wordWrap: { width: width - HELP_WRAP_MARGIN, useAdvancedWrap: true },
            })
            .setOrigin(0.5, 0);
        addLabel(this, cx, help.y + help.height + BEST_GAP, formatBest(bestStore.load()), FONT_RESULT, COLOR.accent);
        // The notice first: it reports to the button below when it appears or goes away.
        const buttons: ButtonHandle[] = [];
        this.guard = new RotateGuard(this, () => buttons.forEach((b) => b.reset()));
        this.exit = new SceneExit(this);
        buttons.push(
            addButton(
                this,
                cx,
                height - TITLE_BUTTON_FROM_BOTTOM,
                'START',
                () => this.start(),
                undefined,
                () => !this.guard.active,
            ),
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
