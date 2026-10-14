// What the virtual pad and the FLAG button look like (docs/spec.md "仮想パッドと FLAG の見た目"). No Phaser.

/** The pad direction is decided from this distance to the base centre (same as the tap / repeat threshold). */
export const PAD_DIRECTION_THRESHOLD = 14;
/** Opacity of the lit sector: before the first repeat, and once a repeat has fired during this press. */
export const PAD_SECTOR_ALPHA_CHARGE = 0.35;
export const PAD_SECTOR_ALPHA_REPEAT = 0.7;
/** Width of the FLAG button's frame (px). */
export const FLAG_OFF_STROKE_WIDTH = 2;
export const FLAG_ON_STROKE_WIDTH = 4;

/** Blue while FLAG is off, green while it is on: the pad frame, the thumb and the lit sector share it. */
export type PadTheme = 'blue' | 'green';

export const padThemeOf = (flagOn: boolean): PadTheme => (flagOn ? 'green' : 'blue');

/** The 8 directions are numbered clockwise from east (screen coordinates, y down): 0 E, 1 SE, 2 S ... 7 NE. */
export const sectorOfAngle = (degrees: number): number => {
  const deg = ((degrees % 360) + 360) % 360;
  return Math.round(deg / 45) % 8;
};

/** The sector a press at (dx, dy) from the base centre selects, or null under the threshold. */
export const padSectorOf = (dx: number, dy: number): number | null => {
  if (Math.hypot(dx, dy) < PAD_DIRECTION_THRESHOLD) {
    return null;
  }
  return sectorOfAngle((Math.atan2(dy, dx) * 180) / Math.PI);
};

/** Opacity of the lit sector: thin while the repeat is still charging, thick once a repeat fired in this press. */
export const padSectorAlpha = (repeatFired: boolean): number =>
  repeatFired ? PAD_SECTOR_ALPHA_REPEAT : PAD_SECTOR_ALPHA_CHARGE;

/** Colours (delegated by the spec) of the pad frame, thumb and lit sector, and of the FLAG button, per theme. */
export const PAD_COLORS: Record<PadTheme, { frame: number; thumbFill: number; thumbStroke: number; sector: number }> = {
  blue: { frame: 0x3b82f6, thumbFill: 0x2563eb, thumbStroke: 0x93c5fd, sector: 0x60a5fa },
  green: { frame: 0x22c55e, thumbFill: 0x16a34a, thumbStroke: 0x86efac, sector: 0x4ade80 }
};
export const FLAG_ON_FILL = 0x22c55e;
export const FLAG_ON_STROKE = 0xdcfce7;
export const FLAG_ON_LABEL_COLOR = '#052e16';

/** Start and end angle (radians, clockwise from east, y down: what a canvas arc takes) of a sector: its direction ±22.5°. */
export const padSectorArc = (sector: number): { start: number; end: number } => {
  const centre = (sector * 45 * Math.PI) / 180;
  const half = (22.5 * Math.PI) / 180;
  return { start: centre - half, end: centre + half };
};

/** The frame is drawn inside the circle so the outline does not grow: the circle shrinks by the extra width. */
export const flagCircleSize = (size: number, flagOn: boolean): number =>
  flagOn ? size - (FLAG_ON_STROKE_WIDTH - FLAG_OFF_STROKE_WIDTH) : size;
