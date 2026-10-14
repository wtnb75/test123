import { corridorFrom, doorCountOf, starGraph, type FloorGraph } from './floorGraph';
import type { Stage } from './types';

/** Which corridor a door leads into, in which direction, and which room is at its other end. */
export type DoorRoute = {
  /** The corridor's index in the floor's graph and map (0: corridor 1, 1: corridor 2 ...). */
  corridor: number;
  /** True from the corridor's first door to its last (first cell to last cell), false on the way back. */
  forward: boolean;
  /** The room the walk ends in (0 for room A, 1 for room B, 2 for room C). */
  to: number;
};

/**
 * The rooms of a floor and which one the player is in (docs/spec/rooms-and-floors.md). A room keeps its opened
 * cells, flags and the player's position while the player is in another one; crossing a door always leaves a room
 * from its door cell, so the player is on that cell when they come back. How the rooms are joined is the floor's
 * graph (default: the start room's door `i` leads to room `i + 1`, the three-room floor).
 */
export class FloorState {
  private readonly rooms: Stage[];
  private readonly graph: FloorGraph;
  private index: number;

  constructor (rooms: readonly Stage[], graph: FloorGraph = starGraph(rooms.length))
  {
    this.rooms = [...rooms];
    this.graph = graph;
    this.index = graph.startRoom;
  }

  /** 0 for room A, 1 for room B, 2 for room C. */
  get roomIndex (): number
  {
    return this.index;
  }

  get current (): Stage
  {
    return this.rooms[this.index];
  }

  /**
   * The walk a door of the current room starts: the corridor that has this door at one end, walked towards the
   * other end. A door index past the room's last used door is the last one; a door no corridor joins throws.
   */
  route (doorIndex = 0): DoorRoute
  {
    const door = Math.min(doorCountOf(this.graph, this.index) - 1, Math.max(0, doorIndex));
    const walk = corridorFrom(this.graph, { room: this.index, door });
    if (!walk) {
      throw new Error(`Door ${door} of room ${this.index} joins no corridor.`);
    }
    return { corridor: walk.corridor, forward: walk.forward, to: walk.to.room };
  }

  /** Stores the state of the room the player is in (the one `current` returned, after the moves made in it). */
  commit (stage: Stage): void
  {
    this.rooms[this.index] = stage;
  }

  /** The player goes through a door of the current room: the room at the other end becomes the current one. */
  cross (doorIndex = 0): Stage
  {
    this.index = this.route(doorIndex).to;
    return this.current;
  }
}
