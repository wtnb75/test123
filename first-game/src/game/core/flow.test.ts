import { describe, expect, it } from 'vitest';
import { PressTracker, StageFlow, restartKeyAction } from './flow';

describe('restartKeyAction', () => {
  it('ignores auto-repeat for every key', () => {
    expect(restartKeyAction('KeyR', true)).toBe('none');
    expect(restartKeyAction('ArrowUp', true)).toBe('none');
  });

  it('retries on a fresh R and starts a new game on any other fresh key', () => {
    expect(restartKeyAction('KeyR', false)).toBe('retry');
    expect(restartKeyAction('ArrowUp', false)).toBe('new');
    expect(restartKeyAction('ShiftLeft', false)).toBe('new');
  });
});

describe('StageFlow', () => {
  it('accepts a goal only once, so the next stage is scheduled once', () => {
    const flow = new StageFlow();
    expect(flow.reachGoal()).toBe(true);
    expect(flow.reachGoal()).toBe(false);
    expect(flow.playing).toBe(false);
  });

  it('does not die on an already cleared stage', () => {
    const flow = new StageFlow();
    flow.reachGoal();
    expect(flow.die()).toBe(false);
  });

  it('cannot reach the goal after dying', () => {
    const flow = new StageFlow();
    expect(flow.die()).toBe(true);
    expect(flow.reachGoal()).toBe(false);
    expect(flow.die()).toBe(false);
  });

  it('ignores board input while dying', () => {
    const flow = new StageFlow();
    flow.die();
    expect(flow.playing).toBe(false);
  });

  it('a STAGE jump during DeathDelay cancels the pending restart offer', () => {
    const flow = new StageFlow();
    flow.die();
    flow.reset();
    expect(flow.playing).toBe(true);
    expect(flow.showRestart()).toBe(false);
  });

  it('a STAGE jump during ClearDelay allows a new goal later', () => {
    const flow = new StageFlow();
    flow.reachGoal();
    flow.reset();
    expect(flow.playing).toBe(true);
    expect(flow.reachGoal()).toBe(true);
  });

  it('accepts only one restart until a stage starts', () => {
    const flow = new StageFlow();
    flow.die();
    flow.showRestart();
    expect(flow.beginRestart()).toBe(true);
    expect(flow.beginRestart()).toBe(false);
    expect(flow.playing).toBe(false);
    expect(flow.awaitingRestart).toBe(false);
    flow.reset();
    expect(flow.playing).toBe(true);
  });

  it('cannot begin a restart before the buttons are offered', () => {
    const flow = new StageFlow();
    expect(flow.beginRestart()).toBe(false);
    flow.die();
    expect(flow.beginRestart()).toBe(false);
  });

  it('does not offer restart for a cleared stage', () => {
    const flow = new StageFlow();
    flow.reachGoal();
    expect(flow.showRestart()).toBe(false);
    expect(flow.awaitingRestart).toBe(false);
  });

  it('offers restart only after a death and accepts input again after reset', () => {
    const flow = new StageFlow();
    expect(flow.showRestart()).toBe(false);
    flow.die();
    expect(flow.awaitingRestart).toBe(false);
    expect(flow.showRestart()).toBe(true);
    expect(flow.awaitingRestart).toBe(true);
    flow.reset();
    expect(flow.playing).toBe(true);
    expect(flow.awaitingRestart).toBe(false);
  });
});

describe('PressTracker', () => {
  it('acts on release only for a press accepted on the board or the pad', () => {
    const presses = new PressTracker();
    presses.begin(1, 'board');
    presses.begin(2, 'pad');
    presses.begin(3, 'button');
    presses.begin(4, 'restart');
    expect(presses.end(1)).toBe('board');
    expect(presses.end(2)).toBe('pad');
    expect(presses.end(3)).toBeNull();
    expect(presses.end(4)).toBe('restart');
  });

  it('ignores a release whose press was never accepted', () => {
    expect(new PressTracker().end(9)).toBeNull();
  });

  it('forgets presses on clear (death, goal, STAGE jump)', () => {
    const presses = new PressTracker();
    presses.begin(1, 'board');
    presses.clear();
    expect(presses.end(1)).toBeNull();
  });

  it('forgets a cancelled press', () => {
    const presses = new PressTracker();
    presses.begin(1, 'pad');
    presses.cancel(1);
    expect(presses.end(1)).toBeNull();
  });

  it('reports whether a pointer holds an accepted press of a kind', () => {
    const presses = new PressTracker();
    presses.begin(1, 'board');
    expect(presses.holds(1, 'board')).toBe(true);
    expect(presses.holds(1, 'pad')).toBe(false);
    presses.clear();
    expect(presses.holds(1, 'board')).toBe(false);
  });

  it('cancelling one pointer leaves the presses of other pointers intact', () => {
    const presses = new PressTracker();
    presses.begin(1, 'pad');
    presses.begin(2, 'board');
    presses.cancel(1);
    expect(presses.end(2)).toBe('board');
  });

  it('acts once per press', () => {
    const presses = new PressTracker();
    presses.begin(1, 'board');
    presses.end(1);
    expect(presses.end(1)).toBeNull();
  });
});
