import type { ExitTarget } from './floorLayout';
import type { Position, Stage } from './types';
import { roomDoors } from './walls';

/**
 * The exits to point at from a room of a floor (`roomIndex`: 0 for room A, used only for a stage that has no
 * `goalKind`; otherwise the room's own `goalKind` says which kind of room it is) (docs/spec/rooms-and-floors.md "画面外の出口の矢印"),
 * with their centres in px. `origin` is the px position of the room's first cell, `cell` the cell size in px.
 * A room with the down-stairs: the stairs ("GOAL"). Any other room: each of its doors ("DOOR"; a dead end without
 * loop doors has just the one back).
 */
export const roomExits = (stage: Stage, roomIndex: number, origin: Position, cell: number): ExitTarget[] => {
  const centre = (at: Position): Position => ({
    x: origin.x + at.x * cell + cell / 2,
    y: origin.y + at.y * cell + cell / 2
  });
  // The room with the down-stairs points at them only. Every other room (room A, a branching room, a dead end,
  // with or without loop doors) points at each of its doors.
  const hasDown = stage.goalKind === 'down' || (stage.goalKind === undefined && roomIndex !== 0);
  if (hasDown) {
    return [{ ...centre(stage.goal), label: 'GOAL' as const }];
  }
  const doors = roomDoors(stage);
  // A dead end made without a door list still has its one door: the cell it starts on.
  const cells = doors.length === 0 && stage.goalKind === 'none' ? [stage.start] : doors.map((door) => door.cell);
  return cells.map((cell) => ({ ...centre(cell), label: 'DOOR' as const }));
};
