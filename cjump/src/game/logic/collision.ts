export function isTouchingEdge(
    px: number,
    py: number,
    cx: number,
    cy: number,
    radius: number,
    tolerance: number
): boolean {
    const distance = Math.hypot(px - cx, py - cy);
    return Math.abs(distance - radius) < tolerance;
}
