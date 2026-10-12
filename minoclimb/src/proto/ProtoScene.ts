import { GameObjects, Input as PhaserInput, Scene } from 'phaser';
import { P } from './params';
import {
    Grid, Piece, Player, Input,
    createGrid, createPlayer, planPlacement, shapeCells, KIND_COUNT, stepPiece, lockPiece, landingRow, Plan,
    clearLines, shiftPlayerForClears, toppedOut,
    stepPlayer, pieceCrushesPlayer, reachedGoal,
} from './logic';

const COLORS = [0x00d0d0, 0xf0d000, 0xa000d0, 0x00c040, 0xd02020, 0x2040e0, 0xf08000];
type Phase = 'playing' | 'won' | 'lost';

export class ProtoScene extends Scene {
    private g!: GameObjects.Graphics;
    private hud!: GameObjects.Text;
    private banner!: GameObjects.Text;
    private keys!: Record<string, PhaserInput.Keyboard.Key>;

    private grid: Grid = createGrid();
    private player: Player = createPlayer();
    private piece: Piece | null = null;
    private plan: Plan | null = null;
    private wellCol = 0;
    private waitTimer = 0;
    private hoverTime = 0;
    private elapsed = 0;
    private lines = 0;
    private phase: Phase = 'playing';
    private sticks: { ax: number; ay: number; kx: number }[] = [];
    private wasDown = false;
    private endTime = 0;

    constructor() {
        super('ProtoScene');
    }

    create() {
        this.g = this.add.graphics();
        this.hud = this.add.text(6, 4, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' });
        this.banner = this.add.text(P.COLS * P.CELL / 2, 240, '', {
            fontFamily: 'monospace', fontSize: '28px', color: '#ffffff', align: 'center',
            stroke: '#000000', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(10);
        this.input.addPointer(2);
        this.keys = this.input.keyboard!.addKeys('LEFT,RIGHT,UP,SPACE,A,D,W,R') as Record<string, PhaserInput.Keyboard.Key>;
        this.reset();
    }

    private reset() {
        this.grid = createGrid();
        this.player = createPlayer();
        this.piece = null;
        this.plan = null;
        this.wellCol = Math.random() < 0.5 ? 0 : P.COLS - 1;
        this.waitTimer = P.SPAWN_DELAY;
        this.hoverTime = 0;
        this.elapsed = 0;
        this.lines = 0;
        this.phase = 'playing';
        this.endTime = 0;
        this.banner.setText('');
    }

    private readInput(): { input: Input; tapped: boolean } {
        const k = this.keys;
        const input: Input = {
            left: k.LEFT.isDown || k.A.isDown,
            right: k.RIGHT.isDown || k.D.isDown,
            jump: k.UP.isDown || k.SPACE.isDown || k.W.isDown,
        };
        // Floating stick: left half of the screen is a horizontal stick anchored where the finger first
        // touched; right half is a jump button (anywhere). Both work anywhere vertically.
        const half = (P.COLS * P.CELL) / 2;
        this.sticks = [];
        let down = false;
        for (const p of this.input.manager.pointers) {
            if (!p.isDown) continue;
            down = true;
            if (p.downX < half) {
                const dx = p.x - p.downX;
                if (dx < -P.STICK_DEADZONE) input.left = true;
                else if (dx > P.STICK_DEADZONE) input.right = true;
                this.sticks.push({ ax: p.downX, ay: p.downY, kx: p.x });
            } else {
                input.jump = true;
            }
        }
        const tapped = down && !this.wasDown;
        this.wasDown = down;
        return { input, tapped };
    }

    update(_t: number, deltaMs: number) {
        const dt = Math.min(deltaMs / 1000, P.MAX_DT);
        const { input, tapped } = this.readInput();
        if (this.phase !== 'playing') {
            this.endTime += dt;
            const canRetry = this.endTime > 0.5;
            if (canRetry && (PhaserInput.Keyboard.JustDown(this.keys.R) || PhaserInput.Keyboard.JustDown(this.keys.SPACE) || tapped)) {
                this.reset();
            }
        } else {
            this.tick(dt, input);
        }
        this.draw();
    }

    private lose(text: string) {
        this.phase = 'lost';
        this.banner.setText(`${text}\ntap / R to retry`);
    }

    private tick(dt: number, input: Input) {
        this.elapsed += dt;
        this.player = stepPlayer(this.grid, this.player, input, dt);

        if (this.piece) {
            this.advancePiece(dt);
        } else if (this.plan) {
            this.hoverTime += dt;
            if (this.hoverTime >= P.TELEGRAPH_TIME) {
                const { kind, rot, col } = this.plan;
                this.piece = { kind, rot, cells: shapeCells(kind, rot), col, y: 0 };
                this.plan = null;
            }
        } else {
            this.waitTimer -= dt;
            if (this.waitTimer <= 0) {
                const kind = Math.floor(Math.random() * KIND_COUNT);
                this.plan = planPlacement(this.grid, kind, Math.random, this.wellCol);
                this.hoverTime = 0;
            }
        }

        if (this.phase !== 'playing') return;
        if (reachedGoal(this.player)) {
            this.phase = 'won';
            this.banner.setText(`CLEAR! ${this.elapsed.toFixed(1)}s\ntap / R to retry`);
        }
    }

    private advancePiece(dt: number) {
        const res = stepPiece(this.grid, this.piece!, dt, (p) => pieceCrushesPlayer(p, this.player));
        if (res.crushed) {
            this.lose('CRUSHED!');
            return;
        }
        if (res.lockedRow === null) {
            this.piece = res.piece;
            return;
        }
        lockPiece(this.grid, res.piece, res.lockedRow);
        this.piece = null;
        this.waitTimer = P.SPAWN_DELAY;
        if (toppedOut(res.lockedRow)) {
            this.lose('STACKED UP!');
            return;
        }
        const cleared = clearLines(this.grid);
        if (cleared.length > 0) {
            this.lines += cleared.length;
            this.player = shiftPlayerForClears(this.player, cleared);
        }
    }

    private draw() {
        const g = this.g;
        const C = P.CELL;
        g.clear();
        g.fillStyle(0x10131c, 1).fillRect(0, 0, P.COLS * C, P.ROWS * C);
        g.fillStyle(0x3a2a10, 1).fillRect(0, 0, P.COLS * C, P.TOP_OUT_ROW * C);
        g.fillStyle(0xffe040, 1).fillRect(0, P.GOAL_ROW * C - 2, P.COLS * C, 4);

        for (let r = 0; r < P.ROWS; r++) {
            for (let c = 0; c < P.COLS; c++) {
                const v = this.grid[r][c];
                if (v === 0) continue;
                g.fillStyle(COLORS[v - 1], 1).fillRect(c * C + 1, r * C + 1, C - 2, C - 2);
            }
        }

        const piece = this.piece;
        if (piece) {
            const land = landingRow(this.grid, piece);
            for (const { c, r } of piece.cells) {
                const x = (piece.col + c) * C;
                g.lineStyle(2, COLORS[piece.kind], 0.5).strokeRect(x + 2, (land + r) * C + 2, C - 4, C - 4);
                g.fillStyle(COLORS[piece.kind], 0.85).fillRect(x + 1, (piece.y + r) * C + 1, C - 2, C - 2);
            }
        }

        const plan = this.plan;
        if (plan) this.drawHover(plan);

        const p = this.player;
        g.fillStyle(0xffffff, 1).fillRect(p.x * C, p.y * C, P.PLAYER_W * C, P.PLAYER_H * C);

        // touch controls: faint divider, stick ring/knob where the left thumb is, jump hint on the right
        const half = (P.COLS * P.CELL) / 2;
        g.fillStyle(0xffffff, 0.06).fillRect(half, 0, half, P.ROWS * C);
        for (const st of this.sticks) {
            const knob = Math.max(st.ax - 40, Math.min(st.ax + 40, st.kx));
            g.lineStyle(3, 0xffffff, 0.35).strokeCircle(st.ax, st.ay, 40);
            g.fillStyle(0xffffff, 0.5).fillCircle(knob, st.ay, 18);
        }

        const height = Math.max(0, Math.round(P.ROWS - (p.y + P.PLAYER_H)));
        this.hud.setText(`H ${height}/${P.ROWS - P.GOAL_ROW}  T ${this.elapsed.toFixed(1)}  L ${this.lines}`);
    }

    /** Telegraph: the piece hovers at the top, spins into its final shape, and shows where it will land. */
    private drawHover(plan: Plan) {
        const g = this.g;
        const C = P.CELL;
        const steps = Math.floor(this.hoverTime / P.ROTATE_STEP);
        const remaining = Math.max(0, 3 - steps);
        const rot = (plan.rot - remaining + 4) % 4;
        const cells = shapeCells(plan.kind, rot);
        const width = Math.max(...cells.map((x) => x.c)) + 1;
        const col = Math.min(plan.col, P.COLS - width);
        const alpha = 0.35 + 0.35 * Math.abs(Math.sin(this.hoverTime * 12));
        const final = shapeCells(plan.kind, plan.rot);
        for (const { c, r } of final) {
            const x = (plan.col + c) * C;
            g.fillStyle(COLORS[plan.kind], alpha * 0.5).fillRect(x + 2, (plan.row + r) * C + 2, C - 4, C - 4);
            g.lineStyle(2, COLORS[plan.kind], 0.9).strokeRect(x + 2, (plan.row + r) * C + 2, C - 4, C - 4);
        }
        for (const { c, r } of cells) {
            g.fillStyle(COLORS[plan.kind], 0.9).fillRect((col + c) * C + 1, r * C + 1, C - 2, C - 2);
        }
    }
}
