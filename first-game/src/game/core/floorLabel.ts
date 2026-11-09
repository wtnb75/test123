/** How a floor number is written on screen: floor 5 is `B5F` (docs/spec.md "フロア進行"). */
export const floorLabel = (floorNo: number): string => `B${floorNo}F`;

/** The deepest floor reached for a score (score = floor number - 1), e.g. score 9 -> `B10F`. */
export const depthLabel = (score: number): string => floorLabel(score + 1);
