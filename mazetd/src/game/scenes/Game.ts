import { GameObjects, Input, Scene } from 'phaser';
import {
    BG_COLOR,
    CANVAS_W,
    CELL,
    ENEMY_RADIUS,
    HUD_H,
    INVALID_FLASH,
    TURRET_COST,
    WALL_COST,
    WAVE_MAX
} from '../logic/config';
import { getCell, isGoal, isStart } from '../logic/board';
import { BOARD_RECT, BUTTONS, type ButtonId, buttonAt, cellCenterX, cellCenterY, pointToCell } from '../logic/layout';
import { createGame, type GameState, messageText, selectTool, startWave, tapCell, update } from '../logic/world';

export interface ResultData {
    cleared: boolean;
    kills: number;
    lives: number;
    wave: number;
}

const FONT = 'sans-serif';
const COLOR = {
    board: 0x223344,
    grid: 0x2f4558,
    start: 0x2e7d32,
    goal: 0xc62828,
    wall: 0x8d8d8d,
    turretBase: 0x37474f,
    turret: 0x4fc3f7,
    path: 0xffe082,
    enemy: 0xff7043,
    hpBack: 0x000000,
    hp: 0x66bb6a,
    shot: 0xffffff,
    invalid: 0xff1744,
    button: 0x37474f,
    buttonSelected: 0x0288d1,
    buttonDisabled: 0x263238
};

const BUTTON_LABELS: Readonly<Record<ButtonId, string>> = {
    wall: `壁 ${WALL_COST}`,
    turret: `砲台 ${TURRET_COST}`,
    sell: '売却',
    start: '開始'
};

export class Game extends Scene {
    private state!: GameState;
    private boardGfx!: GameObjects.Graphics;
    private actorGfx!: GameObjects.Graphics;
    private buttonGfx!: GameObjects.Graphics;
    private hudText!: GameObjects.Text;
    private messageText!: GameObjects.Text;
    private buttonTexts!: Record<ButtonId, GameObjects.Text>;
    private invalidCell: { col: number; row: number; left: number } | null = null;
    private shownLives = -1;
    private shownCoins = -1;

    constructor() {
        super('Game');
    }

    create() {
        this.state = createGame();
        this.invalidCell = null;
        this.cameras.main.setBackgroundColor(BG_COLOR);

        this.boardGfx = this.add.graphics();
        this.addStartGoalLabels();
        this.actorGfx = this.add.graphics();
        this.buttonGfx = this.add.graphics();
        this.hudText = this.add.text(CANVAS_W / 2, HUD_H * 0.32, '', { fontFamily: FONT, fontSize: 24, color: '#ffffff' }).setOrigin(0.5);
        this.messageText = this.add.text(CANVAS_W / 2, HUD_H * 0.75, '', { fontFamily: FONT, fontSize: 20, color: '#ffe082' }).setOrigin(0.5);
        this.buttonTexts = {} as Record<ButtonId, GameObjects.Text>;
        for (const id of Object.keys(BUTTONS) as ButtonId[]) {
            const r = BUTTONS[id];
            this.buttonTexts[id] = this.add
                .text(r.x + r.w / 2, r.y + r.h / 2, BUTTON_LABELS[id], { fontFamily: FONT, fontSize: 26, color: '#ffffff' })
                .setOrigin(0.5);
        }

        this.input.on('pointerdown', this.onPointerDown, this);
        this.events.once('shutdown', () => this.input.off('pointerdown', this.onPointerDown, this));

        this.redrawStatic();
    }

    update(_time: number, delta: number) {
        // Actors only change during a wave or while the invalid-cell flash runs (plus one frame to erase it).
        let redrawActors = this.state.phase === 'wave';
        if (this.invalidCell) {
            redrawActors = true;
            this.invalidCell.left -= delta / 1000;
            if (this.invalidCell.left <= 0) this.invalidCell = null;
        }
        if (this.state.phase === 'wave') {
            const phase = update(this.state, delta / 1000);
            if (phase === 'gameover' || phase === 'cleared') {
                this.finish(phase === 'cleared');
                return;
            }
            if (phase === 'build') this.redrawStatic();
            else if (this.state.lives !== this.shownLives || this.state.coins !== this.shownCoins) this.refreshHud();
        }
        if (redrawActors) this.drawActors();
    }

    private onPointerDown(pointer: Input.Pointer) {
        const button = buttonAt(pointer.x, pointer.y);
        if (button === 'start') {
            if (startWave(this.state)) this.redrawStatic();
            return;
        }
        if (button) {
            selectTool(this.state, button);
            this.redrawStatic();
            return;
        }
        const cell = pointToCell(pointer.x, pointer.y);
        if (!cell) return;
        const result = tapCell(this.state, cell.col, cell.row);
        if (result === 'failed') this.invalidCell = { ...cell, left: INVALID_FLASH };
        if (result !== 'ignored') this.redrawStatic();
    }

    private finish(cleared: boolean) {
        const { kills, lives, wave } = this.state;
        const data: ResultData = { cleared, kills, lives, wave };
        this.scene.start('Result', data);
    }

    private refreshHud() {
        const s = this.state;
        this.shownLives = s.lives;
        this.shownCoins = s.coins;
        this.hudText.setText(`ウェーブ ${s.wave}/${WAVE_MAX}   ライフ ${s.lives}   コイン ${s.coins}`);
        this.messageText.setText(messageText(s));
    }

    /** Redraws everything that only changes on player actions or phase changes. */
    private redrawStatic() {
        this.refreshHud();
        this.drawBoard();
        this.drawButtons();
    }

    private drawBoard() {
        const g = this.boardGfx;
        const { board } = this.state;
        g.clear();
        g.fillStyle(COLOR.board).fillRect(BOARD_RECT.x, BOARD_RECT.y, BOARD_RECT.w, BOARD_RECT.h);
        for (let row = 0; row < board.rows; row++) {
            for (let col = 0; col < board.cols; col++) {
                const x = BOARD_RECT.x + col * CELL;
                const y = BOARD_RECT.y + row * CELL;
                if (isStart(board, col, row)) g.fillStyle(COLOR.start).fillRect(x, y, CELL, CELL);
                else if (isGoal(board, col, row)) g.fillStyle(COLOR.goal).fillRect(x, y, CELL, CELL);
                const kind = getCell(board, col, row);
                if (kind === 'wall') g.fillStyle(COLOR.wall).fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
                else if (kind === 'turret') {
                    g.fillStyle(COLOR.turretBase).fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
                    g.fillStyle(COLOR.turret).fillCircle(x + CELL / 2, y + CELL / 2, CELL * 0.3);
                }
            }
        }
        g.lineStyle(1, COLOR.grid);
        for (let col = 0; col <= board.cols; col++) {
            g.lineBetween(BOARD_RECT.x + col * CELL, BOARD_RECT.y, BOARD_RECT.x + col * CELL, BOARD_RECT.y + BOARD_RECT.h);
        }
        for (let row = 0; row <= board.rows; row++) {
            g.lineBetween(BOARD_RECT.x, BOARD_RECT.y + row * CELL, BOARD_RECT.x + BOARD_RECT.w, BOARD_RECT.y + row * CELL);
        }
        if (this.state.phase === 'build') this.drawPathPreview(g);
    }

    private drawPathPreview(g: GameObjects.Graphics) {
        g.fillStyle(COLOR.path, 0.8);
        for (const p of this.state.path) g.fillCircle(cellCenterX(p.col), cellCenterY(p.row), 5);
    }

    private addStartGoalLabels() {
        const { start, goal } = this.state.board;
        const style = { fontFamily: FONT, fontSize: 28, color: '#ffffff', fontStyle: 'bold' };
        this.add.text(cellCenterX(start.col), cellCenterY(start.row), 'S', style).setOrigin(0.5).setAlpha(0.7);
        this.add.text(cellCenterX(goal.col), cellCenterY(goal.row), 'G', style).setOrigin(0.5).setAlpha(0.7);
    }

    private drawButtons() {
        const g = this.buttonGfx;
        const s = this.state;
        g.clear();
        for (const id of Object.keys(BUTTONS) as ButtonId[]) {
            const r = BUTTONS[id];
            let color = COLOR.button;
            if (id === 'start' && s.phase !== 'build') color = COLOR.buttonDisabled;
            else if (id === s.tool) color = COLOR.buttonSelected;
            g.fillStyle(color).fillRoundedRect(r.x, r.y, r.w, r.h, 10);
            this.buttonTexts[id].setAlpha(id === 'start' && s.phase !== 'build' ? 0.4 : 1);
        }
    }

    private drawActors() {
        const g = this.actorGfx;
        g.clear();
        if (this.invalidCell) {
            const { col, row } = this.invalidCell;
            g.fillStyle(COLOR.invalid, 0.6).fillRect(BOARD_RECT.x + col * CELL, BOARD_RECT.y + row * CELL, CELL, CELL);
        }
        for (const t of this.state.turrets) {
            if (t.flash <= 0) continue;
            g.lineStyle(3, COLOR.shot).lineBetween(t.x, t.y, t.targetX, t.targetY);
        }
        for (const e of this.state.enemies) {
            g.fillStyle(COLOR.enemy).fillCircle(e.x, e.y, ENEMY_RADIUS);
            if (e.hp < e.maxHp) {
                const w = ENEMY_RADIUS * 2;
                const top = e.y - ENEMY_RADIUS - 8;
                g.fillStyle(COLOR.hpBack).fillRect(e.x - ENEMY_RADIUS, top, w, 4);
                g.fillStyle(COLOR.hp).fillRect(e.x - ENEMY_RADIUS, top, (w * e.hp) / e.maxHp, 4);
            }
        }
    }
}
