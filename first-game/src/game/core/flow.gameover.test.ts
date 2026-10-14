import { describe, expect, it } from 'vitest';
import { StageFlow, gameOverKeyAction } from './flow';

describe('gameOverKeyAction', () => {
  it('on the revealed bombs R retries and T goes to the title at once', () => {
    expect(gameOverKeyAction('gameover', 'KeyR', false)).toBe('retry');
    expect(gameOverKeyAction('gameover', 'KeyT', false)).toBe('title');
  });

  it.each(['Space', 'ArrowUp', 'ShiftLeft', 'ControlLeft', 'Enter'])(
    'on the revealed bombs %s only goes on to the gravestone screen',
    (code) => {
      expect(gameOverKeyAction('gameover', code, false)).toBe('grave');
    }
  );

  it('on the gravestone screen the other keys start a new game, R retries, T goes to the title', () => {
    expect(gameOverKeyAction('grave', 'Space', false)).toBe('new');
    expect(gameOverKeyAction('grave', 'ShiftLeft', false)).toBe('new');
    expect(gameOverKeyAction('grave', 'KeyR', false)).toBe('retry');
    expect(gameOverKeyAction('grave', 'KeyT', false)).toBe('title');
  });

  it.each(['gameover', 'grave'] as const)('%s ignores auto-repeat for every key', (stage) => {
    expect(gameOverKeyAction(stage, 'KeyR', true)).toBe('none');
    expect(gameOverKeyAction(stage, 'KeyT', true)).toBe('none');
    expect(gameOverKeyAction(stage, 'Space', true)).toBe('none');
  });
});

describe('StageFlow gravestone stage', () => {
  const dead = (): StageFlow => {
    const flow = new StageFlow();
    flow.die();
    return flow;
  };

  it('takes game-over input only after DeathDelay, and is not on the gravestone screen yet', () => {
    const flow = dead();
    expect(flow.awaitingRestart).toBe(false);
    expect(flow.showGrave()).toBe(false);
    flow.showRestart();
    expect(flow.phase).toBe('gameover');
    expect(flow.awaitingRestart).toBe(true);
    expect(flow.onGrave).toBe(false);
  });

  it('goes on to the gravestone screen only once', () => {
    const flow = dead();
    flow.showRestart();
    expect(flow.showGrave()).toBe(true);
    expect(flow.showGrave()).toBe(false);
    expect(flow.phase).toBe('grave');
    expect(flow.onGrave).toBe(true);
    expect(flow.awaitingRestart).toBe(true);
  });

  it('accepts one restart from the revealed bombs (R / T) and one from the gravestone screen', () => {
    const early = dead();
    early.showRestart();
    expect(early.beginRestart()).toBe(true);
    expect(early.beginRestart()).toBe(false);

    const late = dead();
    late.showRestart();
    late.showGrave();
    expect(late.beginRestart()).toBe(true);
    expect(late.beginRestart()).toBe(false);
    expect(late.showGrave()).toBe(false);
  });

  it('cannot begin a restart during DeathDelay', () => {
    expect(dead().beginRestart()).toBe(false);
  });

  it('a STAGE jump from the gravestone screen resets to play', () => {
    const flow = dead();
    flow.showRestart();
    flow.showGrave();
    flow.reset();
    expect(flow.playing).toBe(true);
    expect(flow.onGrave).toBe(false);
    expect(flow.awaitingRestart).toBe(false);
  });
});
