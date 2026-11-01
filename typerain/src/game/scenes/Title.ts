import { type GameObjects, Scale, Scene } from 'phaser';
import { FONT_HELP, FONT_RESULT, FONT_TITLE, SCREEN_WIDTH } from '../params';
import { formatBest } from '../logic/best';
import { titleLayout } from '../logic/layout';
import {
    addButton,
    addLabel,
    bestStore,
    type ButtonHandle,
    COLOR,
    MONO_FONT,
    onEnter,
    RotateGuard,
    SceneExit,
} from './ui';
import { typingInput } from './typingInput';

const HELP_LINES = ['降ってくる英単語を打って消す', '床に着くとライフが 1 減る（3 つで終了）', '打ち間違えるとコンボが切れる'];

export class Title extends Scene {
    private guard!: RotateGuard;
    private exit!: SceneExit;
    private button: ButtonHandle | null = null;
    private name!: GameObjects.Text;
    private help: GameObjects.Text[] = [];
    private best!: GameObjects.Text;

    constructor() {
        super('Title');
    }

    create() {
        // Scene instances are reused: drop the previous run's (destroyed) button before the notice reports to it.
        this.button = null;
        const cx = SCREEN_WIDTH / 2;
        this.name = addLabel(this, cx, 0, 'TYPE RAIN', FONT_TITLE, COLOR.text, MONO_FONT);
        this.help = HELP_LINES.map((line) => addLabel(this, cx, 0, line, FONT_HELP, COLOR.sub));
        this.best = addLabel(this, cx, 0, formatBest(bestStore.load()), FONT_RESULT, COLOR.accent);
        // The notice first: it reports to the button below when it appears or goes away.
        this.guard = new RotateGuard(this, () => this.button?.reset());
        this.exit = new SceneExit(this);
        this.button = addButton(this, cx, 0, 'START', () => this.start(), undefined, () => !this.guard.active);
        onEnter(this, () => this.start());
        this.layout();
        // The keyboard opening or the device turning changes the logical height: lay out again.
        this.scale.on(Scale.Events.RESIZE, this.layout, this);
        this.events.once('shutdown', () => this.scale.off(Scale.Events.RESIZE, this.layout, this));

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

    private layout() {
        const l = titleLayout(this.scale.gameSize.height, HELP_LINES.length);
        this.name.setY(l.nameY);
        this.help.forEach((t, i) => t.setY(l.helpY[i]));
        this.best.setY(l.bestY);
        this.button?.moveTo(SCREEN_WIDTH / 2, l.buttonY);
    }

    private start() {
        if (this.guard.active) return;
        // Inside the release / key press itself: iOS only opens the keyboard from a user gesture.
        typingInput().focus();
        this.exit.to('Game');
    }
}
