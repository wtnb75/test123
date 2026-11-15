# STAGE=title (self) — consumer: game-spec

Before summarizing the agreed Title and demo to the user:

- Is `status_publish` `done`, and does the game not already have a demo
  (`title-demo` in `package.json`, `docs/spec/title-demo.md`)?
- Was the method chosen from the three offered with their cost (replay-style
  demo / the real game in the background / Title without demo), and is the
  reason stated?
- Was it checked how the screen size is decided and whether the game's
  Scene uses `this.time.now`? Is "the time after START is unchanged, however
  long the Title was shown" in the must-not-change list?
- Is there a hand-worked layout table covering 375 × 550, 667 × 310,
  390 × 844, 1280 × 720 and the border where the demo no longer fits — and
  what happens when it does not fit (hidden / changed layout)?
- Is the bot described as a pure function with injected or no randomness,
  with a way to look alive (not still, not one repeated move) and a quality
  bar written as properties?
- Does the must-not-change list name the rules, scoring, difficulty,
  controls and the existing transitions?
- Is it classified presentation-only, in one PR (or cut: Title first, demo
  later) — and if the `Game` Scene needs more than small hooks, was the user
  told?
- Is the spec location `docs/spec/title-demo.md` (+ Scene table and `## 拡張`
  line in `docs/spec.md`), and the branch slug free?
- Are the downstream notes (test / codereview / qa) in the hand-over, and
  was a real-device check offered?
