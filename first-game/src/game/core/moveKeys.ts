// The rogue-style movement keys h j k l y u b n (docs/spec.md "移動キーの対応"). Pure: no Phaser.
import type { Position } from './types';

/** Keys by physical position (`KeyboardEvent.code`): h left, j down, k up, l right, y up-left, u up-right, b down-left, n down-right. */
const VI_KEY_DIRECTIONS = new Map<string, Position>([
  ['KeyH', { x: -1, y: 0 }],
  ['KeyJ', { x: 0, y: 1 }],
  ['KeyK', { x: 0, y: -1 }],
  ['KeyL', { x: 1, y: 0 }],
  ['KeyY', { x: -1, y: -1 }],
  ['KeyU', { x: 1, y: -1 }],
  ['KeyB', { x: -1, y: 1 }],
  ['KeyN', { x: 1, y: 1 }]
]);

/** A key press as the game needs it: the physical key and the time the browser gave it. */
export type KeyPress = { code: string; timeStamp: number };

/** The direction of a hjklyubn key, or null for any other code. */
export const viKeyDirection = (code: string): Position | null => VI_KEY_DIRECTIONS.get(code) ?? null;

/** Ctrl, Alt or Meta with a hjklyubn key: it moves nothing and changes no flag, and the browser keeps its own action. */
export const isBlockedViKey = (code: string, modifiers: { ctrlKey: boolean; altKey: boolean; metaKey: boolean }): boolean =>
  VI_KEY_DIRECTIONS.has(code) && (modifiers.ctrlKey || modifiers.altKey || modifiers.metaKey);

/** True when `press` is the same press as `last` (the same code at the same time stamp): a second report, not handled again. */
export const isRepeatedPress = (last: KeyPress | undefined, press: KeyPress): boolean =>
  last !== undefined && last.code === press.code && last.timeStamp === press.timeStamp;
