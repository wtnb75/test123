import { Geom, Input, Scene, type GameObjects } from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    TRAY_TOP_Y,
    PLACEMENT_CENTER,
    SCORE_BUTTON_Y,
    SCORE_CANVAS_SIZE,
} from '../logic/constants';
import { PART_IDS, PART_SHAPES, PART_ANSWERS, TRAY_SLOTS, hitRadius } from '../logic/parts';
import type { DraggablePartId, GamePhase, PartTransform, Point } from '../logic/types';
import { toLocalOffset, computeDragTransform } from '../logic/dragTransform';
import { regionForY } from '../logic/regions';
import { averageChannelDiff, scoreFromAverageDiff } from '../logic/score';
import { beginPlacement, beginScoring } from '../logic/phase';
import { drawPartShape, drawFaceOnCanvas, drawFaceGroup, fillBackground, drawGrabMarker, drawHitAreaIndicator } from '../drawing';

interface DragState {
    lastPointer: Point;
    grabLocalOffset: Point;
}

export class Game extends Scene {
    private phase: GamePhase = 'reveal';
    private partContainers = new Map<DraggablePartId, GameObjects.Container>();
    private locked = new Map<DraggablePartId, boolean>();
    private activeDragId: DraggablePartId | null = null;
    private dragState: DragState | null = null;
    private depthCounter = 1;
    private grabMarker!: GameObjects.Graphics;

    constructor() {
        super('Game');
    }

    create() {
        this.cameras.main.setBackgroundColor('#eaf6ff');
        this.phase = 'reveal';
        this.partContainers.clear();
        this.locked.clear();
        this.activeDragId = null;
        this.dragState = null;
        this.grabMarker = this.add.graphics().setVisible(false);

        this.input.on('pointermove', (pointer: Input.Pointer) => this.onPointerMove(pointer));
        this.input.on('pointerup', (pointer: Input.Pointer) => this.onPointerUp(pointer));

        this.showReveal();
    }

    private showReveal() {
        const group = drawFaceGroup(this, PART_ANSWERS);
        group.setPosition(PLACEMENT_CENTER.x, PLACEMENT_CENTER.y);

        const instruction = this.add.text(GAME_WIDTH / 2, 40, 'このお手本を覚えよう', {
            color: '#333333',
            fontFamily: 'sans-serif',
            fontSize: '20px',
        }).setOrigin(0.5);

        const btnY = GAME_HEIGHT - 80;
        const startBtn = this.add.rectangle(GAME_WIDTH / 2, btnY, 220, 64, 0xffb703)
            .setInteractive({ useHandCursor: true });
        const startLabel = this.add.text(GAME_WIDTH / 2, btnY, 'はじめる', {
            color: '#3a2a1a',
            fontFamily: 'sans-serif',
            fontSize: '22px',
            fontStyle: 'bold',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const onStart = () => {
            this.phase = beginPlacement(this.phase);
            if (this.phase !== 'placement') return;
            group.destroy();
            instruction.destroy();
            startBtn.destroy();
            startLabel.destroy();
            this.showPlacement();
        };
        startBtn.on('pointerdown', onStart);
        startLabel.on('pointerdown', onStart);
    }

    private showPlacement() {
        this.add.text(GAME_WIDTH / 2, 20, '記憶を頼りにパーツを並べよう', {
            color: '#333333',
            fontFamily: 'sans-serif',
            fontSize: '16px',
        }).setOrigin(0.5);

        const divider = this.add.graphics();
        divider.lineStyle(2, 0xcccccc, 1);
        divider.lineBetween(0, TRAY_TOP_Y, GAME_WIDTH, TRAY_TOP_Y);

        // Outline is a fixed background element, not a draggable part (docs/spec.md).
        const outlineAnswer = PART_ANSWERS.outline;
        const outlineGfx = this.add.graphics();
        drawPartShape(outlineGfx, PART_SHAPES.outline);
        const outlinePart = this.add.container(
            PLACEMENT_CENTER.x + outlineAnswer.x,
            PLACEMENT_CENTER.y + outlineAnswer.y,
            [outlineGfx],
        );
        outlinePart.setRotation(outlineAnswer.rotation);

        for (const id of PART_IDS) {
            this.createPart(id);
        }

        const scoreBtn = this.add.rectangle(GAME_WIDTH / 2, SCORE_BUTTON_Y, 200, 56, 0x2a9d8f)
            .setInteractive({ useHandCursor: true });
        const scoreLabel = this.add.text(GAME_WIDTH / 2, SCORE_BUTTON_Y, '採点する', {
            color: '#ffffff',
            fontFamily: 'sans-serif',
            fontSize: '20px',
            fontStyle: 'bold',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const onScore = () => this.finishPlacement(scoreBtn, scoreLabel);
        scoreBtn.on('pointerdown', onScore);
        scoreLabel.on('pointerdown', onScore);
    }

    private createPart(id: DraggablePartId) {
        const shape = PART_SHAPES[id];
        const slot = TRAY_SLOTS[id];
        const radius = hitRadius(shape);

        // Indicator drawn first so it renders behind the part's own shape.
        const indicatorGfx = this.add.graphics();
        drawHitAreaIndicator(indicatorGfx, radius);
        const g = this.add.graphics();
        drawPartShape(g, shape);

        const container = this.add.container(slot.x, slot.y, [indicatorGfx, g]);
        container.setRotation(slot.rotation);
        container.setSize(radius * 2, radius * 2);
        // Container hit-testing offsets the callback's (x, y) by
        // (width * originX, height * originY) relative to true local
        // coordinates (Phaser's Container defaults originX/Y to 0.5), so a
        // circle meant to be centered on the container must itself be
        // defined at (radius, radius) here, not (0, 0) — otherwise every
        // hit test is off by exactly `radius` in both axes.
        container.setInteractive(
            new Geom.Circle(radius, radius, radius),
            Geom.Circle.Contains,
        );

        container.on('pointerdown', (pointer: Input.Pointer) => {
            this.activeDragId = id;
            const lastPointer = { x: pointer.x, y: pointer.y };
            const grabLocalOffset = toLocalOffset(
                lastPointer,
                { x: container.x, y: container.y },
                container.rotation,
            );
            this.dragState = { lastPointer, grabLocalOffset };
            this.depthCounter += 1;
            container.setDepth(this.depthCounter);

            container.add(this.grabMarker);
            drawGrabMarker(this.grabMarker, grabLocalOffset);
            this.grabMarker.setVisible(true);
        });

        this.partContainers.set(id, container);
        this.locked.set(id, false);
    }

    private onPointerMove(pointer: Input.Pointer) {
        if (!this.activeDragId || !this.dragState) return;
        const container = this.partContainers.get(this.activeDragId);
        if (!container) return;
        const { center, rotation } = computeDragTransform(
            this.dragState.lastPointer,
            container.rotation,
            this.dragState.grabLocalOffset,
            { x: pointer.x, y: pointer.y },
        );
        container.setPosition(center.x, center.y);
        container.setRotation(rotation);
        this.dragState.lastPointer = { x: pointer.x, y: pointer.y };
    }

    private onPointerUp(pointer: Input.Pointer) {
        if (!this.activeDragId) return;
        const id = this.activeDragId;
        const container = this.partContainers.get(id);
        this.activeDragId = null;
        this.dragState = null;
        this.grabMarker.setVisible(false);
        if (!container) return;

        if (regionForY(pointer.y, TRAY_TOP_Y) === 'placement') {
            this.locked.set(id, true);
            container.disableInteractive();
        }
        // Dropped in the tray region: stay right where it was released
        // (docs/spec.md) — no position reset.
    }

    private finishPlacement(scoreBtn: GameObjects.Rectangle, scoreLabel: GameObjects.Text) {
        this.phase = beginScoring(this.phase);
        if (this.phase !== 'scoring') return;

        for (const container of this.partContainers.values()) {
            container.disableInteractive();
        }
        scoreBtn.disableInteractive();
        scoreLabel.disableInteractive();

        const playerTransforms = this.collectPlayerTransforms();
        const score = this.computeScore(playerTransforms);
        this.scene.start('Result', { score, playerTransforms });
    }

    private collectPlayerTransforms(): Record<DraggablePartId, PartTransform> {
        const playerTransforms = {} as Record<DraggablePartId, PartTransform>;
        for (const id of PART_IDS) {
            const container = this.partContainers.get(id);
            playerTransforms[id] = container
                ? { x: container.x - PLACEMENT_CENTER.x, y: container.y - PLACEMENT_CENTER.y, rotation: container.rotation }
                : { x: 0, y: 0, rotation: 0 };
        }
        return playerTransforms;
    }

    private computeScore(playerTransforms: Record<DraggablePartId, PartTransform>): number {
        const playerCanvas = document.createElement('canvas');
        playerCanvas.width = SCORE_CANVAS_SIZE;
        playerCanvas.height = SCORE_CANVAS_SIZE;
        const playerCtx = playerCanvas.getContext('2d');

        const answerCanvas = document.createElement('canvas');
        answerCanvas.width = SCORE_CANVAS_SIZE;
        answerCanvas.height = SCORE_CANVAS_SIZE;
        const answerCtx = answerCanvas.getContext('2d');

        const blankCanvas = document.createElement('canvas');
        blankCanvas.width = SCORE_CANVAS_SIZE;
        blankCanvas.height = SCORE_CANVAS_SIZE;
        const blankCtx = blankCanvas.getContext('2d');

        if (!playerCtx || !answerCtx || !blankCtx) return 0;

        const canvasCenter = { x: SCORE_CANVAS_SIZE / 2, y: SCORE_CANVAS_SIZE / 2 };

        drawFaceOnCanvas(playerCtx, canvasCenter, playerTransforms);
        drawFaceOnCanvas(answerCtx, canvasCenter, PART_ANSWERS);
        fillBackground(blankCtx);

        const playerData = playerCtx.getImageData(0, 0, SCORE_CANVAS_SIZE, SCORE_CANVAS_SIZE).data;
        const answerData = answerCtx.getImageData(0, 0, SCORE_CANVAS_SIZE, SCORE_CANVAS_SIZE).data;
        const blankData = blankCtx.getImageData(0, 0, SCORE_CANVAS_SIZE, SCORE_CANVAS_SIZE).data;

        const actualDiff = averageChannelDiff(playerData, answerData);
        const baselineDiff = averageChannelDiff(blankData, answerData);

        return scoreFromAverageDiff(actualDiff, baselineDiff);
    }
}
