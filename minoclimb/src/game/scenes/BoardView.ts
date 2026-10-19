import { GameObjects, type Scene } from 'phaser';
import { P, WIDTH, HEIGHT } from '../params';
import { crumbleBlink, flashAlpha, hintAlpha } from '../logic/effects';
import type { StickView } from '../logic/input';
import type { Round, RoundEvent } from '../logic/round';
import { shapeCells, type Cell } from '../logic/pieces';
import { frameView, telegraphView } from '../logic/telegraph';

const COLORS = [0x00d0d0, 0xf0d000, 0xa000d0, 0x00c040, 0xd02020, 0x2040e0, 0xf08000];
const BACKGROUND = 0x10131c;
const DANGER_BAND = 0x4a2a14;
const GOAL_LINE = 0xffe040;
const PLAYER = 0xffffff;
const FLASH = 0xffffff;
const GOAL_LINE_THICKNESS = 4;
const HUD_FONT = {
    fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
};
const LABEL_FONT = { fontFamily: 'sans-serif', fontSize: '12px', color: '#ffffff' };
const HINT_FONT = { fontFamily: 'sans-serif', fontSize: '16px', color: '#ffffff', align: 'center' };
const HINT_TEXT = 'ドラッグ: 移動\nタップ / 上へ弾く: ジャンプ\nドラッグ中に 2 本目の指: ジャンプ';
const HINT_MAX_ALPHA = 0.55;
const LOCK_FLASH_MAX_ALPHA = 0.7;
const CLEAR_FLASH_MAX_ALPHA = 0.8;
const CRUMBLE_MAX_ALPHA = 0.85;

interface Flash {
    /** Cells of a lock flash; empty for a clear flash. */
    cells: Cell[];
    /** Row of a clear flash; -1 for a lock flash. */
    row: number;
    /** Seconds since the flash started. */
    t: number;
}

export interface BoardViewOptions {
    /** The operation hints of the first seconds (not shown behind the Title). */
    hints: boolean;
}

/** Draws the field, the climber, the minos, the labels, the hints, the HUD and the touch stick. */
export class BoardView {
    private readonly board: GameObjects.Graphics;
    private readonly hud: GameObjects.Text;
    private readonly hints: GameObjects.Text[];
    private readonly overlay: GameObjects.Graphics;
    private readonly flashes: Flash[] = [];
    private playElapsed = 0;

    private readonly hintsEnabled: boolean;

    constructor(scene: Scene, options: BoardViewOptions = { hints: true }) {
        this.hintsEnabled = options.hints;
        // The static layer never changes, so it is drawn once, below everything else.
        this.drawBackground(scene.add.graphics());
        this.board = scene.add.graphics();
        this.hud = scene.add.text(6, 4, '', HUD_FONT);
        scene.add.text(WIDTH - 6, P.GOAL_ROW * P.CELL - 4, 'GOAL', { ...LABEL_FONT, color: '#ffe040' })
            .setOrigin(1, 1).setAlpha(0.9);
        scene.add.text(WIDTH / 2, P.TOP_OUT_ROW * P.CELL - 4, 'ここまで積むと負け', LABEL_FONT)
            .setOrigin(0.5, 1).setAlpha(0.35);
        const hintY = HEIGHT - P.CELL * 3;
        this.hints = [
            scene.add.text(WIDTH / 2, hintY, HINT_TEXT, HINT_FONT).setOrigin(0.5).setAlpha(0),
        ];
        this.overlay = scene.add.graphics();
    }

    /**
     * Draws one frame. `active` is true while the round is being played (not after it
     * ended): only then do hints and flashes run. `time` is the frame clock in ms (frozen by the caller
     * once the round ends so the landing frame stops pulsing), `dtMs` the frame time.
     */
    draw(round: Round, stick: StickView | null, time: number, dtMs: number, active: boolean): void {
        const g = this.board;
        const C = P.CELL;
        const dt = Math.min(dtMs / 1000, P.MAX_DT);
        g.clear();

        this.updateFlashes(round, dt, active);

        for (let r = 0; r < P.ROWS; r++) {
            for (let c = 0; c < P.COLS; c++) {
                const v = round.grid[r][c];
                if (v !== 0) g.fillStyle(COLORS[v - 1], 1).fillRect(c * C + 1, r * C + 1, C - 2, C - 2);
            }
        }

        this.drawCrumble(round);
        this.drawFlashes();
        this.drawFlow(round, time);

        const p = round.player;
        g.fillStyle(PLAYER, 1).fillRect(p.x * C, p.y * C, P.PLAYER_W * C, P.PLAYER_H * C);

        this.hud.setText(`高さ ${round.height} / ${P.ROWS - P.GOAL_ROW}`);
        this.updateHints(dt, active);
        this.drawStick(stick);
    }

    /** Drops the lights that are playing (the Title's curtain starts to close over the demo). */
    clearEffects(): void {
        this.flashes.length = 0;
    }

    private updateFlashes(round: Round, dt: number, active: boolean): void {
        if (!active) {
            // Nothing runs outside active play; whatever was left is cut off (clear, game over, retry).
            this.flashes.length = 0;
            return;
        }
        for (const flash of this.flashes) flash.t += dt;
        round.drainEvents(this.onRoundEvent);
        for (let i = this.flashes.length - 1; i >= 0; i--) {
            const f = this.flashes[i];
            if (f.t >= (f.row < 0 ? P.LOCK_FLASH_TIME : P.CLEAR_FLASH_TIME)) this.flashes.splice(i, 1);
        }
    }

    /** The wall cell that is about to crumble blinks, faster the closer it is to vanishing. */
    private drawCrumble(round: Round): void {
        const target = round.crumble.target;
        if (target === null) return;
        const C = P.CELL;
        const a = CRUMBLE_MAX_ALPHA * crumbleBlink(target.t);
        this.board.fillStyle(FLASH, a).fillRect(target.c * C + 1, target.r * C + 1, C - 2, C - 2);
    }

    private drawFlashes(): void {
        const g = this.board;
        const C = P.CELL;
        for (const f of this.flashes) {
            if (f.row >= 0) {
                const a = CLEAR_FLASH_MAX_ALPHA * flashAlpha(f.t, P.CLEAR_FLASH_TIME);
                g.fillStyle(FLASH, a).fillRect(0, f.row * C, WIDTH, C);
            } else {
                const a = LOCK_FLASH_MAX_ALPHA * flashAlpha(f.t, P.LOCK_FLASH_TIME);
                for (const { c, r } of f.cells) g.fillStyle(FLASH, a).fillRect(c * C + 1, r * C + 1, C - 2, C - 2);
            }
        }
    }

    private readonly onRoundEvent = (event: RoundEvent): void => {
        if (event.kind === 'locked') this.flashes.push({ cells: event.cells, row: -1, t: 0 });
        else for (const row of event.rows) this.flashes.push({ cells: [], row, t: 0 });
    };

    private updateHints(dt: number, active: boolean): void {
        if (!this.hintsEnabled) return;
        if (active) this.playElapsed += dt;
        const alpha = active ? HINT_MAX_ALPHA * hintAlpha(this.playElapsed) : 0;
        for (const hint of this.hints) hint.setAlpha(alpha);
    }

    private drawBackground(g: GameObjects.Graphics): void {
        const C = P.CELL;
        g.fillStyle(BACKGROUND, 1).fillRect(0, 0, WIDTH, HEIGHT);
        g.fillStyle(DANGER_BAND, 1).fillRect(0, 0, WIDTH, P.TOP_OUT_ROW * C);
        g.fillStyle(GOAL_LINE, 1).fillRect(0, P.GOAL_ROW * C - GOAL_LINE_THICKNESS / 2, WIDTH, GOAL_LINE_THICKNESS);
    }

    private drawFlow(round: Round, time: number): void {
        const g = this.board;
        const C = P.CELL;
        const flow = round.flow;
        if (flow.kind === 'wait') return;

        // Landing frame: from the start of the telegraph until the mino is fixed.
        const { plan } = flow;
        const pulse = 0.5 + 0.4 * Math.sin(time / 1000 * 14);
        const color = COLORS[plan.kind];
        const frame = flow.kind === 'telegraph'
            ? frameView(round.grid, plan, flow.t)
            : { cells: shapeCells(plan.kind, plan.rot), col: plan.col, row: plan.row };
        for (const { c, r } of frame.cells) {
            // A shape that cannot come to rest inside the field has its cells above the field left out.
            if (frame.row + r < 0) continue;
            const x = (frame.col + c) * C;
            const y = (frame.row + r) * C;
            g.fillStyle(color, 0.15 * pulse).fillRect(x + 2, y + 2, C - 4, C - 4);
            g.lineStyle(2, color, pulse).strokeRect(x + 2, y + 2, C - 4, C - 4);
        }

        if (flow.kind === 'telegraph') {
            const view = telegraphView(plan, flow.t);
            for (const { c, r } of view.cells) {
                g.fillStyle(color, 0.9).fillRect((view.col + c) * C + 1, r * C + 1, C - 2, C - 2);
            }
        } else {
            const piece = flow.piece;
            for (const { c, r } of piece.cells) {
                g.fillStyle(color, 0.95).fillRect((piece.col + c) * C + 1, (piece.y + r) * C + 1, C - 2, C - 2);
            }
        }
    }

    private drawStick(stick: StickView | null): void {
        const g = this.overlay;
        g.clear();
        if (!stick) return;
        g.lineStyle(3, 0xffffff, 0.35).strokeCircle(stick.anchorX, stick.anchorY, P.STICK_RING_RADIUS);
        g.fillStyle(0xffffff, 0.5).fillCircle(stick.anchorX + stick.knobDx, stick.anchorY + stick.knobDy, P.STICK_KNOB_RADIUS);
    }
}
