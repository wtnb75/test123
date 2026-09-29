import { GameObjects, Scene, type Types } from 'phaser';
import {
    BONUS_LABEL, NO_KILLS_LABEL, lineAlpha, normalizeBreakdown, tableLines, totalLabel,
    type BreakdownKind, type KindTally, type TableLine
} from '../logic/breakdown';
import { GAMEOVER_HINT_FADE } from '../logic/constants';
import { GAMEOVER_INPUT_LOCK, RetryInput, hintAlpha } from '../logic/retry';
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
/** Seconds after which the breakdown lines and the retry hint no longer change. */
const FADES_DONE_AT = GAMEOVER_INPUT_LOCK + GAMEOVER_HINT_FADE;

interface GameOverData {
    score?: number;
    breakdown?: Partial<Record<BreakdownKind, Partial<KindTally>>>;
}

export class GameOver extends Scene {
    /** Seconds since the screen opened, driving the staggered fade-in. */
    private elapsed = 0;
    /** The texts of each staggered line (shown kind rows or NO KILLS, the bonus, the total), faded together. */
    private lines: GameObjects.Text[][] = [];
    private hint!: GameObjects.Text;
    private retry = new RetryInput();

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
        this.retry = new RetryInput();

        this.add.text(cx, cy - 250, 'GAME OVER', { fontFamily: FONT, fontSize: 56, color: TITLE_COLOR }).setOrigin(0.5);

        const rowStyle = { fontFamily: FONT, fontSize: ROW_FONT_SIZE, color: WHITE };
        let y = cy - 160;
        for (const line of tableLines(score, breakdown)) {
            this.lines.push(this.addTableLine(line, cx, y, rowStyle));
            y += ROW_SPACING;
        }
        y += 40;
        this.lines.push([
            this.add.text(cx, y, totalLabel(score), { fontFamily: FONT, fontSize: TOTAL_FONT_SIZE, color: WHITE }).setOrigin(0.5)
        ]);
        this.hint = this.add.text(cx, y + 80, 'Press SPACE or tap to retry', { fontFamily: FONT, fontSize: 22, color: HINT_COLOR })
            .setOrigin(0.5);
        this.applyFade();

        const keyboard = this.input.keyboard!;
        keyboard.on('keydown', this.onKeyDown, this);
        this.input.on('pointerdown', this.onPointerDown, this);
        this.events.once('shutdown', () => {
            keyboard.off('keydown', this.onKeyDown, this);
            this.input.off('pointerdown', this.onPointerDown, this);
        });
    }

    /** The texts of one table line, in the name / count / points columns. */
    private addTableLine(line: TableLine, cx: number, y: number, style: Types.GameObjects.Text.TextStyle): GameObjects.Text[] {
        if (line.type === 'noKills') return [this.add.text(cx + NAME_X, y, NO_KILLS_LABEL, style).setOrigin(0, 0.5)];
        if (line.type === 'bonus') {
            return [
                this.add.text(cx + NAME_X, y, BONUS_LABEL, style).setOrigin(0, 0.5),
                this.add.text(cx + POINTS_X, y, line.value, style).setOrigin(1, 0.5)
            ];
        }
        const { row } = line;
        return [
            this.add.text(cx + NAME_X, y, row.name, { ...style, color: cssColor(KIND_COLORS[row.kind]) }).setOrigin(0, 0.5),
            this.add.text(cx + COUNT_X, y, row.count, style).setOrigin(0, 0.5),
            this.add.text(cx + POINTS_X, y, row.points, style).setOrigin(1, 0.5)
        ];
    }

    update(_time: number, delta: number) {
        // Once every line and the hint are fully shown the fade stops; elapsed then stays past the lock.
        if (this.elapsed < FADES_DONE_AT) {
            this.elapsed += delta / 1000;
            this.applyFade();
        }
        if (this.retry.resolve(this.elapsed)) this.scene.start('Game');
    }

    private onKeyDown(event: KeyboardEvent) {
        this.retry.keyDown(event.keyCode, event.repeat);
    }

    private onPointerDown() {
        this.retry.pointerDown();
    }

    private applyFade() {
        this.lines.forEach((texts, i) => {
            const alpha = lineAlpha(this.elapsed, i);
            for (const t of texts) t.setAlpha(alpha);
        });
        this.hint.setAlpha(hintAlpha(this.elapsed));
    }
}
