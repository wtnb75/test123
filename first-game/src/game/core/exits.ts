import type { ExitTarget } from './floorLayout';
import type { Position, Stage } from './types';
import { roomDoors } from './walls';

/**
 * The exits to point at from room `roomIndex` (0 = A) of a floor (docs/spec/rooms-and-floors.md "画面外の出口の矢印"),
 * with their centres in px. `origin` is the px position of the room's first cell, `cell` the cell size in px.
 * Room A: each of its doors ("DOOR"). A room with the down-stairs: the stairs ("GOAL"). A dead end: its door back
 * ("DOOR").
 */
export const roomExits = (stage: Stage, roomIndex: number, origin: Position, cell: number): ExitTarget[] => {
  const centre = (at: Position): Position => ({
    x: origin.x + at.x * cell + cell / 2,
    y: origin.y + at.y * cell + cell / 2
  });
  if (roomIndex === 0) {
    return roomDoors(stage).map((door) => ({ ...centre(door.cell), label: 'DOOR' as const }));
  }
  return stage.goalKind === 'none'
    ? [{ ...centre(stage.start), label: 'DOOR' as const }]
    : [{ ...centre(stage.goal), label: 'GOAL' as const }];
};
