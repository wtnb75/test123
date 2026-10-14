import type { Stage, StageDoor } from './types';
import { roomDoors } from './walls';

/** One door of one room: `door` indexes the room's doors (`roomDoors`; 0 when the room has one). */
export type FloorDoorRef = { room: number; door: number };

/** A corridor joins two doors. Its shape is walked from `from` to `to`; going the other way reverses it. */
export type FloorCorridorLink = { from: FloorDoorRef; to: FloorDoorRef };

/**
 * How the rooms of a floor are joined (docs/spec/rooms-and-floors.md "フロアのデータ"): the room the player starts in
 * and the corridors, each between two doors. The rooms (with their doors) are the floor's `Stage`s; corridor `k` of
 * the graph is corridor `k` of the floor's map. Nothing here knows how many rooms or doors there are.
 */
export type FloorGraph = {
  startRoom: number;
  corridors: FloorCorridorLink[];
};

/**
 * The floor of the first game: room 0 has one door per other room (door `i` joins it to room `i + 1`), and each
 * other room has one door back to room 0.
 */
export const starGraph = (roomCount: number): FloorGraph => ({
  startRoom: 0,
  corridors: Array.from({ length: Math.max(0, roomCount - 1) }, (_, i) => ({
    from: { room: 0, door: i },
    to: { room: i + 1, door: 0 }
  }))
});

/** Every door of the floor in room order, each room's doors first door first (room A: A1, A2; then B, C). */
export const floorDoors = (rooms: readonly Stage[]): (StageDoor & FloorDoorRef)[] =>
  rooms.flatMap((room, index) =>
    roomDoors(room).map((door, doorIndex) => ({ ...door, room: index, door: doorIndex }))
  );

const sameDoor = (a: FloorDoorRef, b: FloorDoorRef): boolean => a.room === b.room && a.door === b.door;

/** The corridor that starts at `door` of `room` and how it is walked from there, or `undefined` for a door that joins nothing. */
export const corridorFrom = (
  graph: FloorGraph,
  at: FloorDoorRef
): { corridor: number; forward: boolean; to: FloorDoorRef } | undefined => {
  for (let corridor = 0; corridor < graph.corridors.length; corridor += 1) {
    const link = graph.corridors[corridor];
    if (sameDoor(link.from, at)) {
      return { corridor, forward: true, to: link.to };
    }
    if (sameDoor(link.to, at)) {
      return { corridor, forward: false, to: link.from };
    }
  }
  return undefined;
};

/** How many doors of `room` the graph's corridors use (at least 1). */
export const doorCountOf = (graph: FloorGraph, room: number): number => {
  let count = 1;
  for (const link of graph.corridors) {
    for (const end of [link.from, link.to]) {
      if (end.room === room) {
        count = Math.max(count, end.door + 1);
      }
    }
  }
  return count;
};
