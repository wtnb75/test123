import { GameObjects, Scene } from 'phaser';
import { hslToHex } from '../logic/color';
import { promptAlpha } from '../logic/effects';
import { HELP_DIFFS, HELP_HEADING, HELP_LINES, HELP_PROMPT, SWATCH_BG, helpInputOpen, helpLayoutFor, helpSample } from '../logic/help';
import type { HelpLayout } from '../logic/help';
import type { Layout } from '../logic/layout';
import { MENU_HUE, PanelFrame, UI_FONT, drawBackdrop, drawShape } from './draw';
import { bindOrientation } from './orientation';

/**
 * The how-to-play screen opened from the Title: the rules in six lines and a figure of the six kinds of
 * difference. It ignores input for `helpInputLockMs`, then any tap goes back to the Title.
 */
export class Help extends Scene {
    private backdrop!: GameObjects.Graphics;
    private figures!: GameObjects.Graphics;
    private heading!: GameObjects.Text;
    private lines: GameObjects.Text[] = [];
    private names: GameObjects.Text[] = [];
    private prompt!: GameObjects.Text;
    /** Time since the Scene started, counted from `update`'s delta (it carries over a re-layout). */
    private elapsed = 0;
    private closing = false;

    constructor() {
        super('Help');
    }

    create() {
        this.elapsed = 0;
        this.closing = false;
        const style = (size: number, color: string) => ({ fontFamily: UI_FONT, fontSize: `${size}px`, color });
        this.backdrop = this.add.graphics();
        this.figures = this.add.graphics();
        this.heading = this.add.text(0, 0, HELP_HEADING, style(56, '#ffffff')).setOrigin(0.5);
        this.lines = HELP_LINES.map((line) => this.add.text(0, 0, line, style(32, '#dfe6f5')).setOrigin(0, 0));
        this.names = HELP_DIFFS.map((name) => this.add.text(0, 0, name, style(32, '#ffd166')).setOrigin(0.5));
        this.prompt = this.add.text(0, 0, HELP_PROMPT, style(36, '#ffffff')).setOrigin(0.5);

        this.place(bindOrientation(this, (layout) => this.place(layout)));
        this.input.on('pointerdown', this.onPointerDown, this);
        this.events.once('shutdown', () => this.input.off('pointerdown', this.onPointerDown, this));
    }

    update(_time: number, delta: number) {
        this.prompt.setAlpha(promptAlpha(this.elapsed));
        this.elapsed += delta;
        // Dev build only: a read-only snapshot for the browser QA scripts (scripts/qa); removed from production.
        if (import.meta.env.DEV) {
            Object.assign(window, { __qa: { scene: 'Help', elapsed: this.elapsed, open: helpInputOpen(this.elapsed) } });
        }
    }

    private onPointerDown() {
        // Input before the lock has passed is dropped, not remembered; the first accepted tap leaves.
        if (this.closing || !helpInputOpen(this.elapsed)) return;
        this.closing = true;
        this.scene.start('Title');
    }

    private place(layout: Layout) {
        const t = helpLayoutFor(layout.kind);
        drawBackdrop(this.backdrop, t.width, t.height, MENU_HUE);
        this.heading.setFontSize(t.headingSize).setPosition(t.heading.x, t.heading.y);
        this.lines.forEach((line, i) => {
            line.setFontSize(t.bodySize).setWordWrapWidth(t.bodyWrap).setPosition(t.body[i].x, t.body[i].y);
        });
        this.names.forEach((name, i) => name.setFontSize(t.labelSize).setPosition(t.cells[i].label.x, t.cells[i].label.y));
        this.prompt.setPosition(t.prompt.x, t.prompt.y);
        this.drawFigures(t);
    }

    /** Each figure is two small pictures side by side: the same shapes except for the named difference. */
    private drawFigures(t: HelpLayout) {
        const g = this.figures;
        g.clear();
        for (const cell of t.cells) {
            const sample = helpSample(cell.name, t.swatch);
            for (const [corner, shapes] of [
                [cell.left, sample.left],
                [cell.right, sample.right],
            ] as const) {
                g.fillStyle(hslToHex(SWATCH_BG.hue, SWATCH_BG.sat, SWATCH_BG.light), 1);
                g.fillRect(corner.x, corner.y, t.swatch, t.swatch);
                const frame: PanelFrame = { x: corner.x, y: corner.y, scale: 1 };
                for (const s of shapes) drawShape(g, s, frame);
            }
        }
    }
}
