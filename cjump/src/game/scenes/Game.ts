import { Scene, Curves, Math as PhaserMath, GameObjects } from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    ROUTE_MARGIN,
    EDGE_LINE_WIDTH,
    COLLISION_TOLERANCE,
    JUMP_DURATION_MS,
    CHARACTER_PIXEL_SPEED_PER_SEC
} from '../logic/constants';
import { getDifficultyParams } from '../logic/difficulty';
import { generateWaypoints } from '../logic/waypoints';
import { createCircle, getRadius, isOffScreen, type CircleObstacle } from '../logic/circle';
import { isTouchingEdge } from '../logic/collision';
import {
    createCharacterState,
    requestJump,
    updateCharacter,
    hasFinished,
    isCollisionActive,
    type CharacterState
} from '../logic/character';

interface LiveCircle {
    obstacle: CircleObstacle;
    graphics: GameObjects.Graphics;
}

export class Game extends Scene {
    private stage = 1;
    private path!: Curves.Path;
    private speedPerMs = 0;
    private character: CharacterState = createCharacterState();
    private circles: LiveCircle[] = [];
    private nextCircleId = 0;
    private msSinceLastSpawn = 0;
    private spawnIntervalMs = 1800;
    private growthSpeedPxPerSec = 40;
    private routeGraphics!: GameObjects.Graphics;
    private characterGraphics!: GameObjects.Graphics;
    private finished = false;
    private readonly handlePointerDown = () => this.jump();
    private readonly handleSpaceDown = () => this.jump();

    constructor() {
        super('Game');
    }

    init(data: { stage: number }) {
        this.stage = data.stage;
        this.character = createCharacterState();
        this.circles = [];
        this.nextCircleId = 0;
        this.msSinceLastSpawn = 0;
        this.finished = false;
    }

    create() {
        const difficulty = getDifficultyParams(this.stage);
        this.spawnIntervalMs = difficulty.circleSpawnIntervalMs;
        this.growthSpeedPxPerSec = difficulty.circleGrowthSpeedPxPerSec;

        const waypoints = generateWaypoints(this.stage, difficulty.waypointCount, difficulty.thetaMaxDeg, {
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
            margin: ROUTE_MARGIN
        });

        this.path = new Curves.Path(waypoints[0].x, waypoints[0].y);
        this.path.splineTo(waypoints.slice(1).map((p) => new PhaserMath.Vector2(p.x, p.y)));
        this.speedPerMs = CHARACTER_PIXEL_SPEED_PER_SEC / 1000 / this.path.getLength();

        this.routeGraphics = this.add.graphics();
        this.routeGraphics.lineStyle(2, 0x3a3f52, 1);
        this.path.draw(this.routeGraphics);

        this.characterGraphics = this.add.graphics();

        this.registerInputHandlers();
        this.events.once('shutdown', this.shutdown, this);
    }

    private registerInputHandlers() {
        // Remove first so a scene restart (retry / next stage) never double-registers.
        this.input.off('pointerdown', this.handlePointerDown);
        this.input.keyboard?.off('keydown-SPACE', this.handleSpaceDown);

        this.input.on('pointerdown', this.handlePointerDown);
        this.input.keyboard?.on('keydown-SPACE', this.handleSpaceDown);
    }

    private shutdown() {
        this.input.off('pointerdown', this.handlePointerDown);
        this.input.keyboard?.off('keydown-SPACE', this.handleSpaceDown);
    }

    private jump() {
        if (this.finished) {
            return;
        }
        this.character = requestJump(this.character);
    }

    update(_time: number, delta: number) {
        if (this.finished) {
            return;
        }

        this.character = updateCharacter(this.character, delta, this.speedPerMs, JUMP_DURATION_MS);
        this.drawCharacter();

        this.msSinceLastSpawn += delta;
        if (this.msSinceLastSpawn >= this.spawnIntervalMs) {
            this.msSinceLastSpawn = 0;
            this.spawnCircle();
        }

        this.updateCircles();

        if (isCollisionActive(this.character)) {
            this.checkCollisions();
        }

        if (!this.finished && hasFinished(this.character)) {
            this.finish(true);
        }
    }

    private spawnCircle() {
        const obstacle = createCircle(
            this.nextCircleId++,
            Math.random,
            { width: GAME_WIDTH, height: GAME_HEIGHT },
            this.time.now
        );
        const graphics = this.add.graphics();
        this.circles.push({ obstacle, graphics });
    }

    private updateCircles() {
        this.circles = this.circles.filter((live) => {
            const radius = getRadius(live.obstacle, this.time.now, this.growthSpeedPxPerSec);
            if (isOffScreen(live.obstacle, radius, { width: GAME_WIDTH, height: GAME_HEIGHT })) {
                live.graphics.destroy();
                return false;
            }
            live.graphics.clear();
            live.graphics.lineStyle(EDGE_LINE_WIDTH, 0xe74c3c, 1);
            live.graphics.strokeCircle(live.obstacle.x, live.obstacle.y, radius);
            return true;
        });
    }

    private checkCollisions() {
        const point = this.path.getPoint(this.character.t);
        for (const live of this.circles) {
            const radius = getRadius(live.obstacle, this.time.now, this.growthSpeedPxPerSec);
            if (isTouchingEdge(point.x, point.y, live.obstacle.x, live.obstacle.y, radius, COLLISION_TOLERANCE)) {
                this.finish(false);
                return;
            }
        }
    }

    private drawCharacter() {
        const t = Math.min(this.character.t, 1);
        const point = this.path.getPoint(t);
        const tangent = this.path.getTangent(Math.min(t, 0.999));
        const radius = this.character.isJumping ? 16 : 12;

        this.characterGraphics.clear();
        this.characterGraphics.fillStyle(0xf1c40f, 1);
        this.characterGraphics.fillCircle(point.x, point.y, radius);
        this.characterGraphics.fillTriangle(
            point.x + tangent.x * (radius + 6),
            point.y + tangent.y * (radius + 6),
            point.x + tangent.y * 4 - tangent.x * 2,
            point.y - tangent.x * 4 - tangent.y * 2,
            point.x - tangent.y * 4 - tangent.x * 2,
            point.y + tangent.x * 4 - tangent.y * 2
        );

        if (this.character.isJumping) {
            this.characterGraphics.fillStyle(0x000000, 0.25);
            this.characterGraphics.fillEllipse(point.x, point.y + radius + 4, 14, 6);
        }
    }

    private finish(cleared: boolean) {
        this.finished = true;
        if (cleared) {
            this.scene.start('StageClear', { stage: this.stage });
        } else {
            this.scene.start('GameOver', { stage: this.stage });
        }
    }
}
