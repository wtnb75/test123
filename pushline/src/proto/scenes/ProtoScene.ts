import { Scene, GameObjects, Input, Time } from 'phaser';
import { P } from '../params';
import { createState, tryMove, giveUp, findPath, State, Dir, MoveResult, KindPt, Cell, DIRS } from '../logic';

const COLORS = { bg: 0x10161f, empty: 0x1e2a3a, movable: 0xf2b134, fixed: 0x5b6270, player: 0x4fd1c5, undo: 0x2c3a52, giveUp: 0x5a2d3a, pruned: 0x8a93a3 };
const M = 4;

interface Snapshot { grid: Cell[][]; px: number; py: number; moves: number }

export class ProtoScene extends Scene {
    private state!: State;
    private gfx!: GameObjects.Graphics;
    private movesText!: GameObjects.Text;
    private scoreText!: GameObjects.Text;
    private overText!: GameObjects.Text;
    private swipeStart: { x: number; y: number } | null = null;
    private overAt = 0;
    /** Cells whose block is currently being drawn by a pop-in tween. */
    private popping = new Set<string>();
    /** Board states since the last clear, for undo. */
    private history: Snapshot[] = [];
    private walkTimer: Time.TimerEvent | null = null;

    constructor() {
        super('ProtoScene');
    }

    create() {
        this.cameras.main.setBackgroundColor(COLORS.bg);
        this.gfx = this.add.graphics();
        this.movesText = this.add.text(40, 40, '', { fontSize: '32px', color: '#ffffff' });
        this.scoreText = this.add.text(P.canvasW - 40, 40, '', { fontSize: '32px', color: '#ffffff' }).setOrigin(1, 0);
        this.overText = this.add.text(P.canvasW / 2, P.boardTop + (P.rows * P.cellSize) / 2, '', {
            fontSize: '36px', color: '#ffffff', align: 'center', backgroundColor: '#000000cc', padding: { x: 16, y: 12 },
        }).setOrigin(0.5).setVisible(false).setDepth(10);

        this.state = createState(Math.random);

        const keys: Record<string, Dir> = {
            ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
            KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
        };
        this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
            if (this.state.over) {
                if (e.code === 'Space') this.reset();
            } else if (e.code === 'KeyR') {
                this.giveUp();
            } else if (e.code === 'KeyZ' || e.code === 'Backspace') {
                this.undo();
            } else if (keys[e.code]) {
                this.stopWalk();
                this.step(keys[e.code]);
            }
        });

        this.buildButtons();
        this.input.on('pointerdown', (p: Input.Pointer) => { this.swipeStart = { x: p.x, y: p.y }; });
        this.input.on('pointerup', (p: Input.Pointer) => this.onPointerUp(p));
        this.render();
    }

    private buildButtons() {
        const defs: [string, number, number, () => void, number][] = [
            ['UNDO', 130, 700, () => this.undo(), COLORS.undo],
            ['GIVE UP', 350, 700, () => this.giveUp(), COLORS.giveUp],
        ];
        defs.forEach(([label, x, y, fn, color]) => {
            this.add.rectangle(x, y, 200, 80, color).setInteractive().on('pointerdown', fn);
            this.add.text(x, y, label, { fontSize: '30px', color: '#ffffff' }).setOrigin(0.5);
        });
    }

    private boardX0() {
        return (P.canvasW - P.cols * P.cellSize) / 2;
    }

    private onPointerUp(p: Input.Pointer) {
        const s = this.swipeStart;
        this.swipeStart = null;
        if (this.state.over) {
            // Ignore the release of the tap that ended the game.
            if (this.time.now - this.overAt > P.inputGuardMs) this.reset();
            return;
        }
        if (!s) return;
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < P.swipeMinPx) {
            this.onTap(p.x, p.y);
            return;
        }
        this.stopWalk();
        this.step(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }

    /** Tap an empty cell to walk there; tap an adjacent block to push it. */
    private onTap(x: number, y: number) {
        const cx = Math.floor((x - this.boardX0()) / P.cellSize);
        const cy = Math.floor((y - P.boardTop) / P.cellSize);
        if (cx < 0 || cy < 0 || cx >= P.cols || cy >= P.rows) return;
        this.stopWalk();
        const s = this.state;
        if (cx === s.px && cy === s.py) return;
        const cell = s.grid[cy][cx];
        if (cell === 0) {
            const path = findPath(s.grid, s.px, s.py, cx, cy);
            if (path) this.startWalk(path);
            else this.cameras.main.shake(80, 0.004);
            return;
        }
        const dir = (Object.keys(DIRS) as Dir[]).find((d) => s.px + DIRS[d].x === cx && s.py + DIRS[d].y === cy);
        if (cell === 1 && dir) this.step(dir);
        else this.cameras.main.shake(80, 0.004);
    }

    private startWalk(path: Dir[]) {
        const queue = path.slice();
        this.walkTimer = this.time.addEvent({
            delay: P.walkStepMs,
            repeat: queue.length - 1,
            callback: () => {
                const dir = queue.shift();
                if (!dir || !this.step(dir)) this.stopWalk();
            },
        });
    }

    private stopWalk() {
        this.walkTimer?.remove(false);
        this.walkTimer = null;
    }

    private step(dir: Dir): boolean {
        const before = this.snapshot();
        const res = tryMove(this.state, dir, Math.random);
        if (!res.moved) return false;
        if (res.cleared.length > 0) {
            this.history = [];
        } else {
            this.history.push(before);
            if (this.history.length > P.maxUndo) this.history.shift();
        }
        this.animate(res);
        this.render();
        if (this.state.over) this.overAt = this.time.now;
        return true;
    }

    private snapshot(): Snapshot {
        const s = this.state;
        return { grid: s.grid.map((r) => r.slice()), px: s.px, py: s.py, moves: s.moves };
    }

    private undo() {
        const snap = this.history.pop();
        if (!snap || this.state.over) return;
        this.stopWalk();
        Object.assign(this.state, { grid: snap.grid, px: snap.px, py: snap.py, moves: snap.moves });
        this.render();
    }

    private giveUp() {
        if (this.state.over) return;
        this.stopWalk();
        giveUp(this.state);
        this.overAt = this.time.now;
        this.render();
    }

    private reset() {
        this.stopWalk();
        this.popping.clear();
        this.history = [];
        this.state = createState(Math.random);
        this.render();
    }

    private cellRect(p: KindPt) {
        const x0 = this.boardX0();
        const color = p.kind === 2 ? COLORS.fixed : COLORS.movable;
        return this.add.rectangle(
            x0 + (p.x + 0.5) * P.cellSize, P.boardTop + (p.y + 0.5) * P.cellSize,
            P.cellSize - 2 * M, P.cellSize - 2 * M, color,
        ).setDepth(5);
    }

    /** Cleared blocks shrink away; new blocks pop in only where they appear. */
    private animate(res: MoveResult) {
        res.cleared.forEach((p) => {
            const r = this.cellRect(p);
            this.tweens.add({
                targets: r, scale: 0.2, alpha: 0, duration: P.popMs, onComplete: () => r.destroy(),
            });
        });
        // Thinned-out leftovers look different: they turn grey, blink twice and fade slowly.
        res.pruned.forEach((p) => {
            const r = this.cellRect(p).setFillStyle(COLORS.pruned);
            this.tweens.add({
                targets: r, alpha: 0.25, duration: P.pruneBlinkMs, yoyo: true, repeat: 1,
                onComplete: () => {
                    this.tweens.add({ targets: r, alpha: 0, duration: P.pruneFadeMs, onComplete: () => r.destroy() });
                },
            });
        });
        res.spawned.forEach((p) => {
            const k = `${p.x},${p.y}`;
            this.popping.add(k);
            const r = this.cellRect(p).setScale(0);
            this.tweens.add({
                targets: r, scale: 1, duration: P.popMs, delay: P.popMs / 2,
                onComplete: () => { r.destroy(); this.popping.delete(k); this.render(); },
            });
        });
    }

    private render() {
        const s = this.state;
        const x0 = this.boardX0();
        const g = this.gfx.clear();
        s.grid.forEach((row, y) => row.forEach((c, x) => {
            const hidden = this.popping.has(`${x},${y}`);
            const color = c === 0 || hidden ? COLORS.empty : c === 1 ? COLORS.movable : COLORS.fixed;
            g.fillStyle(color).fillRect(x0 + x * P.cellSize + M, P.boardTop + y * P.cellSize + M, P.cellSize - 2 * M, P.cellSize - 2 * M);
            if (c === 2 && !hidden) {
                g.lineStyle(4, 0x2a2f3a).lineBetween(x0 + x * P.cellSize + 14, P.boardTop + y * P.cellSize + 14, x0 + (x + 1) * P.cellSize - 14, P.boardTop + (y + 1) * P.cellSize - 14);
            }
        }));
        g.fillStyle(COLORS.player).fillCircle(x0 + (s.px + 0.5) * P.cellSize, P.boardTop + (s.py + 0.5) * P.cellSize, P.cellSize * 0.3);
        this.movesText.setText(`MOVES ${s.moves}/${P.maxMoves}`);
        this.scoreText.setText(`LINES ${s.score}`);
        this.overText.setVisible(s.over).setText(`GAME OVER\nLINES ${s.score}\ntap / Space to retry`);
    }
}
