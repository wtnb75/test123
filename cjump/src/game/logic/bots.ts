import type { Bot } from './simulation';

// Never jumps.
export const idleBot: Bot = () => false;

// Jumps only when the edge would touch the character on this frame.
export const reflexBot: Bot = (view) => view.willTouch();
