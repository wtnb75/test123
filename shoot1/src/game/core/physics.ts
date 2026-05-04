export type Vec2 = { x: number; y: number };

/** 2円の重なり判定 */
export function circlesOverlap(
    ax: number, ay: number, ar: number,
    bx: number, by: number, br: number
): boolean {
    const dx = ax - bx;
    const dy = ay - by;
    const dist2 = dx * dx + dy * dy;
    const r = ar + br;
    return dist2 < r * r;
}

/** 爆発半径内にある対象のインデックス一覧を返す */
export function getTargetsInExplosion(
    ex: number, ey: number, radius: number,
    targets: Vec2[]
): number[] {
    const result: number[] = [];
    for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const dx = ex - t.x;
        const dy = ey - t.y;
        if (dx * dx + dy * dy <= radius * radius) {
            result.push(i);
        }
    }
    return result;
}

/** 位置を画面内にクランプ */
export function clampPosition(
    x: number, y: number,
    radius: number,
    width: number, height: number
): Vec2 {
    return {
        x: Math.max(radius, Math.min(width - radius, x)),
        y: Math.max(radius, Math.min(height - radius, y))
    };
}

/** キー入力から速度ベクトルを計算（斜め移動は正規化） */
export function inputToVelocity(
    left: boolean, right: boolean, up: boolean, down: boolean,
    speed: number
): Vec2 {
    let vx = 0;
    let vy = 0;
    if (left)  vx -= 1;
    if (right) vx += 1;
    if (up)    vy -= 1;
    if (down)  vy += 1;

    if (vx !== 0 && vy !== 0) {
        const inv = 1 / Math.sqrt(2);
        vx *= inv;
        vy *= inv;
    }
    return { x: vx * speed, y: vy * speed };
}

/** 仮想スティックのドラッグ量から速度ベクトルを計算 */
export function joystickToVelocity(
    dx: number, dy: number,
    deadzone: number,
    baseRadius: number,
    speed: number
): Vec2 {
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < deadzone) {
        return { x: 0, y: 0 };
    }
    const clamped = Math.min(dist, baseRadius);
    const factor = clamped / baseRadius;
    return {
        x: (dx / dist) * factor * speed,
        y: (dy / dist) * factor * speed
    };
}

/** 角度からベクトルに変換（ラジアン） */
export function angleToVec(angle: number): Vec2 {
    return { x: Math.cos(angle), y: Math.sin(angle) };
}

/** 2点間の角度を返す（ラジアン） */
export function angleTo(
    fromX: number, fromY: number,
    toX: number, toY: number
): number {
    return Math.atan2(toY - fromY, toX - fromX);
}

/** N-way弾の角度配列を返す（ラジアン） */
export function calcNWayAngles(
    baseAngle: number,
    n: number,
    spreadRad: number
): number[] {
    if (n <= 1) return [baseAngle];
    const step = spreadRad / (n - 1);
    const start = baseAngle - spreadRad / 2;
    return Array.from({ length: n }, (_, i) => start + i * step);
}

/** スコアを計算する（経過ミリ秒 × 係数） */
export function calcScore(elapsedMs: number, multiplier: number): number {
    return Math.floor((elapsedMs / 1000) * multiplier);
}

/** 連鎖爆発の爆発半径を計算する（連鎖回数に応じて 1.5 倍ずつ拡大） */
export function calcChainExplosionRadius(baseRadius: number, multiplier: number, chainCount: number): number {
    return baseRadius * Math.pow(multiplier, chainCount);
}
