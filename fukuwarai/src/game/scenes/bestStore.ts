import { BestStore } from 'best-store';
import { GAME_ID } from '../logic/best';

/**
 * The one best-score store of this page. Title and Result share it because the in-memory fallback
 * (used when localStorage cannot be written) lives in the instance (docs/spec.md 技術要件).
 */
export const bestStore = new BestStore(GAME_ID);
