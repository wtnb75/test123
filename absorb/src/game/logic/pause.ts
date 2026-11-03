import { PauseState } from 'pause';
import { MAX_DT } from './constants';
import { RETRY_KEY_CODES } from './retry';

/** The shared auto-pause, set to this game's frame cap and to the keys that release (and so resume). */
export function createPause(): PauseState {
    return new PauseState({ maxDt: MAX_DT, resumeKeyCodes: RETRY_KEY_CODES });
}
