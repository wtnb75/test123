---
name: game-title
description: Use when the user wants a Title screen with a demo (a bot playing in the background or a short replay of the game) added to an already-published game in this monorepo — decides how the demo is made, how the Title is laid out down to the smallest phone screens, and what must not change, then hands off to game-spec. Conversation only; no files touched.
---

# game-title

The entry point for putting a Title (name, START, controls) and a demo of
the game behind or beside it onto a published game. It is the sibling of
`game-extend` for one recurring kind of change: **presentation-only**, no
rule, score or number of the game changes, and the work is the same shape
every time (see `docs/title-demo-survey.md` and the games already done:
first-game, pushline, spotdiff, primtris, digdle, calc1, absorb).

Like `game-extend`, this is a conversation, not an implementation step: no
files are touched and no `status_*` key is written here. Once the user
approves, `game-spec` opens the branch, writes `docs/spec/title-demo.md`
and resets the downstream stages, and the normal impl → … → publish chain
runs again.

Read `shared/title-demo/README.md` first — it holds the shared parts
(`DemoDirector`, `TitleDemoRunner`, the spec template, the "real game in
the background" pattern and its pitfalls) and is the source of truth for
how the demo is built. This skill decides *this game's* choices.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:dashboard`, list the
  games with `next=complete`, and ask the user to pick one.
- Requires `status_publish: done` (same rules as `game-extend`: `absent` →
  out of scope, unfinished revision → finish it via `game-next` first).
- If the game already has a Title and a demo (`title-demo` in its
  `package.json` and a `docs/spec/title-demo.md`), this is not the skill:
  a change to the demo is a `game-extend` / `game-polish` change.

## Process

Ask one question at a time. Recommend an answer for each.

1. **Understand the game.** Read its spec (`docs/spec.md` and linked
   files), `README.md`, `docs/backlog.md` and `src/game/main.ts`. Find out
   and note, because they decide the work:
   - the Scenes and the first one (is there already a Title? what does it
     hold — selections such as difficulty or mode make the layout hard);
   - how the screen size is decided (fixed, or computed from the window at
     Scene start — then the Title must decide it the same way);
   - whether the game's Scene reads `this.time.now` (a Title in front of
     it leaves that clock stale — calc1's lost first-round time);
   - how much of the rules is pure logic a bot can drive without Phaser.
2. **Choose the method.** Offer these three with their cost and a
   recommendation, and let the user choose:
   - **Replay-style demo** (a reduced board redrawn by the Title, a bot
     picking moves; first-game, pushline, spotdiff, primtris, digdle,
     calc1) — needs a bot over the game's pure logic and a drawing of the
     board in the Title; cost S–M; the demo's look is its own drawing.
   - **The real game in the background** (a `Game` subclass played by a
     bot; absorb) — needs hooks in the `Game` Scene and a bot over the
     World; cost M–L; the look is exactly the game's. Only for real-time
     games whose Scene can run without input.
   - **Title without demo** — just the Title (name, START, controls);
     cost S. Right when the game is a tool, or the demo would cost more
     than it shows.
   If the game has no Title, say that the new Title and the demo are one
   change here (as digdle, calc1 and absorb were), unless the Title alone
   is already worth a PR; ask which.
3. **Lay out the Title for the smallest screens**, before anything else
   is designed. Work out, by hand, a table of game size → scale factor →
   positions for at least: iPhone SE Safari portrait 375 × 550, landscape
   667 × 310, phone portrait 390 × 844, PC 1280 × 720, and the border where
   a demo no longer fits (1 px either side). Say what happens when the demo
   does not fit (hidden, or the layout changes). Text and the START button
   get small on the smallest screens: say how small, and that Space / Enter
   also start.
   Keep the Title's texts and button and the demo in separate regions by
   default (name on top, the demo shrunk into a framed window, START
   below). Laying the demo behind the texts is only for a Title with little
   text, and then the layout table gets a row "what overlaps the demo?"
   with the answer. A Title that had only a name, a description and START
   must not end up with text on top of a moving demo (minoclimb: the user
   asked for a window after the background layout was built).
4. **The bot** (methods 1 and 2). Rules of thumb from `shared/title-demo/
   README.md`: a pure function of the game's state; random numbers injected
   or none; it must look alive — not still, not repeating the same move
   (a roaming target in real-time games, a few wrong moves in puzzle
   games); a quality bar written as properties (survives the whole run,
   shows the key move N times, covers the screen) rather than a
   demonstration.
   Before recommending a bot, try a first draft: a throwaway Vitest file
   (not a deliverable; remove it with `git clean`) that plays the game's
   pure logic for ~40 seeds and prints survival and the key counts. Put the
   measured numbers into the summary. "This skill touches no files" means
   no deliverable files.
5. **Decide what must not change.** The game's rules, scoring, difficulty,
   controls and their feel; the existing transitions (Game → Result →
   Game); the time the player gets once START is pressed, however long they
   stayed on the Title. Any existing behavior that *will* change (the first
   Scene, the start of the game) is agreed as such.
6. **Check the size.** If it does not fit one PR (a new Title, a demo
   method that needs a big restructuring of the Game Scene, a selection UI
   that must be redesigned), cut it down: the Title first, the demo as the
   next cycle. If the existing `Game` Scene has to be restructured beyond
   small hooks, say so and get agreement.
7. **Where it goes in the spec**: always `docs/spec/title-demo.md` (the
   template is in `shared/title-demo/README.md`), plus the Scene table and
   the `## 拡張` line in `docs/spec.md`. Branch slug: `title-demo` →
   `feat/<game-dir>-title-demo` (check it does not collide).
8. Run `game-review STAGE=title PACKAGE=<game-dir>` (a self-review) and
   fix what is already agreed; ask the gaps in one batch.
9. **Summarize the agreement in one block** and get explicit approval:
   method and why, the Title's content, the layout table's headline
   numbers, the bot's behavior and quality bar, what must not change,
   spec location and branch slug, and what is left for later (back to
   Title from the result screen, a demo for selections, ...).

## Handoff

Invoke `game-spec` with `PACKAGE=<game-dir>` and the summary. It is a
post-publish revision, classified **presentation-only**: polish, balance
and the PR confirmation come as one question later (`game-polish`
"Presentation-only revisions"). Add these to the hand-over so they land
in the spec (as 完了条件 / テスト観点 and a "must not change" list), because
the downstream stages read only the spec:

- **test**: the bot and the layout are pure logic — hand-worked examples
  for every branch of the bot and every row of the layout table, the
  quality properties over seeded runs (count what you claim: releases the
  bot pressed, not automatic ones), the run clock as a timeline of times.
  The game's existing tests are not changed.
- **codereview**: clean-up after restarts (the demo rebuilt five times
  leaves the same number of listeners and timers; Title's keys and
  captures released on shutdown), no change to the normal path (`Game` →
  `GameOver` → `Game`), the Scene's clock not derived from `time.now`.
- **qa**: `scripts/qa/title-viewports.mjs` (add `"fresh": true` where the
  size is decided at Title start) and `scripts/qa/title-start.mjs` (START
  by Enter / Space / click after a long idle, the game starts from its
  start; the demo's cycle), plus the usual phone / PC shots and the shared
  build. Offer the user a check on a real device (`scripts/qa/share.sh`,
  AGENTS.md 9.1) — the demo's motion is judged by eye.

This skill still touches no files. The candidates the user did not pick go
into the summary's "left for later" list; `game-spec` records them in
`<game-dir>/docs/backlog.md`.
