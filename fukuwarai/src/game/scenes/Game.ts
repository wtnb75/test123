import { Geom, Input, Scene, type GameObjects } from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    TRAY_TOP_Y,
    PLACEMENT_CENTER,
    SCORE_BUTTON_Y,
    SCORE_CANVAS_SIZE,
    DROP_HINT_LABEL_Y,
    DROP_HINT_LABEL_FONT_PX,
    DROP_HINT_LINE_WIDTH_PX,
    DROP_HINT_DASH_PX,
    DROP_HINT_GAP_PX,
    DROP_HINT_CONFIRM_COLOR,
    DROP_HINT_TINT_ALPHA,
    DROP_HINT_TINT_DEPTH,
    DROP_HINT_LINE_DEPTH,
    DROP_HINT_DIVIDER_DEPTH,
    DROP_HINT_TOP_DEPTH,
    CONFIRM_FLASH_MS,
    CONFIRM_FLASH_LINE_PX,
} from '../logic/constants';
import { dropHintFor } from '../logic/dropHint';
import { PART_IDS, PART_SHAPES, TRAY_SLOTS, hitRadius } from '../logic/parts';
import { LAST_TOPIC_KEY, TOPICS, pickTopic, type TopicAnswers } from '../logic/topics';
import type { DraggablePartId, GamePhase, PartTransform, Point, Region } from '../logic/types';
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
    private topicIndex = 0;
    private answers: TopicAnswers = TOPICS[0];
    private partContainers = new Map<DraggablePartId, GameObjects.Container>();
    private locked = new Map<DraggablePartId, boolean>();
    private activeDragId: DraggablePartId | null = null;
    private dragState: DragState | null = null;
    private depthCounter = 1;
    private grabMarker!: GameObjects.Graphics;
    // Drop-target display (docs/spec.md "ドロップ先の表示"); created once in showPlacement.
    private guideText: GameObjects.Text | null = null;
    private hintLabel: GameObjects.Text | null = null;
    private hintTint: GameObjects.Graphics | null = null;
    private hintLine: GameObjects.Graphics | null = null;
    private hintRegion: Region | null = null;

    constructor() {
        super('Game');
    }

    create() {
        this.cameras.main.setBackgroundColor('#eaf6ff');
        this.phase = 'reveal';
        const previous = this.registry.get(LAST_TOPIC_KEY) as number | undefined;
        this.topicIndex = pickTopic(TOPICS.length, typeof previous === 'number' ? previous : null, Math.random);
        this.answers = TOPICS[this.topicIndex];
        this.registry.set(LAST_TOPIC_KEY, this.topicIndex);
        this.partContainers.clear();
        this.locked.clear();
        this.activeDragId = null;
        this.dragState = null;
        this.grabMarker = this.add.graphics().setVisible(false);
        this.hintRegion = null;
        this.guideText = null;
        this.hintLabel = null;
        this.hintTint = null;
        this.hintLine = null;

        this.input.on('pointermove', (pointer: Input.Pointer) => this.onPointerMove(pointer));
        this.input.on('pointerup', (pointer: Input.Pointer) => this.onPointerUp(pointer));
        this.input.on('pointerupoutside', (pointer: Input.Pointer) => this.onPointerUp(pointer, true));

        this.showReveal();
    }

    private showReveal() {
        const group = drawFaceGroup(this, this.answers);
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
        this.guideText = this.add.text(GAME_WIDTH / 2, 20, '記憶を頼りにパーツを並べよう', {
            color: '#333333',
            fontFamily: 'sans-serif',
            fontSize: '16px',
        }).setOrigin(0.5);
        this.createDropHint();

        // Under the drop-hint line, so the thick line is not striped by this thin one.
        const divider = this.add.graphics().setDepth(DROP_HINT_DIVIDER_DEPTH);
        divider.lineStyle(2, 0xcccccc, 1);
        divider.lineBetween(0, TRAY_TOP_Y, GAME_WIDTH, TRAY_TOP_Y);

        // Outline is a fixed background element, not a draggable part (docs/spec.md).
        const outlineAnswer = this.answers.outline;
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

    private createDropHint() {
        this.hintTint = this.add.graphics().setDepth(DROP_HINT_TINT_DEPTH).setVisible(false);
        this.hintLine = this.add.graphics().setDepth(DROP_HINT_LINE_DEPTH).setVisible(false);
        this.hintLabel = this.add.text(GAME_WIDTH / 2, DROP_HINT_LABEL_Y, '', {
            color: '#222222',
            fontFamily: 'sans-serif',
            fontSize: `${DROP_HINT_LABEL_FONT_PX}px`,
            fontStyle: 'bold',
            stroke: '#ffffff',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(DROP_HINT_TOP_DEPTH).setVisible(false);
    }

    /** Shows what releasing at `y` would do; redraws only when the region changes. */
    private updateDropHint(y: number) {
        if (!this.hintTint || !this.hintLine || !this.hintLabel) return;
        const region = regionForY(y, TRAY_TOP_Y);
        if (region === this.hintRegion) return;
        this.hintRegion = region;
        const hint = dropHintFor(region);

        this.hintTint.clear().setVisible(true);
        this.hintTint.fillStyle(hint.color, DROP_HINT_TINT_ALPHA);
        if (region === 'placement') {
            this.hintTint.fillRect(0, 0, GAME_WIDTH, TRAY_TOP_Y);
        } else {
            this.hintTint.fillRect(0, TRAY_TOP_Y, GAME_WIDTH, GAME_HEIGHT - TRAY_TOP_Y);
        }

        this.hintLine.clear().setVisible(true);
        this.hintLine.lineStyle(DROP_HINT_LINE_WIDTH_PX, hint.color, 1);
        if (hint.dashed) {
            const step = DROP_HINT_DASH_PX + DROP_HINT_GAP_PX;
            for (let x = 0; x < GAME_WIDTH; x += step) {
                this.hintLine.lineBetween(x, TRAY_TOP_Y, Math.min(x + DROP_HINT_DASH_PX, GAME_WIDTH), TRAY_TOP_Y);
            }
        } else {
            this.hintLine.lineBetween(0, TRAY_TOP_Y, GAME_WIDTH, TRAY_TOP_Y);
        }

        this.hintLabel.setText(hint.label).setColor(region === 'placement' ? '#14524b' : '#8f2f14').setVisible(true);
        this.guideText?.setVisible(false);
    }

    private hideDropHint() {
        this.hintRegion = null;
        this.hintTint?.setVisible(false);
        this.hintLine?.setVisible(false);
        this.hintLabel?.setVisible(false);
        this.guideText?.setVisible(true);
    }

    /** Ring that fades out over CONFIRM_FLASH_MS where a part was just confirmed. */
    private playConfirmFlash(id: DraggablePartId, container: GameObjects.Container) {
        const ring = this.add.graphics().setDepth(DROP_HINT_TOP_DEPTH);
        ring.lineStyle(CONFIRM_FLASH_LINE_PX, DROP_HINT_CONFIRM_COLOR, 1);
        ring.strokeCircle(0, 0, hitRadius(PART_SHAPES[id]));
        ring.setPosition(container.x, container.y);
        this.tweens.add({
            targets: ring,
            alpha: { from: 1, to: 0 },
            duration: CONFIRM_FLASH_MS,
            ease: 'Linear',
            onComplete: () => ring.destroy(),
        });
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
            this.updateDropHint(pointer.y);
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
        this.updateDropHint(pointer.y);
    }

    // Released outside the canvas (e.g. on the letterbox band): the drag ends
    // without confirming, like any other unexpected place (docs/spec.md).
    private onPointerUp(pointer: Input.Pointer, releasedOutside = false) {
        if (!this.activeDragId) return;
        const id = this.activeDragId;
        const container = this.partContainers.get(id);
        this.activeDragId = null;
        this.dragState = null;
        this.grabMarker.setVisible(false);
        this.hideDropHint();
        if (!container) return;

        if (!releasedOutside && regionForY(pointer.y, TRAY_TOP_Y) === 'placement') {
            this.locked.set(id, true);
            container.disableInteractive();
            this.playConfirmFlash(id, container);
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
        this.scene.start('Result', { score, playerTransforms, topicIndex: this.topicIndex });
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
        drawFaceOnCanvas(answerCtx, canvasCenter, this.answers);
        fillBackground(blankCtx);

        const playerData = playerCtx.getImageData(0, 0, SCORE_CANVAS_SIZE, SCORE_CANVAS_SIZE).data;
        const answerData = answerCtx.getImageData(0, 0, SCORE_CANVAS_SIZE, SCORE_CANVAS_SIZE).data;
        const blankData = blankCtx.getImageData(0, 0, SCORE_CANVAS_SIZE, SCORE_CANVAS_SIZE).data;

        const actualDiff = averageChannelDiff(playerData, answerData);
        const baselineDiff = averageChannelDiff(blankData, answerData);

        return scoreFromAverageDiff(actualDiff, baselineDiff);
    }
}
