// Pure rules of the drag editing (docs/spec.md "操作仕様" / "ドラッグ編集"): the cells a drag passes (a straight line
// between two pointer positions), the paint mode of a stroke, what one cell does, and what the stroke tells the status
// line. No DOM, no Phaser; arguments are never mutated.

/** `place` puts mines on the cells passed; `erase` takes them off. Decided by the cell the stroke starts on. */
export type PaintMode = 'place' | 'erase';

/** What painting one cell did: it changed, it already was as wanted, or a mine could not go there (start-cell zone). */
export type PaintOutcome = 'changed' | 'unchanged' | 'skipped';

/** The mode of a stroke that starts on `index`: no mine there means place, a mine means erase. */
export function paintModeAt(mines: readonly boolean[], index: number): PaintMode {
    return mines[index] ? 'erase' : 'place';
}

/** Rounds `|delta| * i / n` half up with integers only, and gives it the sign of `delta`. */
function lineOffset(delta: number, i: number, n: number): number {
    return Math.sign(delta) * Math.floor((2 * Math.abs(delta) * i + n) / (2 * n));
}

/**
 * The cells of the straight line from cell `from` to cell `to` (row-major indices on a board `width` cells wide), both
 * ends included, in walking order. Neighbours in the list touch by side or corner. A half-way position goes to the cell
 * farther from the start (so a line with such a position differs from its own reverse; one without is its reverse).
 */
export function strokeLine(from: number, to: number, width: number): number[] {
    const y0 = Math.floor(from / width);
    const x0 = from % width;
    const dy = Math.floor(to / width) - y0;
    const dx = (to % width) - x0;
    const n = Math.max(Math.abs(dx), Math.abs(dy));
    if (n === 0) {
        return [from];
    }
    const cells: number[] = [];
    for (let i = 0; i <= n; i += 1) {
        cells.push((y0 + lineOffset(dy, i, n)) * width + x0 + lineOffset(dx, i, n));
    }
    return cells;
}

/** A stroke so far: its mode, the distinct cells passed, and how many cells changed and were skipped. */
export type Stroke = {
    mode: PaintMode;
    visited: ReadonlySet<number>;
    changed: number;
    skipped: number;
};

export function beginStroke(mode: PaintMode): Stroke {
    return { mode, visited: new Set<number>(), changed: 0, skipped: 0 };
}

export type VisitResult = { stroke: Stroke; mines: boolean[]; outcome: PaintOutcome };

/**
 * Passes cell `index` in the stroke. `placeable` says whether a mine may stand there (the start-cell rule). A cell
 * already passed does nothing the second time. Place: an empty placeable cell gets a mine (changed), an empty
 * unplaceable one is skipped, a mine is left alone. Erase: a mine is taken off (changed), an empty cell is left alone.
 */
export function visitCell(stroke: Stroke, mines: readonly boolean[], index: number, placeable: boolean): VisitResult {
    if (stroke.visited.has(index)) {
        return { stroke, mines: [...mines], outcome: 'unchanged' };
    }
    const visited = new Set(stroke.visited).add(index);
    let outcome: PaintOutcome = 'unchanged';
    if (stroke.mode === 'place' && !mines[index]) {
        outcome = placeable ? 'changed' : 'skipped';
    } else if (stroke.mode === 'erase' && mines[index]) {
        outcome = 'changed';
    }
    const next = [...mines];
    if (outcome === 'changed') {
        next[index] = stroke.mode === 'place';
    }
    return {
        stroke: {
            mode: stroke.mode,
            visited,
            changed: stroke.changed + (outcome === 'changed' ? 1 : 0),
            skipped: stroke.skipped + (outcome === 'skipped' ? 1 : 0)
        },
        mines: next,
        outcome
    };
}

/** What the status line shows when the stroke ends: nothing new, the old single-cell refusal, or a count summary. */
export type StrokeStatus =
    | { kind: 'none' }
    | { kind: 'single-refused' }
    | { kind: 'summary'; mode: PaintMode; changed: number; skipped: number };

/** The status line text for the end of a drag edit (docs/spec.md "ドラッグ編集"); null leaves the line as it is. */
export function strokeStatusText(status: StrokeStatus): string | null {
    if (status.kind === 'none') {
        return null;
    }
    if (status.kind === 'single-refused') {
        return '開始マス制約: このセルには爆弾を置けません。';
    }
    const skipped = `${status.skipped} マスは開始マス制約で置けませんでした`;
    if (status.changed === 0) {
        return `${skipped}。`;
    }
    const done = status.mode === 'place' ? `${status.changed} マスに爆弾を置きました。` : `${status.changed} マスの爆弾を消しました。`;
    return status.skipped > 0 ? `${done}（${skipped}）` : done;
}

/**
 * One cell passed: as a plain click (success shows nothing, a refused mine shows the start-cell message). Two or more
 * cells: the counts. (Two or more cells with nothing changed and nothing skipped cannot happen: the start cell decides
 * the mode, so it is changed or skipped itself.)
 */
export function strokeStatus(stroke: Stroke): StrokeStatus {
    if (stroke.visited.size < 2) {
        return stroke.skipped > 0 ? { kind: 'single-refused' } : { kind: 'none' };
    }
    return { kind: 'summary', mode: stroke.mode, changed: stroke.changed, skipped: stroke.skipped };
}
