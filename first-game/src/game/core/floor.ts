import type { Stage } from './types';

/**
 * The two rooms of a floor and which one the player is in (docs/spec/rooms-and-floors.md). A room keeps its
 * opened cells, flags and the player's position while the player is in the other one; crossing a door always
 * leaves a room from its door cell, so the player is on that cell when they come back.
 */
export class FloorState {
  private readonly rooms: Stage[];
  private index = 0;

  constructor (rooms: readonly Stage[])
  {
    this.rooms = [...rooms];
  }

  /** 0 for room A, 1 for room B. */
  get roomIndex (): number
  {
    return this.index;
  }

  get current (): Stage
  {
    return this.rooms[this.index];
  }

  /** The room the other door leads to. */
  get otherIndex (): number
  {
    return 1 - this.index;
  }

  /** Stores the state of the room the player is in (the one `current` returned, after the moves made in it). */
  commit (stage: Stage): void
  {
    this.rooms[this.index] = stage;
  }

  /** The player goes through the door: the other room becomes the current one. */
  cross (): Stage
  {
    this.index = this.otherIndex;
    return this.current;
  }
}
