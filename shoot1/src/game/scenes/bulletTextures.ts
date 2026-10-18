import * as Phaser from 'phaser';
import { BULLET_RADIUS, BULLET_TAIL_LENGTH, BULLET_VISUAL_RADIUS_MAX } from '../core/constants';
import type { BulletType } from '../core/difficulty';
import { BULLET_TYPES, bulletVisual } from '../core/visuals';

const TAIL_ORANGE = bulletVisual('straight').color;
const TAIL_STEPS = 4;

export function bulletTextureKey(type: BulletType): string {
    const v = bulletVisual(type);
    return `bullet-${v.shape}-${v.color.toString(16)}`;
}

// Every texture is centered on the bullet; sprites face +x and are rotated along the velocity.
function drawShape(g: Phaser.GameObjects.Graphics, type: BulletType, cx: number, cy: number) {
    const v = bulletVisual(type);
    const r = BULLET_VISUAL_RADIUS_MAX;
    if (v.shape === 'circle') {
        g.fillStyle(v.color, 1);
        g.fillCircle(cx, cy, BULLET_RADIUS);
    } else if (v.shape === 'diamond') {
        const half = r * 0.65;
        g.fillStyle(v.color, 1);
        g.fillTriangle(cx + r, cy, cx, cy - half, cx, cy + half);
        g.fillTriangle(cx - r, cy, cx, cy - half, cx, cy + half);
    } else if (v.shape === 'triangle') {
        g.fillStyle(v.color, 1);
        g.fillTriangle(cx + r, cy, cx - r * 0.5, cy - r * 0.8, cx - r * 0.5, cy + r * 0.8);
    } else {
        // tail: stacked triangles, fainter toward the tip
        for (let i = 0; i < TAIL_STEPS; i++) {
            const len = BULLET_TAIL_LENGTH * (1 - i / TAIL_STEPS);
            g.fillStyle(TAIL_ORANGE, 0.25 + 0.15 * i);
            g.fillTriangle(cx, cy - BULLET_RADIUS * 0.8, cx - len, cy, cx, cy + BULLET_RADIUS * 0.8);
        }
        g.fillStyle(v.color, 1);
        g.fillCircle(cx, cy, BULLET_RADIUS);
    }
}

/** Create the bullet textures once; later calls (scene restarts) reuse them */
export function createBulletTextures(scene: Phaser.Scene) {
    const half = BULLET_TAIL_LENGTH + 2;
    // nway3 and nway5 share one key, so the exists() check skips the duplicate
    for (const type of BULLET_TYPES) {
        const key = bulletTextureKey(type);
        if (scene.textures.exists(key)) continue;
        const g = scene.make.graphics({}, false);
        drawShape(g, type, half, half);
        g.generateTexture(key, half * 2, half * 2);
        g.destroy();
    }
}
