// Pure rules of the mine display mode (the 表示モード section of docs/spec.md). No DOM, no Phaser.
import { isCompact } from './zoom';

export type DisplayMode = 'picture' | 'numbers' | 'both';

/** The mode a new page starts in (not saved). */
export const DISPLAY_MODE_DEFAULT: DisplayMode = 'numbers';

export const DISPLAY_MODE_LABEL: Record<DisplayMode, string> = {
    picture: '絵',
    numbers: '数字',
    both: '両方'
};

const CYCLE: readonly DisplayMode[] = ['picture', 'numbers', 'both'];

/** The text of the sidebar button: the current mode. */
export function displayModeButtonLabel(mode: DisplayMode): string {
    return `表示: ${DISPLAY_MODE_LABEL[mode]}`;
}

/** 絵 → 数字 → 両方 → 絵. */
export function nextDisplayMode(mode: DisplayMode): DisplayMode {
    return CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length];
}

/** Digits are shown on non-mine cells: never in 絵, and only from COMPACT_CELL_PX on. */
export function showNumbers(mode: DisplayMode, cellSide: number): boolean {
    return mode !== 'picture' && !isCompact(cellSide);
}

/** The "B" on a mine: only in 数字 from COMPACT_CELL_PX on. */
export function showMineLabel(mode: DisplayMode, cellSide: number): boolean {
    return mode === 'numbers' && !isCompact(cellSide);
}

/** Mines are painted dark: always in 絵 and 両方, and in 数字 only when compact. */
export function paintMines(mode: DisplayMode, cellSide: number): boolean {
    return mode !== 'numbers' || isCompact(cellSide);
}

export type PaleCellState = {
    hasMine: boolean;
    isStart: boolean;
    isForbidden: boolean;
};

/** Non-mine cells are pale only in 絵; the start cell and the forbidden cells keep their own look. */
export function isPaleCell(mode: DisplayMode, cell: PaleCellState): boolean {
    return mode === 'picture' && !cell.hasMine && !cell.isStart && !cell.isForbidden;
}

export type DisplayModeKeyEvent = {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
};

/** The M key (Shift does not matter), but not while typing in an input or with ctrl, meta or alt held. */
export function isDisplayModeKey(event: DisplayModeKeyEvent, typingInInput: boolean): boolean {
    if (typingInInput || event.ctrlKey || event.metaKey || event.altKey) {
        return false;
    }
    return event.key === 'm' || event.key === 'M';
}
