import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { generateStage } from '../core/generator';
import { moveByDelta, chordAtPlayer, movePlayer, toggleFlag } from '../core/rules';
import { inBounds, indexOf } from '../core/board';
import { analyzeCurrentState } from '../core/solver';
import type { LogicalAnalysis } from '../core/solver';
import type { Position, Stage } from '../core/types';
import { REFERENCE_CELL } from '../core/title';
import { BoardView } from './boardView';
import { PressTracker, StageFlow, restartKeyAction } from '../core/flow';
import { restartButtonAt, restartButtonLayout, type ButtonBox, type RestartButtonLayout, type RestartChoice } from '../core/restartButtons';
import { browserStore, createSessionBest, currentHighScore, recordScore, safeGetItem, safeSetItem } from '../core/highScore';
import { STAGE_MAX, parseStagePrompt, resolveStartStage } from '../core/startStage';

const CELL_SIZE = REFERENCE_CELL;
const BOARD_ORIGIN_X = 20;
const BOARD_ORIGIN_Y = 80;
const CAMERA_FOLLOW_MARGIN_CELLS = 4;
const SCROLL_THRESHOLD = 8;
const INPUT_LOCK_MS = 100;
const HIGHSCORE_KEY = 'minefield-rogue-highscore';
const START_STAGE_KEY = 'minefield-rogue-start-stage';
const DEATH_DELAY_MS = 600;
const CLEAR_DELAY_MS = 250;

// Best score of this page's session: lives outside the Scene so NEW GAME / RETRY keep it.
const sessionBest = createSessionBest();

type JoystickState = {
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
};

const JOYSTICK_BASE_RADIUS = 52;
const JOYSTICK_THUMB_RADIUS = 20;
const JOYSTICK_TAP_THRESHOLD = 14;
const JOYSTICK_REPEAT_DELAY = 380;  // ms until first repeat
const JOYSTICK_REPEAT_INTERVAL = 180; // ms between subsequent repeats

const JOYSTICK_DIRS: Position[] = [
    { x: 1,  y: 0  }, // 0 E
    { x: 1,  y: 1  }, // 1 SE
    { x: 0,  y: 1  }, // 2 S
    { x: -1, y: 1  }, // 3 SW
    { x: -1, y: 0  }, // 4 W
    { x: -1, y: -1 }, // 5 NW
    { x: 0,  y: -1 }, // 6 N
    { x: 1,  y: -1 }  // 7 NE
];

type DragState = {
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
};

export class Game extends Scene
{
    camera!: Phaser.Cameras.Scene2D.Camera;
    hudText!: Phaser.GameObjects.Text;
    hintText!: Phaser.GameObjects.Text;
    goalArrow!: Phaser.GameObjects.Text;
    view!: BoardView;
    stageData!: Stage;
    cameraBoundsWidth = 0;
    cameraBoundsHeight = 0;
    inputLockUntil = 0;
    flow = new StageFlow();
    presses = new PressTracker();
    store = browserStore();
    dragState: DragState = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
    virtualControlLayer?: Phaser.GameObjects.Container;
    joystickBase?: Phaser.GameObjects.Ellipse;
    joystickThumb?: Phaser.GameObjects.Ellipse;
    joystickHitArea?: Phaser.Geom.Circle;
    joystickState: JoystickState = { active: false, pointerId: -1, startX: 0, startY: 0 };
    joystickCurrentDir?: Position;
    joystickRepeatEvent?: Phaser.Time.TimerEvent;
    joystickHasFired = false;
    flagBg?: Phaser.GameObjects.Ellipse;
    flagLabel?: Phaser.GameObjects.Text;
    flagHitArea?: Phaser.Geom.Circle;
    stageSelectBg?: Phaser.GameObjects.Rectangle;
    stageSelectLabel?: Phaser.GameObjects.Text;
    stageSelectHitArea?: Phaser.Geom.Rectangle;
    flagMode = false;
    gameOverLogical?: LogicalAnalysis;
    gameOverStageNo = 0;
    /** The game-over buttons (backgrounds and labels) while they are on screen. */
    restartButtons?: Record<keyof RestartButtonLayout, { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }>;
    /** Where the game-over buttons are now (set when they appear, redone on every resize while shown). */
    restartLayout?: RestartButtonLayout;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x0a1f2f);
        this.view = new BoardView(this, { originX: BOARD_ORIGIN_X, originY: BOARD_ORIGIN_Y, cell: CELL_SIZE });

        this.hudText = this.add.text(20, 20, '', {
            fontFamily: 'monospace',
            fontSize: 18,
            color: '#ffffff'
        }).setScrollFactor(0);

        this.hintText = this.add.text(20, 46, '', {
            fontFamily: 'monospace',
            fontSize: 14,
            color: '#c6deff'
        }).setScrollFactor(0);

        this.goalArrow = this.add.text(0, 0, '', {
            fontFamily: 'monospace',
            fontSize: 20,
            fontStyle: 'bold',
            color: '#ffa502',
            stroke: '#0b1220',
            strokeThickness: 3
        }).setScrollFactor(0).setDepth(10);

        // Phaser reuses this instance on scene.start: a new game starts with FLAG off and no input lock.
        this.flagMode = false;
        this.inputLockUntil = 0;
        this.startFirstStage();
        this.createVirtualControls();

        this.input.keyboard?.on('keydown', this.onKeyDown, this);
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);
        this.scale.on('resize', this.onResize, this);

        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown', this.onKeyDown, this);
            this.input.off('pointerdown', this.onPointerDown, this);
            this.input.off('pointermove', this.onPointerMove, this);
            this.input.off('pointerup', this.onPointerUp, this);
            this.scale.off('resize', this.onResize, this);
            this.virtualControlLayer?.destroy(true);
            this.virtualControlLayer = undefined;
            this.joystickBase = undefined;
            this.joystickThumb = undefined;
            this.joystickHitArea = undefined;
            this.flagBg = undefined;
            this.flagLabel = undefined;
            this.flagHitArea = undefined;
            this.stageSelectBg = undefined;
            this.stageSelectLabel = undefined;
            this.stageSelectHitArea = undefined;
            this.joystickState = { active: false, pointerId: -1, startX: 0, startY: 0 };
            this.cancelJoystickRepeat();
            this.joystickCurrentDir = undefined;
            this.joystickHasFired = false;
            this.view.destroy();
            this.restartButtons = undefined;
            this.restartLayout = undefined;
        });
    }

    private startStage (stageNo: number): void
    {
        this.flow.reset();
        this.presses.clear();
        this.gameOverLogical = undefined;
        this.stageData = generateStage(stageNo);
        this.renderBoard();
        this.refreshHud('Stage start');
        this.centerCameraOnPlayer(true);
    }

    private startFirstStage (): void
    {
        const start = resolveStartStage(
            new URLSearchParams(window.location.search).get('stage'),
            safeGetItem(this.store, START_STAGE_KEY)
        );
        this.startStage(start.stage);
        // Saved only once the stage has started, so an oversized value can never block later launches.
        if (start.fromQuery) {
            safeSetItem(this.store, START_STAGE_KEY, String(start.stage));
        }
    }

    private renderBoard (): void
    {
        this.view.render(this.stageData, this.gameOverLogical);
        this.updateCameraBounds();
    }

    private collectChangedCellIndices (prevStage: Stage, nextStage: Stage): number[]
    {
        if (prevStage.cells === nextStage.cells) {
            return [];
        }

        const changed: number[] = [];
        const len = Math.min(prevStage.cells.length, nextStage.cells.length);
        for (let i = 0; i < len; i += 1) {
            const prev = prevStage.cells[i];
            const next = nextStage.cells[i];
            if (
                prev.revealed !== next.revealed ||
                prev.flagged !== next.flagged ||
                prev.hasBomb !== next.hasBomb ||
                prev.hint !== next.hint
            ) {
                changed.push(i);
            }
        }
        return changed;
    }

    private updateCameraBounds (): void
    {
        const boardWidth = this.stageData.width * CELL_SIZE + BOARD_ORIGIN_X * 2;
        const boardHeight = this.stageData.height * CELL_SIZE + BOARD_ORIGIN_Y + 40;
        this.cameraBoundsWidth = Math.max(boardWidth, this.camera.width);
        this.cameraBoundsHeight = Math.max(boardHeight, this.camera.height);
        this.camera.setBounds(0, 0, this.cameraBoundsWidth, this.cameraBoundsHeight);
    }

    private onResize (gameSize: Phaser.Structs.Size): void
    {
        this.camera.setSize(gameSize.width, gameSize.height);
        this.updateCameraBounds();
        this.centerCameraOnPlayer(true);
        this.updateGoalArrow();
        this.layoutVirtualControls();
        this.relayoutRestartButtons(gameSize.width, gameSize.height);
    }

    private createVirtualControls (): void
    {
        this.virtualControlLayer?.destroy(true);
        this.virtualControlLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(30);

        // --- Joystick base (outer ring) ---
        this.joystickBase = this.add.ellipse(0, 0, JOYSTICK_BASE_RADIUS * 2, JOYSTICK_BASE_RADIUS * 2, 0x071a33, 0.55)
            .setStrokeStyle(2, 0x3b82f6, 0.65)
            .setScrollFactor(0)
            .setDepth(31);

        // --- Joystick thumb ---
        this.joystickThumb = this.add.ellipse(0, 0, JOYSTICK_THUMB_RADIUS * 2, JOYSTICK_THUMB_RADIUS * 2, 0x2563eb, 0.92)
            .setStrokeStyle(2, 0x93c5fd, 0.95)
            .setScrollFactor(0)
            .setDepth(33);

        // --- FLAG button ---
        this.flagBg = this.add.ellipse(0, 0, 52, 52, 0x071a33, 0.82)
            .setStrokeStyle(2, 0x22c55e, 0.9)
            .setScrollFactor(0)
            .setDepth(31);

        this.flagLabel = this.add.text(0, 0, 'FLAG', {
            fontFamily: 'monospace',
            fontSize: 11,
            fontStyle: 'bold',
            color: '#86efac',
            stroke: '#0b1220',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

        this.stageSelectBg = this.add.rectangle(0, 0, 90, 34, 0x071a33, 0.88)
            .setStrokeStyle(2, 0xf59e0b, 0.95)
            .setScrollFactor(0)
            .setDepth(31);

        this.stageSelectLabel = this.add.text(0, 0, 'STAGE', {
            fontFamily: 'monospace',
            fontSize: 12,
            fontStyle: 'bold',
            color: '#fbbf24',
            stroke: '#0b1220',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

        this.virtualControlLayer.add(this.joystickBase);
        this.virtualControlLayer.add(this.joystickThumb);
        this.virtualControlLayer.add(this.flagBg);
        this.virtualControlLayer.add(this.flagLabel);
        this.virtualControlLayer.add(this.stageSelectBg);
        this.virtualControlLayer.add(this.stageSelectLabel);

        this.updateFlagButtonVisual();
        this.layoutVirtualControls();
    }

    private updateFlagButtonVisual (): void
    {
        if (!this.flagBg || !this.flagLabel) {
            return;
        }
        if (this.flagMode) {
            this.flagBg.setFillStyle(0x14532d, 0.92);
            this.flagBg.setStrokeStyle(3, 0x4ade80, 1.0);
            this.flagLabel.setText('FLAG\nON').setColor('#4ade80');
        } else {
            this.flagBg.setFillStyle(0x071a33, 0.82);
            this.flagBg.setStrokeStyle(2, 0x22c55e, 0.9);
            this.flagLabel.setText('FLAG').setColor('#86efac');
        }
    }

    private layoutVirtualControls (): void
    {
        if (!this.joystickBase || !this.joystickThumb || !this.flagBg || !this.flagLabel || !this.stageSelectBg || !this.stageSelectLabel) {
            return;
        }

        const W = this.camera.width;
        const H = this.camera.height;
        const compact = H <= 520 || W <= 400;
        const margin = 20;

        const baseR = compact ? Math.round(JOYSTICK_BASE_RADIUS * 0.78) : JOYSTICK_BASE_RADIUS;
        const thumbR = compact ? Math.round(JOYSTICK_THUMB_RADIUS * 0.78) : JOYSTICK_THUMB_RADIUS;
        const flagSize = compact ? 44 : 52;
        const flagFontSize = compact ? 10 : 11;

        // Joystick: bottom-left
        const jsX = margin + baseR;
        const jsY = H - margin - baseR;
        this.joystickBase.setPosition(jsX, jsY).setSize(baseR * 2, baseR * 2);
        if (!this.joystickState.active) {
            this.joystickThumb.setPosition(jsX, jsY);
        }
        this.joystickThumb.setSize(thumbR * 2, thumbR * 2);
        this.joystickHitArea = new Phaser.Geom.Circle(jsX, jsY, baseR + 14);

        // FLAG button: bottom-right
        const flagX = W - margin - flagSize / 2;
        const flagY = H - margin - flagSize / 2;
        this.flagBg.setPosition(flagX, flagY).setSize(flagSize, flagSize);
        this.flagLabel.setPosition(flagX, flagY).setFontSize(flagFontSize);
        this.flagHitArea = new Phaser.Geom.Circle(flagX, flagY, flagSize / 2 + 10);

        const stageW = compact ? 82 : 90;
        const stageH = compact ? 30 : 34;
        const stageX = W - margin - stageW / 2;
        const stageY = margin + stageH / 2;
        this.stageSelectBg.setPosition(stageX, stageY).setSize(stageW, stageH);
        this.stageSelectLabel.setPosition(stageX, stageY).setFontSize(compact ? 11 : 12);
        this.stageSelectHitArea = new Phaser.Geom.Rectangle(stageX - stageW / 2, stageY - stageH / 2, stageW, stageH);
    }

    private promptAndStartStage (): void
    {
        const current = Math.min(this.stageData?.stageNo ?? 1, STAGE_MAX);
        const answer = parseStagePrompt(window.prompt(`Start stage number (1-${STAGE_MAX})`, String(current)));
        if (answer.kind === 'cancel') {
            return;
        }
        if (answer.kind === 'invalid') {
            this.refreshHud(`Invalid stage (1-${STAGE_MAX})`);
            return;
        }

        const selected = answer.stage;
        this.hideRestartButtons();
        this.discardPointerState();
        this.time.removeAllEvents();
        this.startStage(selected);
        safeSetItem(this.store, START_STAGE_KEY, String(selected));
        this.refreshHud(`Jumped to stage ${selected}`);
    }

    private updateJoystickThumb (px: number, py: number): void
    {
        if (!this.joystickBase || !this.joystickThumb) {
            return;
        }
        const baseR = this.joystickBase.width / 2;
        const maxR = baseR - this.joystickThumb.width / 2 - 2;
        const dx = px - this.joystickBase.x;
        const dy = py - this.joystickBase.y;
        const dist = Math.hypot(dx, dy);
        const ratio = dist > 0 ? Math.min(1, maxR / dist) : 0;
        this.joystickThumb.setPosition(
            this.joystickBase.x + dx * ratio,
            this.joystickBase.y + dy * ratio
        );

        // Repeat input when stick is held in a direction
        if (dist >= JOYSTICK_TAP_THRESHOLD) {
            const deg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
            const sector = Math.round(deg / 45) % 8;
            const dir = JOYSTICK_DIRS[sector];
            const dirChanged = !this.joystickCurrentDir ||
                this.joystickCurrentDir.x !== dir.x ||
                this.joystickCurrentDir.y !== dir.y;
            if (dirChanged) {
                this.joystickCurrentDir = dir;
                this.cancelJoystickRepeat();
                this.joystickRepeatEvent = this.time.addEvent({
                    delay: JOYSTICK_REPEAT_DELAY,
                    callback: () => {
                        this.fireJoystickDirection();
                        if (!this.joystickCurrentDir || !this.flow.playing) {
                            // The first repeat step ended the stage (death / goal) and released the pad.
                            return;
                        }
                        this.joystickRepeatEvent = this.time.addEvent({
                            delay: JOYSTICK_REPEAT_INTERVAL,
                            callback: this.fireJoystickDirection,
                            callbackScope: this,
                            loop: true
                        });
                    },
                    callbackScope: this
                });
            }
        } else {
            this.cancelJoystickRepeat();
            this.joystickCurrentDir = undefined;
        }
    }

    private fireJoystickDirection (): void
    {
        if (!this.joystickCurrentDir || !this.flow.playing) {
            return;
        }
        this.joystickHasFired = true;
        this.applyDirectionInput(this.joystickCurrentDir, this.flagMode, 'virtual-joystick');
    }

    private cancelJoystickRepeat (): void
    {
        this.joystickRepeatEvent?.remove(false);
        this.joystickRepeatEvent = undefined;
    }

    /** Death, goal and the STAGE jump: forget every press and the pad, so nothing acts on a later release. */
    private discardPointerState (): void
    {
        this.presses.clear();
        this.resetJoystickThumb();
        this.dragState.active = false;
    }

    private resetJoystickThumb (): void
    {
        this.cancelJoystickRepeat();
        this.joystickCurrentDir = undefined;
        this.joystickHasFired = false;
        this.joystickState = { active: false, pointerId: -1, startX: 0, startY: 0 };
        if (this.joystickBase && this.joystickThumb) {
            this.joystickThumb.setPosition(this.joystickBase.x, this.joystickBase.y);
        }
    }

    private resolveJoystick (upX: number, upY: number): void
    {
        if (!this.flow.playing || this.time.now < this.inputLockUntil) {
            return;
        }

        // Already moved via repeat: don't fire again on release
        if (this.joystickHasFired) {
            return;
        }

        const dx = upX - this.joystickState.startX;
        const dy = upY - this.joystickState.startY;
        const dist = Math.hypot(dx, dy);

        if (dist < JOYSTICK_TAP_THRESHOLD) {
            // Tap → Chord
            const out = chordAtPlayer(this.stageData);
            if (out.result.status === 'alive' && out.stage === this.stageData) {
                this.refreshHud(out.result.message ?? 'chord');
                return;
            }
            this.applyResult(out.stage, out.result.status, out.result.message ?? 'chord', out.changedCellIndices);
            return;
        }

        // Short drag released before first repeat: fire once
        const deg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
        const sector = Math.round(deg / 45) % 8;
        this.applyDirectionInput(JOYSTICK_DIRS[sector], this.flagMode, 'virtual-joystick');
    }

    private refreshHud (message: string): void
    {
        const score = this.stageData.stageNo - 1;
        const highscore = currentHighScore(this.store, HIGHSCORE_KEY, sessionBest);
        this.hudText.setText(`Stage ${this.stageData.stageNo}  Score ${score}  High ${highscore}`);
        this.hintText.setText(
            `${message} | Move: arrows/QWEA-XZDC/numpad  Flag: Shift+dir  Chord: S/Num5  Mobile: virtual pad`
        );

        if (import.meta.env.DEV) {
            // QA only: a read-only view of the state (never part of the production bundle).
            const flow = this.flow;
            const stage = this.stageData;
            (window as unknown as { __qa?: unknown }).__qa = {
                get phase () { return flow.phase; },
                stage: stage.stageNo,
                width: stage.width,
                height: stage.height,
                player: { x: stage.player.x, y: stage.player.y },
                goal: { x: stage.goal.x, y: stage.goal.y },
                bombs: stage.cells.map((cell) => cell.hasBomb)
            };
        }
    }

    private revealAllBombs (): void
    {
        for (const cell of this.stageData.cells) {
            if (cell.hasBomb) {
                cell.revealed = true;
            }
        }
    }

    private centerCameraOnPlayer (force = false): void
    {
        const px = BOARD_ORIGIN_X + this.stageData.player.x * CELL_SIZE + CELL_SIZE / 2;
        const py = BOARD_ORIGIN_Y + this.stageData.player.y * CELL_SIZE + CELL_SIZE / 2;

        if (!force) {
            const margin = CAMERA_FOLLOW_MARGIN_CELLS * CELL_SIZE;
            const left = this.camera.scrollX + margin;
            const top = this.camera.scrollY + margin;
            const right = this.camera.scrollX + this.camera.width - margin;
            const bottom = this.camera.scrollY + this.camera.height - margin;
            if (px >= left && px <= right && py >= top && py <= bottom) {
                this.updateGoalArrow();
                return;
            }
        }

        const halfW = this.camera.width / 2;
        const halfH = this.camera.height / 2;
        const minX = halfW;
        const minY = halfH;
        const maxX = Math.max(halfW, this.cameraBoundsWidth - halfW);
        const maxY = Math.max(halfH, this.cameraBoundsHeight - halfH);
        const clampedX = Math.min(maxX, Math.max(minX, px));
        const clampedY = Math.min(maxY, Math.max(minY, py));

        this.camera.centerOn(clampedX, clampedY);
        this.updateGoalArrow();
    }

    private updateGoalArrow (): void
    {
        if (!this.stageData) {
            return;
        }

        const goal = this.stageData.goal;
        const gx = BOARD_ORIGIN_X + goal.x * CELL_SIZE + CELL_SIZE / 2;
        const gy = BOARD_ORIGIN_Y + goal.y * CELL_SIZE + CELL_SIZE / 2;

        const camLeft = this.camera.scrollX;
        const camTop = this.camera.scrollY;
        const camRight = camLeft + this.camera.width;
        const camBottom = camTop + this.camera.height;

        const visible = gx >= camLeft && gx <= camRight && gy >= camTop && gy <= camBottom;
        if (visible) {
            this.goalArrow.setText('');
            return;
        }

        const PAD = 30;
        const screenW = this.camera.width;
        const screenH = this.camera.height;

        // Direction from screen center to goal in screen-space
        const goalScreenX = gx - camLeft;
        const goalScreenY = gy - camTop;
        const dx = goalScreenX - screenW / 2;
        const dy = goalScreenY - screenH / 2;

        // Arrow character: atan2(dy, dx), 0° = right
        const angle = Math.atan2(dy, dx);
        const deg = ((angle * 180 / Math.PI) + 360) % 360;
        const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
        const arrow = ARROWS[Math.round(deg / 45) % 8];

        // Intersect ray from screen center toward goal with screen border
        const tx = dx !== 0
            ? (dx > 0 ? (screenW - PAD - screenW / 2) / dx : (PAD - screenW / 2) / dx)
            : Infinity;
        const ty = dy !== 0
            ? (dy > 0 ? (screenH - PAD - screenH / 2) / dy : (PAD - screenH / 2) / dy)
            : Infinity;
        const t = Math.min(tx, ty);

        const edgeX = Math.min(screenW - PAD, Math.max(PAD, screenW / 2 + dx * t));
        const edgeY = Math.min(screenH - PAD, Math.max(PAD, screenH / 2 + dy * t));

        this.goalArrow.setText(`GOAL ${arrow}`);
        this.goalArrow.setPosition(edgeX, edgeY).setOrigin(0.5);
    }

    private onKeyDown (event: KeyboardEvent): void
    {
        if (this.flow.awaitingRestart) {
            const action = restartKeyAction(event.code, event.repeat);
            if (action !== 'none') {
                this.doRestart(action);
            }
            return;
        }

        if (!this.flow.playing) {
            return;
        }

        if (event.repeat || this.time.now < this.inputLockUntil) {
            return;
        }

        const direction = this.mapDirection(event.code);
        if (!direction) {
            if (event.code === 'KeyS' || event.code === 'Numpad5') {
                const out = chordAtPlayer(this.stageData);
                if (out.result.status === 'alive' && out.stage === this.stageData) {
                    this.refreshHud(out.result.message ?? 'chord');
                    return;
                }
                this.applyResult(out.stage, out.result.status, out.result.message ?? 'chord', out.changedCellIndices);
            }
            return;
        }

        this.applyDirectionInput(direction, event.shiftKey, 'keyboard');
    }

    private applyDirectionInput (direction: Position, asFlag: boolean, moveSource: string): void
    {
        if (asFlag) {
            const target = {
                x: this.stageData.player.x + direction.x,
                y: this.stageData.player.y + direction.y
            };
            const nextStage = toggleFlag(this.stageData, target);
            const changedCellIndices = nextStage === this.stageData ? [] : [indexOf(this.stageData, target)];
            this.applyResult(nextStage, 'alive', 'Flag toggled', changedCellIndices);
            return;
        }

        const out = moveByDelta(this.stageData, direction.x, direction.y);
        this.applyResult(out.stage, out.result.status, out.result.message ?? moveSource, out.changedCellIndices);
    }

    private mapDirection (code: string): Position | null
    {
        const mapping: Record<string, Position> = {
            ArrowUp: { x: 0, y: -1 },
            ArrowDown: { x: 0, y: 1 },
            ArrowLeft: { x: -1, y: 0 },
            ArrowRight: { x: 1, y: 0 },
            KeyW: { x: 0, y: -1 },
            KeyX: { x: 0, y: 1 },
            KeyA: { x: -1, y: 0 },
            KeyD: { x: 1, y: 0 },
            KeyQ: { x: -1, y: -1 },
            KeyE: { x: 1, y: -1 },
            KeyZ: { x: -1, y: 1 },
            KeyC: { x: 1, y: 1 },
            Numpad8: { x: 0, y: -1 },
            Numpad2: { x: 0, y: 1 },
            Numpad4: { x: -1, y: 0 },
            Numpad6: { x: 1, y: 0 },
            Numpad7: { x: -1, y: -1 },
            Numpad9: { x: 1, y: -1 },
            Numpad1: { x: -1, y: 1 },
            Numpad3: { x: 1, y: 1 }
        };

        return mapping[code] ?? null;
    }

    private hasVisibleStageChange (prevStage: Stage, nextStage: Stage, changedCellIndices?: number[]): boolean
    {
        if (prevStage === nextStage) {
            return false;
        }

        if (
            prevStage.stageNo !== nextStage.stageNo ||
            prevStage.width !== nextStage.width ||
            prevStage.height !== nextStage.height ||
            prevStage.start.x !== nextStage.start.x ||
            prevStage.start.y !== nextStage.start.y ||
            prevStage.goal.x !== nextStage.goal.x ||
            prevStage.goal.y !== nextStage.goal.y
        ) {
            return true;
        }

        if (changedCellIndices != null) {
            return changedCellIndices.length > 0;
        }

        if (prevStage.cells === nextStage.cells) {
            return false;
        }

        const len = prevStage.cells.length;
        if (len !== nextStage.cells.length) {
            return true;
        }

        for (let i = 0; i < len; i += 1) {
            const prev = prevStage.cells[i];
            const next = nextStage.cells[i];
            if (prev.revealed !== next.revealed || prev.flagged !== next.flagged) {
                return true;
            }
        }

        return false;
    }

    private applyResult (
        nextStage: Stage,
        status: 'alive' | 'dead' | 'goal',
        message: string,
        changedCellIndices?: number[]
    ): void
    {
        if (!this.flow.playing) {
            return;
        }

        const prevStage = this.stageData;
        const hasVisibleChange = this.hasVisibleStageChange(prevStage, nextStage, changedCellIndices);
        const useDiffRender = status === 'alive' && hasVisibleChange && this.view.canDiff(prevStage, nextStage, this.gameOverLogical);
        this.stageData = nextStage;

        if (status === 'goal') {
            this.renderBoard();
        } else if (status === 'alive' && useDiffRender) {
            const changedIndices = changedCellIndices ?? this.collectChangedCellIndices(prevStage, nextStage);
            this.view.renderChanged(this.stageData, changedIndices, this.gameOverLogical);
        } else if (status === 'alive' && hasVisibleChange) {
            this.renderBoard();
        }

        this.view.updatePlayer(this.stageData);
        this.centerCameraOnPlayer();

        if (status === 'dead') {
            this.flow.die();
            this.discardPointerState();
            this.gameOverStageNo = this.stageData.stageNo;
            recordScore(this.store, HIGHSCORE_KEY, sessionBest, this.stageData.stageNo - 1);
            this.gameOverLogical = analyzeCurrentState(this.stageData);
            this.revealAllBombs();
            this.renderBoard();
            this.centerCameraOnPlayer(true);
            this.refreshHud('You died | 橙: 論理確定爆弾  緑: 論理確定安全  紫: 誤フラグ | R = 同じステージ再挑戦 / T = タイトルへ / 他のキーかボタンで新ゲーム');
            this.time.delayedCall(DEATH_DELAY_MS, () => {
                if (this.flow.showRestart()) {
                    this.showRestartButtons();
                }
            });
            return;
        }

        if (status === 'goal') {
            this.flow.reachGoal();
            this.discardPointerState();
            this.refreshHud('Stage clear');
            this.time.delayedCall(CLEAR_DELAY_MS, () => this.startStage(this.stageData.stageNo + 1));
            return;
        }

        this.refreshHud(message);
    }

    private showRestartButtons (): void
    {
        const layout = restartButtonLayout(this.camera.width, this.camera.height);
        this.restartLayout = layout;
        this.restartButtons = {
            retry: this.makeRestartButton(layout.retry, 'RETRY [R]', 0x1e3a5f, 0x60a5fa, '#93c5fd'),
            newGame: this.makeRestartButton(layout.newGame, 'NEW GAME', 0x1a1a2e, 0x6b7280, '#9ca3af'),
            title: this.makeRestartButton(layout.title, 'TITLE [T]', 0x1a1a2e, 0x6b7280, '#9ca3af')
        };
    }

    /**
     * Moves the shown game-over buttons for the new screen size; does nothing while they are not shown
     * (before `DeathDelay` ends, or after they were taken away).
     */
    private relayoutRestartButtons (width: number, height: number): void
    {
        const buttons = this.restartButtons;
        if (!buttons) {
            return;
        }
        const layout = restartButtonLayout(width, height);
        this.restartLayout = layout;
        for (const key of ['retry', 'newGame', 'title'] as const) {
            buttons[key].bg.setPosition(layout[key].x, layout[key].y);
            buttons[key].label.setPosition(layout[key].x, layout[key].y);
        }
    }

    private makeRestartButton (
        box: ButtonBox, text: string, fill: number, stroke: number, color: string
    ): { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }
    {
        const bg = this.add.rectangle(box.x, box.y, box.width, box.height, fill, 0.95)
            .setStrokeStyle(2, stroke)
            .setScrollFactor(0).setDepth(50).setOrigin(0.5, 0.5);
        const label = this.add.text(box.x, box.y, text, {
            fontFamily: 'monospace', fontSize: 15, fontStyle: 'bold', color
        }).setScrollFactor(0).setDepth(51).setOrigin(0.5, 0.5);
        return { bg, label };
    }

    private hideRestartButtons (): void
    {
        if (this.restartButtons) {
            for (const { bg, label } of Object.values(this.restartButtons)) {
                bg.destroy();
                label.destroy();
            }
        }
        this.restartButtons = undefined;
        this.restartLayout = undefined;
    }

    private doRestart (choice: RestartChoice): void
    {
        if (!this.flow.beginRestart()) {
            return;
        }
        this.hideRestartButtons();
        if (choice === 'retry') {
            this.startStage(this.gameOverStageNo);
        } else if (choice === 'title') {
            this.scene.start('Title');
        } else {
            this.scene.start('Game');
        }
    }

    private onPointerDown (pointer: Phaser.Input.Pointer): void
    {
        if (this.stageSelectHitArea && Phaser.Geom.Rectangle.Contains(this.stageSelectHitArea, pointer.x, pointer.y)) {
            this.presses.begin(pointer.id, 'button');
            this.promptAndStartStage();
            return;
        }

        if (this.flow.awaitingRestart) {
            // Only a press that starts after the buttons appeared can pick one.
            this.presses.begin(pointer.id, 'restart');
            return;
        }

        if (!this.flow.playing) {
            return;
        }

        // FLAG button
        if (this.flagHitArea && Phaser.Geom.Circle.Contains(this.flagHitArea, pointer.x, pointer.y)) {
            this.presses.begin(pointer.id, 'button');
            this.flagMode = !this.flagMode;
            this.updateFlagButtonVisual();
            this.refreshHud(this.flagMode ? 'Flag mode ON' : 'Flag mode OFF');
            return;
        }

        // Joystick area
        if (this.joystickHitArea && Phaser.Geom.Circle.Contains(this.joystickHitArea, pointer.x, pointer.y)) {
            this.presses.begin(pointer.id, 'pad');
            this.joystickState = {
                active: true,
                pointerId: pointer.id,
                startX: pointer.x,
                startY: pointer.y
            };
            this.updateJoystickThumb(pointer.x, pointer.y);
            return;
        }

        this.presses.begin(pointer.id, 'board');
        this.dragState = {
            active: false,
            startX: pointer.x,
            startY: pointer.y,
            lastX: pointer.x,
            lastY: pointer.y
        };
    }

    private onPointerMove (pointer: Phaser.Input.Pointer): void
    {
        if (!this.flow.playing) {
            return;
        }

        // Update joystick thumb
        if (this.joystickState.active && pointer.id === this.joystickState.pointerId) {
            if (pointer.isDown) {
                this.updateJoystickThumb(pointer.x, pointer.y);
            }
            return;
        }

        // Only a press accepted on the board may scroll (a finger held across a death / goal / jump may not).
        if (!pointer.isDown || !this.presses.holds(pointer.id, 'board')) {
            return;
        }

        const dxFromStart = pointer.x - this.dragState.startX;
        const dyFromStart = pointer.y - this.dragState.startY;
        const distance = Math.hypot(dxFromStart, dyFromStart);

        if (!this.dragState.active && distance >= SCROLL_THRESHOLD) {
            this.dragState.active = true;
        }

        if (this.dragState.active) {
            const dx = pointer.x - this.dragState.lastX;
            const dy = pointer.y - this.dragState.lastY;
            this.camera.scrollX -= dx;
            this.camera.scrollY -= dy;
            this.updateGoalArrow();
        }

        this.dragState.lastX = pointer.x;
        this.dragState.lastY = pointer.y;
    }

    private onPointerUp (pointer: Phaser.Input.Pointer): void
    {
        if (pointer.wasCanceled) {
            // A touch the system cancelled never acts: drop what it started.
            const ownsDrag = this.presses.holds(pointer.id, 'board');
            this.presses.cancel(pointer.id);
            if (this.joystickState.active && pointer.id === this.joystickState.pointerId) {
                this.resetJoystickThumb();
            }
            if (ownsDrag) {
                this.dragState.active = false;
            }
            return;
        }

        const press = this.presses.end(pointer.id);
        if (press === null) {
            return;
        }

        if (press === 'restart') {
            if (!this.flow.awaitingRestart) {
                return;
            }
            // The release position chooses: TITLE, RETRY, or (anywhere else, NEW GAME included) a new game.
            if (this.restartLayout) {
                this.doRestart(restartButtonAt(this.restartLayout, pointer.x, pointer.y));
            }
            return;
        }

        if (!this.flow.playing) {
            return;
        }

        // Resolve joystick
        if (press === 'pad') {
            if (this.joystickState.active && pointer.id === this.joystickState.pointerId) {
                this.resolveJoystick(pointer.x, pointer.y);
                this.resetJoystickThumb();
            }
            return;
        }

        if (this.dragState.active) {
            this.inputLockUntil = this.time.now + INPUT_LOCK_MS;
            return;
        }

        if (this.time.now < this.inputLockUntil) {
            return;
        }

        const world = pointer.positionToCamera(this.camera) as Phaser.Math.Vector2;
        const gx = Math.floor((world.x - BOARD_ORIGIN_X) / CELL_SIZE);
        const gy = Math.floor((world.y - BOARD_ORIGIN_Y) / CELL_SIZE);
        const target = { x: gx, y: gy };

        if (!inBounds(this.stageData, target)) {
            return;
        }

        const dx = Math.abs(target.x - this.stageData.player.x);
        const dy = Math.abs(target.y - this.stageData.player.y);
        if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
            return;
        }

        const out = movePlayer(this.stageData, target);
        this.applyResult(out.stage, out.result.status, out.result.message ?? 'tap-move', out.changedCellIndices);
    }
}
