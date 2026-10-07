// Pure game rules (no Phaser imports) so they can be ported later.
export type Kind = 'mole' | 'friend';

export interface Pop {
    hole: number;
    kind: Kind;
    startAt: number;
    expiresAt: number;
}

export interface Pt {
    x: number;
    y: number;
}

export interface View {
    x: number;
    y: number;
    w: number;
    h: number;
}

export function holePos(index: number, cols: number, spacing: number): Pt {
    return {
        x: spacing / 2 + (index % cols) * spacing,
        y: spacing / 2 + Math.floor(index / cols) * spacing,
    };
}

export function pickSpawn(
    holeCount: number,
    active: readonly Pop[],
    friendRate: number,
    rand: () => number,
): { hole: number; kind: Kind } | null {
    const used = new Set(active.map((p) => p.hole));
    const free: number[] = [];
    for (let i = 0; i < holeCount; i++) if (!used.has(i)) free.push(i);
    if (free.length === 0) return null;
    const hole = free[Math.floor(rand() * free.length)];
    return { hole, kind: rand() < friendRate ? 'friend' : 'mole' };
}

export function scoreFor(kind: Kind, mole: number, friend: number): number {
    return kind === 'mole' ? mole : friend;
}

export function applyScore(total: number, delta: number): number {
    return Math.max(0, total + delta);
}

export function findHit<T extends Pop>(world: Pt, pops: readonly T[], holes: readonly Pt[], radius: number): T | null {
    let best: T | null = null;
    let bestD = radius;
    for (const p of pops) {
        const h = holes[p.hole];
        const d = Math.hypot(h.x - world.x, h.y - world.y);
        if (d <= bestD) {
            best = p;
            bestD = d;
        }
    }
    return best;
}

// Combo spawn: an anchor hole plus free neighbouring holes (8-neighbourhood), up to `size` holes.
export function pickCombo(
    holeCount: number,
    cols: number,
    active: readonly Pop[],
    size: number,
    rand: () => number,
): number[] {
    const used = new Set(active.map((p) => p.hole));
    const free: number[] = [];
    for (let i = 0; i < holeCount; i++) if (!used.has(i)) free.push(i);
    if (free.length === 0) return [];
    const anchor = free[Math.floor(rand() * free.length)];
    const ax = anchor % cols;
    const ay = Math.floor(anchor / cols);
    const near = free.filter(
        (i) => i !== anchor && Math.abs((i % cols) - ax) <= 1 && Math.abs(Math.floor(i / cols) - ay) <= 1,
    );
    const picked = [anchor];
    while (picked.length < size && near.length > 0) {
        picked.push(near.splice(Math.floor(rand() * near.length), 1)[0]);
    }
    return picked;
}

// A pop is hittable only after its telegraph has finished.
export function isUp(p: Pop, now: number, telegraphMs: number): boolean {
    return now >= p.startAt + telegraphMs;
}

// Scroll velocity (px per axis, -1..0..1) for a mouse near the view edge.
export function edgeScrollDir(p: Pt, w: number, h: number, zone: number): Pt {
    const f = (v: number, size: number) => (v < zone ? -(1 - v / zone) : v > size - zone ? 1 - (size - v) / zone : 0);
    return { x: f(p.x, w), y: f(p.y, h) };
}

export function isInView(p: Pt, v: View): boolean {
    return p.x >= v.x && p.x <= v.x + v.w && p.y >= v.y && p.y <= v.y + v.h;
}

// Edge arrow for an off-screen point: position clamped inside the view and its angle (radians).
export function edgeArrow(p: Pt, v: View, margin: number): { x: number; y: number; angle: number } | null {
    if (isInView(p, v)) return null;
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const hw = v.w / 2 - margin;
    const hh = v.h / 2 - margin;
    const s = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
    return { x: cx + dx * s, y: cy + dy * s, angle: Math.atan2(dy, dx) };
}
