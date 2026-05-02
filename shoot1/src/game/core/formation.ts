import type { Vec2 } from './physics';

export type FormationType = 'row' | 'v';

/**
 * 横一列編隊の座標を返す
 * @param count 機数
 * @param centerX 中心X
 * @param startY 開始Y（画面上部）
 * @param spacing 機体間隔
 */
export function calcRowFormation(
    count: number,
    centerX: number,
    startY: number,
    spacing: number
): Vec2[] {
    const positions: Vec2[] = [];
    const totalWidth = (count - 1) * spacing;
    const startX = centerX - totalWidth / 2;
    for (let i = 0; i < count; i++) {
        positions.push({ x: startX + i * spacing, y: startY });
    }
    return positions;
}

/**
 * V字編隊の座標を返す
 * @param count 機数（奇数推奨）
 * @param centerX 中心X
 * @param startY 頂点のY（画面上部）
 * @param spacing 機体間隔
 */
export function calcVFormation(
    count: number,
    centerX: number,
    startY: number,
    spacing: number
): Vec2[] {
    const positions: Vec2[] = [];
    const half = Math.floor(count / 2);
    // 中央
    if (count % 2 === 1) {
        positions.push({ x: centerX, y: startY });
    }
    // 左右
    for (let i = 1; i <= half; i++) {
        positions.push({ x: centerX - i * spacing, y: startY + i * spacing * 0.6 });
        positions.push({ x: centerX + i * spacing, y: startY + i * spacing * 0.6 });
    }
    if (count % 2 === 0) {
        const i = half;
        positions.push({ x: centerX - (i - 0.5) * spacing, y: startY + (i - 0.5) * spacing * 0.6 });
        positions.push({ x: centerX + (i - 0.5) * spacing, y: startY + (i - 0.5) * spacing * 0.6 });
    }
    return positions;
}
