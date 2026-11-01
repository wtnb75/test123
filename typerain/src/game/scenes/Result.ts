import { type GameObjects, Scale, Scene } from 'phaser';
import {
    FONT_RESULT,
    FONT_RESULT_SCORE,
    FONT_RESULT_TITLE,
    RESULT_BUTTON_W,
    RESULT_INPUT_GUARD_MS,
    SCREEN_WIDTH,
} from '../params';
import { formatBest } from '../logic/best';
import { GuardTimer } from '../logic/buttons';
import { resultLayout } from '../logic/layout';
import {
    addButton,
    addLabel,
    bestStore,
    type ButtonHandle,
    COLOR,
    onEnter,
    RotateGuard,
    SceneExit,
} from './ui';
import { typingInput } from './typingInput';

export interface ResultData {
    score: number;
    cleared: number;
}

export class Result extends Scene {
    private guard!: RotateGuard;
    private exit!: SceneExit;
    private retry: ButtonHandle | null = null;
    private toTitle: ButtonHandle | null = null;
    private labels: {
        title: GameObjects.Text;
        score: GameObjects.Text;
        words: GameObjects.Text;
        best: GameObjects.Text;
        newBest?: GameObjects.Text;
    } | null = null;
    private score = 0;
    private cleared = 0;
    /** Milliseconds since this Scene started, summed from the frame deltas (the Scene clock is stale in `create`). */
    private readonly sinceStart = new GuardTimer();
    private wasOver = false;

    constructor() {
        super('Result');
    }

    init(data: Partial<ResultData>) {
        this.score = data.score ?? 0;
        this.cleared = data.cleared ?? 0;
    }

    create() {
        // Scene instances are reused: forget everything the previous run left behind (destroyed buttons, labels).
        this.sinceStart.reset();
        this.wasOver = false;
        this.retry = null;
        this.toTitle = null;
        this.labels = null;
        // The best is judged and saved once, as the Result starts.
        const { best, isNew } = bestStore.record(this.score);
        const cx = SCREEN_WIDTH / 2;
        this.labels = {
            title: addLabel(this, cx, 0, 'GAME OVER', FONT_RESULT_TITLE),
            score: addLabel(this, cx, 0, `SCORE ${this.score}`, FONT_RESULT_SCORE),
            words: addLabel(this, cx, 0, `WORDS ${this.cleared}`, FONT_RESULT, COLOR.sub),
            best: addLabel(this, cx, 0, formatBest(best), FONT_RESULT, COLOR.accent),
            newBest: isNew ? addLabel(this, cx, 0, 'NEW BEST!', FONT_RESULT, COLOR.accent) : undefined,
        };
        const accepting = () => !this.guard.active && this.sinceStart.isOver(RESULT_INPUT_GUARD_MS);
        // The notice first: it reports to the buttons below when it appears or goes away.
        this.guard = new RotateGuard(this, () => {
            this.retry?.reset();
            this.toTitle?.reset();
        });
        this.exit = new SceneExit(this);
        this.retry = addButton(this, 0, 0, 'もう一度', () => this.again(), RESULT_BUTTON_W, accepting);
        this.toTitle = addButton(this, 0, 0, 'タイトルへ', () => this.exit.to('Title'), RESULT_BUTTON_W, accepting);
        onEnter(this, () => {
            if (accepting()) this.again();
        });
        this.layout();
        this.scale.on(Scale.Events.RESIZE, this.layout, this);
        this.events.once('shutdown', () => this.scale.off(Scale.Events.RESIZE, this.layout, this));

        if (import.meta.env.DEV) {
            const qa = {};
            Object.defineProperties(qa, {
                scene: { get: () => 'Result' },
                size: { get: () => ({ w: this.scale.gameSize.width, h: this.scale.gameSize.height }) },
                guard: { get: () => this.guard.active },
                score: { get: () => this.score },
                cleared: { get: () => this.cleared },
            });
            (window as unknown as { __qa: unknown }).__qa = qa;
        }
    }

    update(_time: number, delta: number) {
        this.sinceStart.tick(delta);
        // Once the guard time has passed, a mouse resting on a button shows hover.
        if (this.guardJustOver()) {
            this.retry?.refresh();
            this.toTitle?.refresh();
        }
    }

    private guardJustOver(): boolean {
        const over = this.sinceStart.isOver(RESULT_INPUT_GUARD_MS);
        const changed = over && !this.wasOver;
        this.wasOver = over;
        return changed;
    }

    private layout() {
        if (!this.labels) return;
        const l = resultLayout(this.scale.gameSize.height);
        this.labels.title.setY(l.titleY);
        this.labels.score.setY(l.scoreY);
        this.labels.words.setY(l.wordsY);
        this.labels.best.setY(l.bestY);
        this.labels.newBest?.setY(l.newBestY);
        this.retry?.moveTo(l.retryX, l.buttonY);
        this.toTitle?.moveTo(l.titleButtonX, l.buttonY);
    }

    private again() {
        if (this.guard.active) return;
        // Inside the release / key press itself: iOS only opens the keyboard from a user gesture.
        typingInput().focus();
        this.exit.to('Game');
    }
}
