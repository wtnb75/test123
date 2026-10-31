import { Scene, type GameObjects } from 'phaser';
import { PARAMS } from '../params';
import { bestLabel, type BestRow } from '../logic/best';
import { guardOpen } from '../logic/flow';
import { resultBestY, type Layout } from '../logic/layout';
import { addLabel, applyLayout, COLORS, createButton, DEPTH, FONT_SIZE, watchOrientation, type ButtonView } from './ui';

export class Result extends Scene {
    private layout!: Layout;
    private lines = 0;
    /** Clears of the run that earned the shortest-clear bonus. */
    private shortest = 0;
    /** Input is ignored until the guard time has passed (the tap that ended the run is still releasing). */
    private enteredAt = 0;
    /** Set once the Scene is on its way out, so two inputs in one frame start the next Scene only once. */
    private leaving = false;
    private captionText!: GameObjects.Text;
    private linesText!: GameObjects.Text;
    private shortestText!: GameObjects.Text;
    /** The best row Game decided at the end of the run; null when there is none to show. */
    private best: BestRow | null = null;
    /** Absent when there is no best to show (nothing saved yet, or the storage is unavailable). */
    private bestText?: GameObjects.Text;
    private retry!: ButtonView;
    private toTitle!: ButtonView;

    constructor() {
        super('Result');
    }

    init(data: { lines?: number; shortest?: number; best?: BestRow | null }) {
        this.lines = data.lines ?? 0;
        this.shortest = data.shortest ?? 0;
        this.best = data.best ?? null;
    }

    create() {
        this.layout = applyLayout(this);
        this.cameras.main.setBackgroundColor(COLORS.bg);
        this.enteredAt = performance.now();
        this.leaving = false;

        this.cameras.main.fadeIn(PARAMS.sceneFadeMs);
        this.captionText = addLabel(this, 0, 0, '手数切れ', FONT_SIZE.button, COLORS.captionText);
        this.linesText = addLabel(this, 0, 0, `ライン ${this.lines}`, FONT_SIZE.headline);
        this.shortestText = addLabel(this, 0, 0, `最短 ${this.shortest} 回`, FONT_SIZE.button, COLORS.bonusText);
        // Game already read and saved the best while the run went on; Result only shows its row.
        this.bestText = undefined;
        if (this.best !== null) {
            this.bestText = addLabel(this, 0, 0, bestLabel(this.best), FONT_SIZE.button, this.best.updated ? COLORS.recoveredText : COLORS.captionText);
        }
        this.retry = createButton(this, 'もう一度', COLORS.buttonDefault, DEPTH.hud);
        this.toTitle = createButton(this, 'タイトルへ', COLORS.buttonDefault, DEPTH.hud);
        this.retry.box.setInteractive({ useHandCursor: true }).on('pointerup', () => this.go('Game'));
        this.toTitle.box.setInteractive({ useHandCursor: true }).on('pointerup', () => this.go('Title'));

        this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
            if (!e.repeat && (e.code === 'Space' || e.code === 'Enter')) this.go('Game');
        });
        this.input.keyboard?.addCapture('SPACE');
        this.events.once('shutdown', () => this.input.keyboard?.removeCapture('SPACE'));

        this.place();
        watchOrientation(this, () => this.layout, (layout) => {
            this.layout = layout;
            this.place();
        });
    }

    private place() {
        const l = this.layout;
        this.captionText.setPosition(l.resultLines.x, l.resultLines.y - PARAMS.resultCaptionGap);
        this.linesText.setPosition(l.resultLines.x, l.resultLines.y);
        this.shortestText.setPosition(l.resultLines.x, l.resultLines.y + PARAMS.resultShortestGap);
        this.bestText?.setPosition(l.resultLines.x, resultBestY(l));
        this.retry.place(l.resultRetry);
        this.toTitle.place(l.resultToTitle);
    }

    private go(scene: 'Game' | 'Title') {
        if (this.leaving || !guardOpen(this.enteredAt, performance.now())) return;
        this.leaving = true;
        this.scene.start(scene);
    }
}
