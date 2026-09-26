// Phaser-free timing for presentation effects; the Scene only reads these to draw.

/** A restartable countdown in seconds. */
export class Countdown {
    left = 0;

    constructor(readonly duration: number) {}

    start(): void {
        this.left = this.duration;
    }

    stop(): void {
        this.left = 0;
    }

    tick(dt: number): void {
        this.left = Math.max(0, this.left - dt);
    }

    get active(): boolean {
        return this.left > 0;
    }

    /** 0 at start, 1 when finished. */
    get progress(): number {
        return 1 - this.left / this.duration;
    }
}

export interface Popup {
    x: number;
    y: number;
    age: number;
    active: boolean;
}

/**
 * Fixed-size pool of kill effects; spawning past capacity reuses the oldest entry.
 * One entry drives both the ring and the "+N" text: the ring (KILL_FX) always ends before the text
 * (POPUP_TIME), so sharing the pool keeps each at most POPUP_MAX at once.
 */
export class PopupPool {
    readonly items: Popup[];

    constructor(size: number, private readonly lifetime: number) {
        this.items = Array.from({ length: size }, () => ({ x: 0, y: 0, age: 0, active: false }));
    }

    spawn(x: number, y: number): Popup {
        let slot = this.items.find((p) => !p.active);
        if (!slot) {
            slot = this.items[0];
            for (const p of this.items) if (p.age > slot.age) slot = p;
        }
        slot.x = x;
        slot.y = y;
        slot.age = 0;
        slot.active = true;
        return slot;
    }

    tick(dt: number): void {
        for (const p of this.items) {
            if (!p.active) continue;
            p.age += dt;
            if (p.age >= this.lifetime) p.active = false;
        }
    }

    get anyActive(): boolean {
        for (const p of this.items) if (p.active) return true;
        return false;
    }
}

/** Per-cell countdowns (e.g. range emphasis after placing a turret). */
export class CellTimers {
    private readonly left = new Map<number, number>();

    constructor(private readonly duration: number) {}

    start(cellIndex: number): void {
        this.left.set(cellIndex, this.duration);
    }

    remove(cellIndex: number): void {
        this.left.delete(cellIndex);
    }

    tick(dt: number): void {
        // Skip the Map iterator on the common idle frame.
        if (this.left.size === 0) return;
        for (const [key, value] of this.left) {
            const next = value - dt;
            if (next <= 0) this.left.delete(key);
            else this.left.set(key, next);
        }
    }

    has(cellIndex: number): boolean {
        return this.left.has(cellIndex);
    }

    get size(): number {
        return this.left.size;
    }
}
