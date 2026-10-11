// Pure state of the end-of-stage flow and of presses, so the rules in docs/spec.md can be unit tested.

import type { RestartChoice } from './restartButtons';

/** What a key does on the game-over screen: R retries, T goes to the title, any other key starts a new game, a held key does nothing. */
export type RestartAction = RestartChoice | 'none';

export const restartKeyAction = (code: string, repeat: boolean): RestartAction => {
  if (repeat) {
    return 'none';
  }
  if (code === 'KeyR') {
    return 'retry';
  }
  return code === 'KeyT' ? 'title' : 'new';
};

/**
 * `play` -> (goal) `clearing` -> next stage starts -> `play`; `play` -> (death) `dying` -> (after DeathDelay)
 * `gameover` -> RETRY / STAGE jump -> `play`; `gameover` -> NEW GAME / TITLE -> `restarting` until the Scene is
 * created again (`Game.create` calls `reset`; `Title` never looks at this flow). `restarting` is the moment between
 * choosing a restart or leaving and the next Scene. Only `play` accepts board input.
 */
export type FlowPhase = 'play' | 'clearing' | 'dying' | 'gameover' | 'restarting';

export class StageFlow {
  phase: FlowPhase = 'play';

  get playing (): boolean
  {
    return this.phase === 'play';
  }

  get awaitingRestart (): boolean
  {
    return this.phase === 'gameover';
  }

  /** The goal was reached. True only the first time: the caller then schedules the one next-stage start. */
  reachGoal (): boolean
  {
    if (this.phase !== 'play') {
      return false;
    }
    this.phase = 'clearing';
    return true;
  }

  /** The player died. True only when this call started the ending. */
  die (): boolean
  {
    if (this.phase !== 'play') {
      return false;
    }
    this.phase = 'dying';
    return true;
  }

  /** DeathDelay is over: RETRY / NEW GAME are offered. Only valid right after a death. */
  showRestart (): boolean
  {
    if (this.phase !== 'dying') {
      return false;
    }
    this.phase = 'gameover';
    return true;
  }

  /** RETRY / NEW GAME was chosen. True only once, so a second input cannot start another restart. */
  beginRestart (): boolean
  {
    if (this.phase !== 'gameover') {
      return false;
    }
    this.phase = 'restarting';
    return true;
  }

  /** A stage has started (next stage, RETRY, NEW GAME, STAGE jump): input is accepted again. */
  reset (): void
  {
    this.phase = 'play';
  }
}

/** `restart` is a press on the game-over screen; `button` is FLAG / STAGE (it never acts on release). */
export type PressKind = 'board' | 'pad' | 'restart' | 'button';

/**
 * Which presses were accepted on pointer down. A release acts only for an accepted press of the same
 * "generation": `clear()` (death, goal, STAGE jump) forgets all of them, so a finger that went down before
 * is ignored when it lifts. A press on a button, or one that was cancelled, never acts.
 */
export class PressTracker {
  private readonly presses = new Map<number, PressKind>();

  begin (pointerId: number, kind: PressKind): void
  {
    this.presses.set(pointerId, kind);
  }

  /** The accepted press this release belongs to, or null when it must do nothing. */
  end (pointerId: number): Exclude<PressKind, 'button'> | null
  {
    const kind = this.presses.get(pointerId);
    this.presses.delete(pointerId);
    return kind === undefined || kind === 'button' ? null : kind;
  }

  /** True while an accepted press of this kind is held by the pointer. */
  holds (pointerId: number, kind: PressKind): boolean
  {
    return this.presses.get(pointerId) === kind;
  }

  /** A touch the system cancelled: forgotten, it never acts. */
  cancel (pointerId: number): void
  {
    this.presses.delete(pointerId);
  }

  clear (): void
  {
    this.presses.clear();
  }
}
