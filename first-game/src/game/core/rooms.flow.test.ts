import { describe, expect, it } from 'vitest';
import { StageFlow } from './flow';
import { DOOR_MESSAGE, ENTER_ROOM_MESSAGE, resultMessage } from './hudText';

describe('the corridor phase of the flow', () => {
  it('starts only from play, once, and takes no board input while it lasts', () => {
    const flow = new StageFlow();

    expect(flow.enterCorridor()).toBe(true);
    expect(flow.phase).toBe('corridor');
    expect(flow.inCorridor).toBe(true);
    expect(flow.playing).toBe(false);
    expect(flow.enterCorridor()).toBe(false);
  });

  it('ends only from the corridor, back to play, once', () => {
    const flow = new StageFlow();

    expect(flow.leaveCorridor()).toBe(false);
    flow.enterCorridor();
    expect(flow.leaveCorridor()).toBe(true);
    expect(flow.playing).toBe(true);
    expect(flow.inCorridor).toBe(false);
    expect(flow.leaveCorridor()).toBe(false);
  });

  it('cannot die or reach the goal in the corridor, and a stage start (STAGE jump) resets it', () => {
    const flow = new StageFlow();
    flow.enterCorridor();

    expect(flow.die()).toBe(false);
    expect(flow.reachGoal()).toBe(false);
    flow.reset();
    expect(flow.phase).toBe('play');
  });

  it('cannot start from the end-of-stage phases', () => {
    const goalFlow = new StageFlow();
    goalFlow.reachGoal();
    const deadFlow = new StageFlow();
    deadFlow.die();

    expect(goalFlow.enterCorridor()).toBe(false);
    expect(deadFlow.enterCorridor()).toBe(false);
  });
});

describe('the messages of the doors (docs/spec/hud.md)', () => {
  it('says the corridor starts when a door was reached, whatever the input kind', () => {
    expect(resultMessage('door', undefined, 0, 'keys')).toBe('You walk down the corridor.');
    expect(resultMessage('door', undefined, 3, 'touch')).toBe(DOOR_MESSAGE);
  });

  it('says a room was entered when the walk is over', () => {
    expect(ENTER_ROOM_MESSAGE).toBe('You enter a room.');
  });

  it('keeps the death and goal messages', () => {
    expect(resultMessage('dead', undefined, 0, 'keys')).toContain('You died.');
    expect(resultMessage('goal', undefined, 0, 'keys')).toBe('You descend the stairs.');
  });
});
