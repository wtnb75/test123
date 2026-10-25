// The touch controls setting (docs/spec/title.md "「パッド」ボタン", docs/spec.md "隠す設定") and the long press
// (docs/spec.md "長押しでフラグ"). No Phaser.

import { type KeyValueStore, safeGetItem, safeSetItem } from './highScore';

/** The key the setting is saved under (docs/spec.md パラメータ表 "保存キー"). */
export const PAD_SETTING_KEY = 'minefield-rogue-pad';

/** How long a press on an unopened neighbour must last to set its flag (docs/spec.md パラメータ表 `LongPressMs`). */
export const LONG_PRESS_MS = 400;

/** Whether the virtual pad and the FLAG button are hidden. Only the value `hidden` hides them; anything else shows. */
export const readPadHidden = (store: KeyValueStore | null): boolean =>
  safeGetItem(store, PAD_SETTING_KEY) === 'hidden';

/** Saves the setting; false when it could not be saved (the setting then shows the controls again next time). */
export const writePadHidden = (store: KeyValueStore | null, hidden: boolean): boolean =>
  safeSetItem(store, PAD_SETTING_KEY, hidden ? 'hidden' : 'shown');

/** The text of the settings button: the current state (a tap switches it). */
export const padSettingLabel = (hidden: boolean): string => (hidden ? 'パッド: 隠す' : 'パッド: 表示');

/** Whether a press held for `heldMs` is a long press (its release after this time sets no step). */
export const isLongPress = (heldMs: number): boolean => heldMs >= LONG_PRESS_MS;
