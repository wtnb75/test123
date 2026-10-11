// What the Title accepts as input, kept out of the Scene so it can be tested without Phaser
// (docs/spec.md "Title" > "デモ" > 入力). The gate itself is shared with the other games' Titles.

/** Only Space and Enter start the game from the keyboard; a held key (auto-repeat) is ignored. */
export const isStartKey = (code: string, repeat: boolean): boolean =>
    !repeat && (code === 'Space' || code === 'Enter');

/**
 * Guards the one way out of the Title: the first start request wins, and once it has been made the demo must
 * not move any more (a move due in the same frame is not played).
 */
export { StartGate as TitleGate } from 'title-demo';
