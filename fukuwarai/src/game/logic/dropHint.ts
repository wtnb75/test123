import { DROP_HINT_CONFIRM_COLOR, DROP_HINT_TRAY_COLOR } from './constants';
import type { Region } from './types';

export interface DropHint {
    label: string;
    /** Dashed boundary line = nothing is confirmed (shape, not color alone). */
    dashed: boolean;
    color: number;
}

/** What to show while a part is held over `region` (docs/spec.md "ドロップ先の表示"). */
export function dropHintFor(region: Region): DropHint {
    if (region === 'placement') {
        return { label: 'ここで離すと確定', dashed: false, color: DROP_HINT_CONFIRM_COLOR };
    }
    return { label: '確定しない（やり直せる）', dashed: true, color: DROP_HINT_TRAY_COLOR };
}
