import { BULLET_BASE_SPEED, FORMATION_INTERVAL_EARLY_SEC, FORMATION_INTERVAL_SEC } from './constants';
import type { FormationType } from './formation';

export type DifficultyParams = {
    bulletSpeed: number;
    bulletTypes: BulletType[];
    formationSize: number;
    fireIntervalSec: number;
    formationShapes: FormationType[];
    formationIntervalSec: number;
};

export type BulletType = 'straight' | 'aimed' | 'nway3' | 'nway5' | 'spread8' | 'fast';

/** 経過秒数から難易度パラメータを返す */
export function getDifficultyParams(elapsedSec: number): DifficultyParams {
    if (elapsedSec < 10) {
        return {
            bulletSpeed: BULLET_BASE_SPEED,
            bulletTypes: ['straight'],
            formationSize: 3,
            fireIntervalSec: 2.0,
            formationShapes: ['row'],
            formationIntervalSec: FORMATION_INTERVAL_EARLY_SEC
        };
    } else if (elapsedSec < 20) {
        return {
            bulletSpeed: BULLET_BASE_SPEED,
            bulletTypes: ['straight', 'aimed'],
            formationSize: 3,
            fireIntervalSec: 1.8,
            formationShapes: ['row', 'v'],
            formationIntervalSec: FORMATION_INTERVAL_EARLY_SEC
        };
    } else if (elapsedSec < 30) {
        return {
            bulletSpeed: BULLET_BASE_SPEED,
            bulletTypes: ['straight', 'aimed', 'nway3'],
            formationSize: 3,
            fireIntervalSec: 1.6,
            formationShapes: ['row', 'v'],
            formationIntervalSec: FORMATION_INTERVAL_EARLY_SEC
        };
    } else if (elapsedSec < 60) {
        return {
            bulletSpeed: BULLET_BASE_SPEED * 1.3,
            bulletTypes: ['straight', 'aimed', 'nway3', 'spread8'],
            formationSize: 4,
            fireIntervalSec: 1.4,
            formationShapes: ['row', 'v'],
            formationIntervalSec: FORMATION_INTERVAL_SEC
        };
    } else if (elapsedSec < 120) {
        return {
            bulletSpeed: BULLET_BASE_SPEED * 1.6,
            bulletTypes: ['straight', 'aimed', 'nway3', 'nway5', 'spread8', 'fast'],
            formationSize: 5,
            fireIntervalSec: 1.1,
            formationShapes: ['row', 'v'],
            formationIntervalSec: FORMATION_INTERVAL_SEC
        };
    } else {
        return {
            bulletSpeed: BULLET_BASE_SPEED * 2.0,
            bulletTypes: ['straight', 'aimed', 'nway3', 'nway5', 'spread8', 'fast'],
            formationSize: 5,
            fireIntervalSec: 0.8,
            formationShapes: ['row', 'v'],
            formationIntervalSec: FORMATION_INTERVAL_SEC
        };
    }
}
