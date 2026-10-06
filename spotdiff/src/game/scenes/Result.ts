import { GameObjects, Scene } from 'phaser';
import { fadeAlpha, promptAlpha } from '../logic/effects';
import type { Layout } from '../logic/layout';
import type { RunSummary } from '../logic/run';
import { setAfter } from '../logic/set';
import { PARAMS } from '../params';
import { MENU_HUE, UI_FONT, drawBackdrop } from './draw';
import { bindOrientation } from './orientation';

export class Result extends Scene {
    private summary!: RunSummary;
    private lockMs = 0;
    private shownMs = 0;
    private faded = false;
    private backdrop!: GameObjects.Graphics;
    private lines: GameObjects.Text[] = [];

    constructor() {
        super('Result');
    }

    init(data: RunSummary) {
        this.summary = data;
        this.lockMs = PARAMS.resultInputLockMs;
        this.shownMs = 0;
        this.faded = false;
    }

    create() {
        const s = this.summary;
        const style = (size: number, color: string) => ({ fontFamily: UI_FONT, fontSize: `${size}px`, color });
        this.backdrop = this.add.graphics();
        this.lines = [
            this.add.text(0, 0, s.won ? 'ALL CLEAR!' : 'TIME UP', style(64, s.won ? '#ffd166' : '#ff8a8a')),
            this.add.text(0, 0, `SET ${s.setNo}`, style(34, '#dfe6f5')),
            this.add.text(0, 0, `STAGE ${s.stage}/${PARAMS.stageCount}`, style(34, '#ffffff')),
            this.add.text(0, 0, `TIME ${s.score}`, style(34, '#ffffff')),
            this.add.text(0, 0, s.won ? 'TAP FOR NEXT SET' : 'TAP TO RETRY', style(36, '#ffffff')),
        ];
        // start invisible so the first rendered frame never shows the texts before the fade-in begins
        for (const t of this.lines) t.setOrigin(0.5).setAlpha(0);

        this.place(bindOrientation(this, (layout) => this.place(layout)));
        this.input.on('pointerdown', this.onPointerDown, this);
        this.events.once('shutdown', () => this.input.off('pointerdown', this.onPointerDown, this));
    }

    update(_time: number, delta: number) {
        if (this.lockMs > 0) this.lockMs -= delta;
        // texts fade in; the prompt additionally breathes (the product of both factors)
        const fade = fadeAlpha(this.shownMs);
        const last = this.lines.length - 1;
        if (!this.faded) {
            for (let i = 0; i < last; i++) this.lines[i].setAlpha(fade);
            this.faded = fade >= 1; // the fixed lines are at full opacity from now on
        }
        this.lines[last].setAlpha(fade * promptAlpha(this.shownMs));
        this.shownMs += delta;
    }

    private onPointerDown() {
        if (this.lockMs > 0) return;
        // Clearing a set moves on to the next one; a failed set is replayed (same pictures).
        this.scene.start('Game', setAfter(this.summary));
    }

    private place(layout: Layout) {
        drawBackdrop(this.backdrop, layout.width, layout.height, MENU_HUE);
        const { x, y } = layout.center;
        const offsets = [-170, -80, -30, 20, 130];
        this.lines.forEach((t, i) => t.setPosition(x, y + offsets[i]));
    }
}
