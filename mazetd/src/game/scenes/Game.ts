import { GameObjects, Input, Scene } from 'phaser';
import {
    BANNER_FADE,
    BANNER_TIME,
    BG_COLOR,
    BUTTON_FLASH,
    CANVAS_H,
    CANVAS_W,
    CELL,
    DT_MAX,
    ENEMY_RADIUS,
    FADE_TIME,
    HUD_H,
    INVALID_FLASH,
    KILL_FX,
    KILL_REWARD,
    LEAK_FLASH,
    LIFE_FLASH,
    POPUP_MAX,
    POPUP_RISE,
    POPUP_TIME,
    RANGE_PULSE,
    TURRET_COST,
    TURRET_RANGE,
    WALL_COST,
    WAVE_BONUS,
    WAVE_MAX
} from '../logic/config';
import { getCell, indexOf, isGoal, isStart } from '../logic/board';
import { CellTimers, Countdown, PopupPool } from '../logic/effects';
import { BOARD_RECT, BUTTONS, type ButtonId, buttonAt, cellCenterX, cellCenterY, pointToCell } from '../logic/layout';
import { ageShotLines, createGame, type GameState, messageText, selectTool, startWave, tapCell, update } from '../logic/world';

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
    range: 0x4fc3f7,
    path: 0xffe082,
    enemy: 0xff7043,
    hpBack: 0x000000,
    hp: 0x66bb6a,
    shot: 0xffffff,
    invalid: 0xff1744,
    leak: 0xff1744,
    killRing: 0xffe082,
    button: 0x37474f,
    buttonSelected: 0x0288d1,
    buttonDisabled: 0x263238,
    buttonFlash: 0x81d4fa
};
// Applied to the render texture that holds the opaque union of all range circles, so overlaps don't darken.
const RANGE_FILL_ALPHA = 0.12;
const LIFE_COLOR = '#ffffff';
const LIFE_ALERT_COLOR = '#ff5252';

const BUTTON_IDS = Object.keys(BUTTONS) as ButtonId[];
const BUTTON_LABELS: Readonly<Record<ButtonId, string>> = {
    wall: `壁 ${WALL_COST}`,
    turret: `砲台 ${TURRET_COST}`,
    sell: '売却',
    start: '開始'
};

export class Game extends Scene {
    private state!: GameState;
    private boardGfx!: GameObjects.Graphics;
    private rangeFillTex!: GameObjects.RenderTexture;
    private rangeShapeGfx!: GameObjects.Graphics;
    private rangeLineGfx!: GameObjects.Graphics;
    private actorGfx!: GameObjects.Graphics;
    private goalFlashGfx!: GameObjects.Graphics;
    private buttonGfx!: GameObjects.Graphics;
    private hudWave!: GameObjects.Text;
    private hudLives!: GameObjects.Text;
    private hudCoins!: GameObjects.Text;
    private messageText!: GameObjects.Text;
    private bannerText!: GameObjects.Text;
    private buttonTexts!: Record<ButtonId, GameObjects.Text>;
    private popupTexts!: GameObjects.Text[];

    private invalidCell = { col: 0, row: 0 };
    private invalidFlash!: Countdown;
    private leakFlash!: Countdown;
    private lifeFlash!: Countdown;
    private banner!: Countdown;
    private buttonFlash!: Record<ButtonId, Countdown>;
    private rangePulse!: CellTimers;
    private popups!: PopupPool;
    private ending = false;
    private actorsWereAnimated = false;
    private buttonsWereFlashing = false;
    private lifeWasAlert = false;
    private shownLives = -1;
    private shownCoins = -1;

    constructor() {
        super('Game');
    }

    create() {
        this.state = createGame();
        this.initEffects();
        this.cameras.main.setBackgroundColor(BG_COLOR);

        this.boardGfx = this.add.graphics();
        this.rangeFillTex = this.add.renderTexture(0, 0, CANVAS_W, CANVAS_H).setOrigin(0, 0).setAlpha(RANGE_FILL_ALPHA);
        // Off-screen scratch shape, stamped into rangeFillTex; not on the display list, so destroy it ourselves.
        this.rangeShapeGfx = this.make.graphics({}, false);
        this.events.once('shutdown', () => this.rangeShapeGfx.destroy());
        this.rangeLineGfx = this.add.graphics();
        this.goalFlashGfx = this.add.graphics();
        this.addStartGoalLabels();
        this.actorGfx = this.add.graphics();
        this.addBoardFrame();
        this.buttonGfx = this.add.graphics();
        this.createHud();
        this.buttonTexts = {} as Record<ButtonId, GameObjects.Text>;
        for (const id of BUTTON_IDS) {
            const r = BUTTONS[id];
            this.buttonTexts[id] = this.add
                .text(r.x + r.w / 2, r.y + r.h / 2, BUTTON_LABELS[id], { fontFamily: FONT, fontSize: 26, color: '#ffffff' })
                .setOrigin(0.5);
        }
        this.createEffectTexts();

        this.input.on('pointerdown', this.onPointerDown, this);
        this.events.once('shutdown', () => this.input.off('pointerdown', this.onPointerDown, this));

        this.redrawStatic();
    }

    private initEffects() {
        this.invalidFlash = new Countdown(INVALID_FLASH);
        this.leakFlash = new Countdown(LEAK_FLASH);
        this.lifeFlash = new Countdown(LIFE_FLASH);
        this.banner = new Countdown(BANNER_TIME);
        this.buttonFlash = {} as Record<ButtonId, Countdown>;
        for (const id of BUTTON_IDS) this.buttonFlash[id] = new Countdown(BUTTON_FLASH);
        this.rangePulse = new CellTimers(RANGE_PULSE);
        this.popups = new PopupPool(POPUP_MAX, POPUP_TIME);
        this.ending = false;
        this.actorsWereAnimated = false;
        this.buttonsWereFlashing = false;
        this.lifeWasAlert = false;
        this.shownLives = -1;
        this.shownCoins = -1;
    }

    private createHud() {
        const style = { fontFamily: FONT, fontSize: 24, color: '#ffffff' };
        const y = HUD_H * 0.32;
        this.hudWave = this.add.text(CANVAS_W * 0.18, y, '', style).setOrigin(0.5);
        this.hudLives = this.add.text(CANVAS_W * 0.5, y, '', style).setOrigin(0.5);
        this.hudCoins = this.add.text(CANVAS_W * 0.82, y, '', style).setOrigin(0.5);
        this.messageText = this.add.text(CANVAS_W / 2, HUD_H * 0.75, '', { fontFamily: FONT, fontSize: 20, color: '#ffe082' }).setOrigin(0.5);
    }

    private createEffectTexts() {
        const popupStyle = { fontFamily: FONT, fontSize: 22, color: '#ffe082', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 };
        this.popupTexts = [];
        for (let i = 0; i < POPUP_MAX; i++) {
            this.popupTexts.push(this.add.text(0, 0, `+${KILL_REWARD}`, popupStyle).setOrigin(0.5).setVisible(false));
        }
        this.bannerText = this.add
            .text(BOARD_RECT.x + BOARD_RECT.w / 2, BOARD_RECT.y + BOARD_RECT.h / 2, '', {
                fontFamily: FONT,
                fontSize: 36,
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 6
            })
            .setOrigin(0.5)
            .setVisible(false);
    }

    update(_time: number, delta: number) {
        // Same cap as the logic, so a slow frame can't swallow a whole effect.
        const dt = Math.min(delta / 1000, DT_MAX);
        // Age running effects first: ones started below get their full length from this frame on.
        this.tickEffects(dt);
        // Logic is frozen while fading out; shot lines still age with the other effects.
        if (this.ending) ageShotLines(this.state, dt);
        else if (this.state.phase === 'wave') this.stepWave(dt);
        this.drawEffectsIfNeeded();
    }

    /** Covers everything outside the board with the background so range circles stay on the board. */
    private addBoardFrame() {
        const g = this.add.graphics();
        const right = BOARD_RECT.x + BOARD_RECT.w;
        const bottom = BOARD_RECT.y + BOARD_RECT.h;
        g.fillStyle(BG_COLOR);
        g.fillRect(0, 0, CANVAS_W, BOARD_RECT.y);
        g.fillRect(0, bottom, CANVAS_W, CANVAS_H - bottom);
        g.fillRect(0, BOARD_RECT.y, BOARD_RECT.x, BOARD_RECT.h);
        g.fillRect(right, BOARD_RECT.y, CANVAS_W - right, BOARD_RECT.h);
    }

    private stepWave(dt: number) {
        const phase = update(this.state, dt);
        const { events } = this.state;
        for (let i = 0; i < events.killX.length; i++) this.popups.spawn(events.killX[i], events.killY[i]);
        if (events.leaks > 0) {
            this.leakFlash.start();
            this.lifeFlash.start();
        }
        if (phase === 'gameover' || phase === 'cleared') {
            this.refreshHud();
            this.beginEnding(phase === 'cleared');
        } else if (phase === 'build') {
            this.showBanner(this.state.wave - 1);
            this.redrawStatic();
        } else if (this.state.lives !== this.shownLives || this.state.coins !== this.shownCoins) {
            this.refreshHud();
        }
    }

    private tickEffects(dt: number) {
        this.invalidFlash.tick(dt);
        this.leakFlash.tick(dt);
        this.lifeFlash.tick(dt);
        this.banner.tick(dt);
        for (const id of BUTTON_IDS) this.buttonFlash[id].tick(dt);
        this.rangePulse.tick(dt);
        this.popups.tick(dt);
    }

    private drawEffectsIfNeeded() {
        const animated =
            this.state.phase === 'wave' ||
            this.ending ||
            this.invalidFlash.active ||
            this.leakFlash.active ||
            this.popups.anyActive ||
            (this.rangePulse.size > 0 && this.showsRanges());
        // One extra frame after the last animation clears what it left behind.
        if (animated || this.actorsWereAnimated) this.drawActors();
        this.actorsWereAnimated = animated;

        let flashing = false;
        for (const id of BUTTON_IDS) if (this.buttonFlash[id].active) flashing = true;
        if (flashing || this.buttonsWereFlashing) this.drawButtons();
        this.buttonsWereFlashing = flashing;

        const alert = this.lifeFlash.active;
        if (alert !== this.lifeWasAlert) this.hudLives.setColor(alert ? LIFE_ALERT_COLOR : LIFE_COLOR);
        this.lifeWasAlert = alert;

        this.updateBanner();
        this.updatePopupTexts();
    }

    private onPointerDown(pointer: Input.Pointer) {
        if (this.ending) return;
        const button = buttonAt(pointer.x, pointer.y);
        if (button === 'start') {
            if (!startWave(this.state)) return;
            this.buttonFlash.start.start();
            this.banner.stop();
            this.redrawStatic();
            return;
        }
        if (button) {
            this.buttonFlash[button].start();
            selectTool(this.state, button);
            this.redrawStatic();
            return;
        }
        const cell = pointToCell(pointer.x, pointer.y);
        if (!cell) return;
        const result = tapCell(this.state, cell.col, cell.row);
        const index = indexOf(this.state.board, cell.col, cell.row);
        if (result === 'failed') {
            this.invalidCell = cell;
            this.invalidFlash.start();
        } else if (result === 'placed' && this.state.tool === 'turret') {
            this.rangePulse.start(index);
        } else if (result === 'sold') {
            this.rangePulse.remove(index);
        }
        if (result !== 'ignored') this.redrawStatic();
    }

    private beginEnding(cleared: boolean) {
        const { kills, lives, wave } = this.state;
        const data: ResultData = { cleared, kills, lives, wave };
        this.ending = true;
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Result', data));
        this.cameras.main.fadeOut(FADE_TIME * 1000, 0, 0, 0);
    }

    private showBanner(clearedWave: number) {
        this.bannerText.setText(`ウェーブ ${clearedWave} クリア！ +${WAVE_BONUS}`);
        this.banner.start();
    }

    private updateBanner() {
        if (!this.banner.active) {
            if (this.bannerText.visible) this.bannerText.setVisible(false);
            return;
        }
        this.bannerText.setVisible(true).setAlpha(Math.min(1, this.banner.left / BANNER_FADE));
    }

    private updatePopupTexts() {
        const items = this.popups.items;
        for (let i = 0; i < items.length; i++) {
            const p = items[i];
            const text = this.popupTexts[i];
            if (!p.active) {
                if (text.visible) text.setVisible(false);
                continue;
            }
            const t = p.age / POPUP_TIME;
            text.setVisible(true).setPosition(p.x, p.y - POPUP_RISE * t).setAlpha(1 - t);
        }
    }

    private refreshHud() {
        const s = this.state;
        this.shownLives = s.lives;
        this.shownCoins = s.coins;
        this.hudWave.setText(`ウェーブ ${s.wave}/${WAVE_MAX}`);
        this.hudLives.setText(`ライフ ${s.lives}`);
        this.hudCoins.setText(`コイン ${s.coins}`);
        this.messageText.setText(messageText(s));
    }

    /** Redraws everything that only changes on player actions or phase changes. */
    private redrawStatic() {
        this.refreshHud();
        this.drawBoard();
        this.drawButtons();
    }

    private showsRanges(): boolean {
        return this.state.phase === 'build' && this.state.tool === 'turret';
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
        this.drawRanges();
        if (this.state.phase === 'build') this.drawPathPreview(g);
    }

    private drawRanges() {
        const fill = this.rangeShapeGfx;
        const line = this.rangeLineGfx;
        fill.clear();
        line.clear();
        this.rangeFillTex.clear();
        if (!this.showsRanges()) {
            this.rangeFillTex.render();
            return;
        }
        const { board } = this.state;
        fill.fillStyle(COLOR.range, 1);
        line.lineStyle(1, COLOR.range, 0.5);
        for (let row = 0; row < board.rows; row++) {
            for (let col = 0; col < board.cols; col++) {
                if (getCell(board, col, row) !== 'turret') continue;
                fill.fillCircle(cellCenterX(col), cellCenterY(row), TURRET_RANGE);
                line.strokeCircle(cellCenterX(col), cellCenterY(row), TURRET_RANGE);
            }
        }
        this.rangeFillTex.draw(fill).render();
    }

    private drawPathPreview(g: GameObjects.Graphics) {
        const { board } = this.state;
        g.fillStyle(COLOR.path, 0.8);
        for (const p of this.state.path) {
            if (isStart(board, p.col, p.row) || isGoal(board, p.col, p.row)) continue;
            g.fillCircle(cellCenterX(p.col), cellCenterY(p.row), 5);
        }
    }

    private addStartGoalLabels() {
        const { start, goal } = this.state.board;
        const style = { fontFamily: FONT, fontSize: 28, color: '#ffffff', fontStyle: 'bold' };
        this.add.text(cellCenterX(start.col), cellCenterY(start.row), 'S', style).setOrigin(0.5);
        this.add.text(cellCenterX(goal.col), cellCenterY(goal.row), 'G', style).setOrigin(0.5);
    }

    private drawButtons() {
        const g = this.buttonGfx;
        const s = this.state;
        g.clear();
        for (const id of BUTTON_IDS) {
            const r = BUTTONS[id];
            const disabled = id === 'start' && s.phase !== 'build';
            let color = COLOR.button;
            // Flash wins over the disabled look: a valid Start tap flashes even though the wave has begun.
            if (this.buttonFlash[id].active) color = COLOR.buttonFlash;
            else if (disabled) color = COLOR.buttonDisabled;
            else if (id === s.tool) color = COLOR.buttonSelected;
            g.fillStyle(color).fillRoundedRect(r.x, r.y, r.w, r.h, 10);
            this.buttonTexts[id].setAlpha(disabled ? 0.4 : 1);
        }
    }

    private drawGoalFlash() {
        const g = this.goalFlashGfx;
        g.clear();
        if (!this.leakFlash.active) return;
        const { goal } = this.state.board;
        const alpha = 0.7 * (1 - this.leakFlash.progress);
        g.fillStyle(COLOR.leak, alpha).fillRect(BOARD_RECT.x + goal.col * CELL, BOARD_RECT.y + goal.row * CELL, CELL, CELL);
    }

    private drawActors() {
        this.drawGoalFlash();
        const g = this.actorGfx;
        g.clear();
        if (this.invalidFlash.active) {
            const { col, row } = this.invalidCell;
            g.fillStyle(COLOR.invalid, 0.6).fillRect(BOARD_RECT.x + col * CELL, BOARD_RECT.y + row * CELL, CELL, CELL);
        }
        if (this.showsRanges()) this.drawRangePulses(g);
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
        for (const p of this.popups.items) {
            if (!p.active || p.age >= KILL_FX) continue;
            const t = p.age / KILL_FX;
            g.lineStyle(3, COLOR.killRing, 1 - t).strokeCircle(p.x, p.y, ENEMY_RADIUS * (1 + t));
        }
    }

    private drawRangePulses(g: GameObjects.Graphics) {
        const { board } = this.state;
        for (let row = 0; row < board.rows; row++) {
            for (let col = 0; col < board.cols; col++) {
                if (!this.rangePulse.has(indexOf(board, col, row))) continue;
                g.lineStyle(4, COLOR.range, 0.95).strokeCircle(cellCenterX(col), cellCenterY(row), TURRET_RANGE);
            }
        }
    }
}
