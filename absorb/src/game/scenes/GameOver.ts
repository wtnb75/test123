import { GameObjects, Input, Scene } from 'phaser';
import {
    BONUS_LABEL, BREAKDOWN_SHOWN_AT, bonusValue, kindRows, lineAlpha, multiKillBonus, normalizeBreakdown, totalLabel,
    type BreakdownKind, type KindTally
} from '../logic/breakdown';
import { KIND_COLORS, cssColor } from './colors';

const WHITE = '#ffffff';
const TITLE_COLOR = '#ff5252';
const HINT_COLOR = '#aaaaaa';
const FONT = 'monospace';
const ROW_FONT_SIZE = 26;
const TOTAL_FONT_SIZE = 40;
const ROW_SPACING = 38;
/** Column anchors relative to the screen centre: name (left-aligned), count, points (right-aligned). */
const NAME_X = -230;
const COUNT_X = -10;
const POINTS_X = 230;

interface GameOverData {
    score?: number;
    breakdown?: Partial<Record<BreakdownKind, Partial<KindTally>>>;
}

export class GameOver extends Scene {
    /** Seconds since the screen opened, driving the staggered fade-in. */
    private elapsed = 0;
    /** The texts of each staggered line (seven kinds, the bonus, the total), faded together. */
    private lines: GameObjects.Text[][] = [];

    constructor() {
        super('GameOver');
    }

    create(data: GameOverData) {
        const score = data?.score ?? 0;
        const breakdown = normalizeBreakdown(data?.breakdown);
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;
        this.elapsed = 0;
        this.lines = [];

        this.add.text(cx, cy - 250, 'GAME OVER', { fontFamily: FONT, fontSize: 56, color: TITLE_COLOR }).setOrigin(0.5);

        const rowStyle = { fontFamily: FONT, fontSize: ROW_FONT_SIZE, color: WHITE };
        let y = cy - 160;
        for (const row of kindRows(breakdown)) {
            this.lines.push([
                this.add.text(cx + NAME_X, y, row.name, { ...rowStyle, color: cssColor(KIND_COLORS[row.kind]) }).setOrigin(0, 0.5),
                this.add.text(cx + COUNT_X, y, row.count, rowStyle).setOrigin(0, 0.5),
                this.add.text(cx + POINTS_X, y, row.points, rowStyle).setOrigin(1, 0.5)
            ]);
            y += ROW_SPACING;
        }
        this.lines.push([
            this.add.text(cx + NAME_X, y, BONUS_LABEL, rowStyle).setOrigin(0, 0.5),
            this.add.text(cx + POINTS_X, y, bonusValue(multiKillBonus(score, breakdown)), rowStyle).setOrigin(1, 0.5)
        ]);
        y += ROW_SPACING + 40;
        this.lines.push([
            this.add.text(cx, y, totalLabel(score), { fontFamily: FONT, fontSize: TOTAL_FONT_SIZE, color: WHITE }).setOrigin(0.5)
        ]);
        this.applyFade();

        this.add.text(cx, y + 80, 'Press R or tap to retry', { fontFamily: FONT, fontSize: 22, color: HINT_COLOR }).setOrigin(0.5);

        const restart = () => this.scene.start('Game');
        this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.R).once('down', restart);
        this.input.once('pointerdown', restart);
        this.events.once('shutdown', () => this.input.keyboard?.removeAllKeys(true));
    }

    update(_time: number, delta: number) {
        if (this.elapsed >= BREAKDOWN_SHOWN_AT) return; // every line is fully shown
        this.elapsed += delta / 1000;
        this.applyFade();
    }

    private applyFade() {
        this.lines.forEach((texts, i) => {
            const alpha = lineAlpha(this.elapsed, i);
            for (const t of texts) t.setAlpha(alpha);
        });
    }
}
