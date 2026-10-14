import type { Stage } from './types';

/** Which corridor a door leads into, in which direction, and which room is at its other end. */
export type DoorRoute = {
  /** 0: corridor 1 (room A - room B), 1: corridor 2 (room A - room C). */
  corridor: 0 | 1;
  /** True from room A to the other room (first cell to last cell), false on the way back. */
  forward: boolean;
  /** The room the walk ends in: 0 for room A, 1 for room B, 2 for room C. */
  to: number;
};

/**
 * The three rooms of a floor and which one the player is in (docs/spec/rooms-and-floors.md). A room keeps its
 * opened cells, flags and the player's position while the player is in another one; crossing a door always
 * leaves a room from its door cell, so the player is on that cell when they come back.
 */
export class FloorState {
  private readonly rooms: Stage[];
  private index = 0;

  constructor (rooms: readonly Stage[])
  {
    this.rooms = [...rooms];
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
   * The walk a door of the current room starts. Room A's door `doorIndex` (0 = A1, 1 = A2) leads to room
   * `doorIndex + 1`; room B and room C have one door, back to room A.
   */
  route (doorIndex = 0): DoorRoute
  {
    if (this.index === 0) {
      const to = Math.min(2, Math.max(0, doorIndex)) + 1;
      return { corridor: (to - 1) as 0 | 1, forward: true, to };
    }
    return { corridor: (this.index - 1) as 0 | 1, forward: false, to: 0 };
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
