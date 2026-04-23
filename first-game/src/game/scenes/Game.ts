import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { generateStage } from '../core/generator';
import { moveByDelta, chordAtPlayer, movePlayer, toggleFlag } from '../core/rules';
import { inBounds } from '../core/board';
import type { Position, Stage } from '../core/types';

const CELL_SIZE = 30;
const BOARD_ORIGIN_X = 20;
const BOARD_ORIGIN_Y = 80;
const SCROLL_THRESHOLD = 8;
const INPUT_LOCK_MS = 100;
const HIGHSCORE_KEY = 'minefield-rogue-highscore';
const CONTROL_BUTTON_SIZE = 46;
const CONTROL_GAP = 8;

const HINT_COLORS: Record<number, string> = {
    1: '#4da3ff',
    2: '#7bed9f',
    3: '#ff6b81',
    4: '#70a1ff',
    5: '#ff9f43',
    6: '#34e7e4',
    7: '#f1f2f6',
    8: '#ced6e0'
};

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
    boardLayer?: Phaser.GameObjects.Container;
    hudText!: Phaser.GameObjects.Text;
    hintText!: Phaser.GameObjects.Text;
    goalArrow!: Phaser.GameObjects.Text;
    stageData!: Stage;
    cameraBoundsWidth = 0;
    cameraBoundsHeight = 0;
    inputLockUntil = 0;
    isEnding = false;
    dragState: DragState = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
    virtualControlLayer?: Phaser.GameObjects.Container;
    virtualControlHitAreas: Phaser.Geom.Circle[] = [];
    virtualControlPointerIds = new Set<number>();
    flagMode = false;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x0a1f2f);

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

        this.startStage(1);
        this.createVirtualControls();

        this.input.keyboard?.on('keydown', this.onKeyDown, this);
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);
        this.scale.on('resize', this.onResize, this);

        this.events.on('shutdown', () => {
            this.input.keyboard?.off('keydown', this.onKeyDown, this);
            this.input.off('pointerdown', this.onPointerDown, this);
            this.input.off('pointermove', this.onPointerMove, this);
            this.input.off('pointerup', this.onPointerUp, this);
            this.scale.off('resize', this.onResize, this);
            this.virtualControlLayer?.destroy(true);
            this.virtualControlLayer = undefined;
            this.virtualControlHitAreas = [];
            this.virtualControlPointerIds.clear();
        });
    }

    private startStage (stageNo: number): void
    {
        this.stageData = generateStage(stageNo);
        this.renderBoard();
        this.refreshHud('Stage start');
        this.centerCameraOnPlayer();
    }

    private renderBoard (): void
    {
        this.boardLayer?.destroy(true);
        this.boardLayer = this.add.container(0, 0);

        for (let y = 0; y < this.stageData.height; y += 1) {
            for (let x = 0; x < this.stageData.width; x += 1) {
                const idx = y * this.stageData.width + x;
                const cell = this.stageData.cells[idx];
                const px = BOARD_ORIGIN_X + x * CELL_SIZE;
                const py = BOARD_ORIGIN_Y + y * CELL_SIZE;

                const fill = this.cellFillColor(x, y, cell);
                const rect = this.add.rectangle(px, py, CELL_SIZE - 2, CELL_SIZE - 2, fill).setOrigin(0);
                this.boardLayer.add(rect);

                if (cell.hasBomb && cell.revealed) {
                    const bomb = this.add.text(
                        px + CELL_SIZE / 2,
                        py + CELL_SIZE / 2,
                        '*',
                        {
                            fontFamily: 'monospace',
                            fontSize: 20,
                            fontStyle: 'bold',
                            color: '#ff3b30',
                            stroke: '#0b1220',
                            strokeThickness: 3
                        }
                    ).setOrigin(0.5);
                    this.boardLayer.add(bomb);
                }

                if (!cell.hasBomb && cell.revealed) {
                    const text = this.add.text(
                        px + CELL_SIZE / 2,
                        py + CELL_SIZE / 2,
                        cell.hint === 0 ? '' : String(cell.hint),
                        {
                            fontFamily: 'monospace',
                            fontSize: 16,
                            fontStyle: 'bold',
                            color: this.hintColor(cell.hint),
                            stroke: '#0b1220',
                            strokeThickness: 3
                        }
                    ).setOrigin(0.5);
                    this.boardLayer.add(text);
                }

                if (cell.flagged) {
                    const flag = this.add.text(px + 5, py + 3, 'F', {
                        fontFamily: 'monospace',
                        fontSize: 16,
                        color: '#ff4757'
                    });
                    this.boardLayer.add(flag);
                }
            }
        }

        this.drawEdgeMarker(this.stageData.start, 0x7bed9f);
        this.drawEdgeMarker(this.stageData.goal, 0xffa502);
        this.drawMarker(this.stageData.player, '@', '#ffffff', -9, -8, 12);

        this.updateCameraBounds();
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
        this.centerCameraOnPlayer();
        this.updateGoalArrow();
        this.layoutVirtualControls();
    }

    private createVirtualControls (): void
    {
        this.virtualControlLayer?.destroy(true);
        this.virtualControlLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(30);
        this.virtualControlHitAreas = [];

        const dpadCenterX = 90;
        const dpadCenterY = this.camera.height - 108;
        const rightCenterX = this.camera.width - 90;
        const rightCenterY = this.camera.height - 108;

        const dpadButtons: Array<{ label: string; dx: number; dy: number; ox: number; oy: number }> = [
            { label: '↖', dx: -1, dy: -1, ox: -1, oy: -1 },
            { label: '↑', dx: 0, dy: -1, ox: 0, oy: -1 },
            { label: '↗', dx: 1, dy: -1, ox: 1, oy: -1 },
            { label: '←', dx: -1, dy: 0, ox: -1, oy: 0 },
            { label: '→', dx: 1, dy: 0, ox: 1, oy: 0 },
            { label: '↙', dx: -1, dy: 1, ox: -1, oy: 1 },
            { label: '↓', dx: 0, dy: 1, ox: 0, oy: 1 },
            { label: '↘', dx: 1, dy: 1, ox: 1, oy: 1 }
        ];

        for (const btn of dpadButtons) {
            const x = dpadCenterX + btn.ox * (CONTROL_BUTTON_SIZE + CONTROL_GAP);
            const y = dpadCenterY + btn.oy * (CONTROL_BUTTON_SIZE + CONTROL_GAP);
            this.addControlButton(x, y, CONTROL_BUTTON_SIZE, btn.label, (pointer) => {
                this.virtualControlPointerIds.add(pointer.id);
                this.applyDirectionInput({ x: btn.dx, y: btn.dy }, this.flagMode, 'virtual-control');
            });
        }

        const flagButton = this.addControlButton(rightCenterX, rightCenterY - 34, 58, '', () => {
            this.flagMode = !this.flagMode;
            this.updateFlagButtonText(flagButton.label);
            this.refreshHud(this.flagMode ? 'Flag mode ON' : 'Flag mode OFF');
        });

        this.updateFlagButtonText(flagButton.label);

        this.addControlButton(rightCenterX, rightCenterY + 40, 62, 'CHORD', (pointer) => {
            this.virtualControlPointerIds.add(pointer.id);
            const out = chordAtPlayer(this.stageData);
            this.applyResult(out.stage, out.result.status, out.result.message ?? 'chord');
        });

        this.layoutVirtualControls();
    }

    private updateFlagButtonText (label: Phaser.GameObjects.Text): void
    {
        label.setText(this.flagMode ? 'FLAG ON' : 'FLAG OFF');
        label.setColor(this.flagMode ? '#7bed9f' : '#f1f2f6');
    }

    private layoutVirtualControls (): void
    {
        if (!this.virtualControlLayer) {
            return;
        }

        this.virtualControlHitAreas = [];

        const children = this.virtualControlLayer.list;
        for (let idx = 0; idx < children.length; idx += 2) {
            const bg = children[idx];
            if (!(bg instanceof Phaser.GameObjects.Ellipse)) {
                continue;
            }
            this.virtualControlHitAreas.push(new Phaser.Geom.Circle(bg.x, bg.y, bg.width / 2 + 6));
        }

        const margin = 24;
        const leftBaseX = 90;
        const rightBaseX = this.camera.width - 90;
        const baseY = this.camera.height - 108;

        let dpadIdx = 0;
        let actionIdx = 0;

        for (let i = 0; i < children.length; i += 2) {
            const bg = children[i];
            const label = children[i + 1];
            if (!(bg instanceof Phaser.GameObjects.Ellipse) || !(label instanceof Phaser.GameObjects.Text)) {
                continue;
            }

            if (label.text === 'CHORD' || label.text.startsWith('FLAG')) {
                const y = actionIdx === 0 ? baseY - 34 : baseY + 40;
                bg.setPosition(Math.max(margin + bg.width / 2, rightBaseX), y);
                label.setPosition(bg.x, bg.y);
                actionIdx += 1;
                continue;
            }

            const offsets = [
                { ox: -1, oy: -1 },
                { ox: 0, oy: -1 },
                { ox: 1, oy: -1 },
                { ox: -1, oy: 0 },
                { ox: 1, oy: 0 },
                { ox: -1, oy: 1 },
                { ox: 0, oy: 1 },
                { ox: 1, oy: 1 }
            ];
            const offset = offsets[dpadIdx];
            const x = Math.max(margin + bg.width / 2, leftBaseX + offset.ox * (CONTROL_BUTTON_SIZE + CONTROL_GAP));
            const y = baseY + offset.oy * (CONTROL_BUTTON_SIZE + CONTROL_GAP);
            bg.setPosition(x, y);
            label.setPosition(x, y);
            dpadIdx += 1;
        }

        this.virtualControlHitAreas = [];
        for (let idx = 0; idx < children.length; idx += 2) {
            const bg = children[idx];
            if (!(bg instanceof Phaser.GameObjects.Ellipse)) {
                continue;
            }
            this.virtualControlHitAreas.push(new Phaser.Geom.Circle(bg.x, bg.y, bg.width / 2 + 6));
        }
    }

    private addControlButton (
        x: number,
        y: number,
        size: number,
        labelText: string,
        onPress: (pointer: Phaser.Input.Pointer) => void
    ): { bg: Phaser.GameObjects.Ellipse; label: Phaser.GameObjects.Text }
    {
        const bg = this.add.ellipse(x, y, size, size, 0x111827, 0.72)
            .setStrokeStyle(2, 0x60a5fa, 0.9)
            .setScrollFactor(0)
            .setDepth(31)
            .setInteractive({ useHandCursor: false });

        const label = this.add.text(x, y, labelText, {
            fontFamily: 'monospace',
            fontSize: size >= 60 ? 12 : 22,
            fontStyle: 'bold',
            color: '#f1f2f6'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

        bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.isEnding || this.time.now < this.inputLockUntil) {
                return;
            }
            onPress(pointer);
            bg.setFillStyle(0x1f2937, 0.95);
        });

        const release = (pointer: Phaser.Input.Pointer) => {
            this.virtualControlPointerIds.delete(pointer.id);
            bg.setFillStyle(0x111827, 0.72);
        };
        bg.on('pointerup', release);
        bg.on('pointerout', release);

        this.virtualControlLayer?.add(bg);
        this.virtualControlLayer?.add(label);

        return { bg, label };
    }

    private drawMarker (
        pos: Position,
        label: string,
        color: string,
        offsetX = 0,
        offsetY = 0,
        fontSize = 16
    ): void
    {
        const px = BOARD_ORIGIN_X + pos.x * CELL_SIZE + CELL_SIZE / 2 + offsetX;
        const py = BOARD_ORIGIN_Y + pos.y * CELL_SIZE + CELL_SIZE / 2 + offsetY;
        const text = this.add.text(px, py, label, {
            fontFamily: 'monospace',
            fontSize,
            color
        }).setOrigin(0.5);
        this.boardLayer?.add(text);
    }

    private drawEdgeMarker (pos: Position, color: number): void
    {
        let px = BOARD_ORIGIN_X + pos.x * CELL_SIZE;
        let py = BOARD_ORIGIN_Y + pos.y * CELL_SIZE;
        let markerWidth: number;
        let markerHeight: number;

        if (pos.y === 0) {
            markerWidth = CELL_SIZE - 2;
            markerHeight = Math.max(8, Math.floor(CELL_SIZE * 0.35));
            py = BOARD_ORIGIN_Y - markerHeight;
        } else if (pos.y === this.stageData.height - 1) {
            markerWidth = CELL_SIZE - 2;
            markerHeight = Math.max(8, Math.floor(CELL_SIZE * 0.35));
            py = BOARD_ORIGIN_Y + this.stageData.height * CELL_SIZE;
        } else if (pos.x === 0) {
            markerWidth = Math.max(8, Math.floor(CELL_SIZE * 0.35));
            markerHeight = CELL_SIZE - 2;
            px = BOARD_ORIGIN_X - markerWidth;
        } else {
            markerWidth = Math.max(8, Math.floor(CELL_SIZE * 0.35));
            markerHeight = CELL_SIZE - 2;
            px = BOARD_ORIGIN_X + this.stageData.width * CELL_SIZE;
        }

        const marker = this.add.rectangle(px, py, markerWidth, markerHeight, color)
            .setOrigin(0)
            .setStrokeStyle(2, 0xf1f2f6);

        this.boardLayer?.add(marker);
    }

    private cellFillColor (x: number, y: number, cell: Stage['cells'][number]): number
    {
        const isPlayer = this.stageData.player.x === x && this.stageData.player.y === y;
        if (isPlayer) {
            return 0x57606f;
        }
        if (cell.revealed) {
            return 0x2f3542;
        }
        return 0x1e272e;
    }

    private hintColor (hint: number): string
    {
        return HINT_COLORS[hint] ?? '#ffffff';
    }

    private refreshHud (message: string): void
    {
        const score = this.stageData.stageNo - 1;
        const highscore = Number(localStorage.getItem(HIGHSCORE_KEY) ?? '0');
        this.hudText.setText(`Stage ${this.stageData.stageNo}  Score ${score}  High ${highscore}`);
        this.hintText.setText(
            `${message} | Move: arrows/QWEA-XZDC/numpad  Flag: Shift+dir  Chord: S/Num5  Mobile: virtual pad`
        );
    }

    private revealAllBombs (): void
    {
        for (const cell of this.stageData.cells) {
            if (cell.hasBomb) {
                cell.revealed = true;
            }
        }
    }

    private centerCameraOnPlayer (): void
    {
        const px = BOARD_ORIGIN_X + this.stageData.player.x * CELL_SIZE + CELL_SIZE / 2;
        const py = BOARD_ORIGIN_Y + this.stageData.player.y * CELL_SIZE + CELL_SIZE / 2;
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
        if (this.isEnding) {
            return;
        }

        if (event.repeat || this.time.now < this.inputLockUntil) {
            return;
        }

        const direction = this.mapDirection(event.code);
        if (!direction) {
            if (event.code === 'KeyS' || event.code === 'Numpad5') {
                const out = chordAtPlayer(this.stageData);
                this.applyResult(out.stage, out.result.status, out.result.message ?? 'chord');
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
            this.stageData = toggleFlag(this.stageData, target);
            this.renderBoard();
            this.centerCameraOnPlayer();
            this.refreshHud('Flag toggled');
            return;
        }

        const out = moveByDelta(this.stageData, direction.x, direction.y);
        this.applyResult(out.stage, out.result.status, out.result.message ?? moveSource);
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

    private applyResult (nextStage: Stage, status: 'alive' | 'dead' | 'goal', message: string): void
    {
        this.stageData = nextStage;
        this.renderBoard();
        this.centerCameraOnPlayer();

        if (status === 'dead') {
            this.isEnding = true;
            const score = this.stageData.stageNo - 1;
            const currentHigh = Number(localStorage.getItem(HIGHSCORE_KEY) ?? '0');
            if (score > currentHigh) {
                localStorage.setItem(HIGHSCORE_KEY, String(score));
            }
            this.revealAllBombs();
            this.renderBoard();
            this.centerCameraOnPlayer();
            this.refreshHud('You died | Bomb positions revealed');
            this.time.delayedCall(1200, () => {
                this.isEnding = false;
                this.scene.start('MainMenu');
            });
            return;
        }

        if (status === 'goal') {
            this.refreshHud('Stage clear');
            this.time.delayedCall(250, () => this.startStage(this.stageData.stageNo + 1));
            return;
        }

        this.refreshHud(message);
    }

    private onPointerDown (pointer: Phaser.Input.Pointer): void
    {
        if (this.isEnding) {
            return;
        }

        if (this.isVirtualControlPointer(pointer)) {
            this.virtualControlPointerIds.add(pointer.id);
            return;
        }

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
        if (this.isEnding) {
            return;
        }

        if (this.virtualControlPointerIds.has(pointer.id)) {
            return;
        }

        if (!pointer.isDown) {
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
        }

        this.dragState.lastX = pointer.x;
        this.dragState.lastY = pointer.y;
    }

    private onPointerUp (pointer: Phaser.Input.Pointer): void
    {
        if (this.isEnding) {
            return;
        }

        if (this.virtualControlPointerIds.delete(pointer.id)) {
            return;
        }

        if (this.dragState.active) {
            this.inputLockUntil = this.time.now + INPUT_LOCK_MS;
            return;
        }

        if (this.time.now < this.inputLockUntil) {
            return;
        }

        const world = pointer.positionToCamera(this.camera);
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
        this.applyResult(out.stage, out.result.status, out.result.message ?? 'tap-move');
    }

    private isVirtualControlPointer (pointer: Phaser.Input.Pointer): boolean
    {
        for (const area of this.virtualControlHitAreas) {
            if (Phaser.Geom.Circle.Contains(area, pointer.x, pointer.y)) {
                return true;
            }
        }
        return false;
    }
}
