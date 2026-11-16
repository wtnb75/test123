// Which candidate row gets the focus after a row is removed: the row that moved into the removed
// position, or the new last row when the last one was removed. Never throws; 0 when no row is left.
export function focusIndexAfterRemove(removedIndex: number, newCount: number): number {
    return Math.max(0, Math.min(removedIndex, newCount - 1));
}
