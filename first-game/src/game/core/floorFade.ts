// The black cover that hides the switch to the next floor (docs/spec/floor-fade.md): it fades out, the next floor is
// generated while the screen is fully dark, the label stays for a moment, then the cover fades in. Pure timeline.

import { advanceCorridor } from './corridor';
import { floorLabel } from './floorLabel';

/** `ClearDelay`: from reaching the stairs until the screen is fully dark. */
export const CLEAR_DELAY_MS = 250;
/** How long the label stays on the dark screen after the next floor was generated. */
export const FADE_HOLD_MS = 500;
/** How long the cover takes to go from opaque to gone. */
export const FADE_IN_MS = 250;
export const FADE_LABEL_SIZE = 48;
export const FADE_COLOR = 0x000000;
/** In front of every other layer of the Scene (the game-over buttons use 50 and 51). */
export const FADE_DEPTH = 100;

/** The label on the dark screen: the number of the floor being entered (`B2F` when leaving B1F). */
export const fadeLabel = (floorNo: number): string => floorLabel(floorNo + 1);

/** Opacity of the cover `elapsedMs` after the stairs were reached (1 once the fade-out is over). */
export const fadeOutAlpha = (elapsedMs: number): number => Math.min(1, Math.max(0, elapsedMs / CLEAR_DELAY_MS));

/** Opacity `elapsedMs` after the fade-in began, or null once the cover is gone. */
export const fadeInAlpha = (elapsedMs: number): number | null =>
  elapsedMs >= FADE_IN_MS ? null : 1 - Math.max(0, elapsedMs) / FADE_IN_MS;

export type FadeStage = 'idle' | 'out' | 'dark' | 'hold' | 'in';

/** What one `update` has to do: draw the cover with `alpha` (null = hide it), generate the next floor, or give input back. */
export interface FadeFrame {
  alpha: number | null;
  generate: boolean;
  resume: boolean;
}

/**
 * out (`ClearDelay`) -> dark (one fully dark frame is drawn) -> generate -> hold (`FADE_HOLD_MS`, counted from the
 * generation) -> in (`FADE_IN_MS`, input is accepted again from its start) -> idle. Like a corridor walk, one frame
 * counts at most `CORRIDOR_MAX_FRAME_MS`; the frame that generated the floor adds nothing to the hold, and the frame
 * that ends the hold starts the fade-in at t = 0 (its own delta is not added to the fade-in).
 */
export class FloorFade {
  private current: FadeStage = 'idle';
  private elapsed = 0;
  private entering = 0;

  get stage (): FadeStage
  {
    return this.current;
  }

  get active (): boolean
  {
    return this.current !== 'idle';
  }

  /** The number of the floor the fade leads to. */
  get nextFloor (): number
  {
    return this.entering;
  }

  /** The stairs were reached on floor `floorNo`: the fade-out begins (this frame is t = 0). */
  start (floorNo: number): void
  {
    this.current = 'out';
    this.elapsed = 0;
    this.entering = floorNo + 1;
  }

  /** Drops the fade (a STAGE jump, a restart): nothing is pending any more. */
  cancel (): void
  {
    this.current = 'idle';
    this.elapsed = 0;
  }

  advance (deltaMs: number): FadeFrame
  {
    switch (this.current) {
    case 'out':
      this.elapsed = advanceCorridor(this.elapsed, deltaMs);
      if (this.elapsed >= CLEAR_DELAY_MS) {
        this.current = 'dark';
        return { alpha: 1, generate: false, resume: false };
      }
      return { alpha: fadeOutAlpha(this.elapsed), generate: false, resume: false };
    case 'dark':
      this.current = 'hold';
      this.elapsed = 0;
      return { alpha: 1, generate: true, resume: false };
    case 'hold':
      this.elapsed = advanceCorridor(this.elapsed, deltaMs);
      if (this.elapsed >= FADE_HOLD_MS) {
        this.current = 'in';
        this.elapsed = 0;
        return { alpha: 1, generate: false, resume: true };
      }
      return { alpha: 1, generate: false, resume: false };
    case 'in': {
      this.elapsed = advanceCorridor(this.elapsed, deltaMs);
      const alpha = fadeInAlpha(this.elapsed);
      if (alpha === null) {
        this.current = 'idle';
      }
      return { alpha, generate: false, resume: false };
    }
    default:
      return { alpha: null, generate: false, resume: false };
    }
  }
}
