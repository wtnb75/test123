# STAGE=balance (self) — consumer: game-spec (revision) / game-publish

- Is every proposed change a specific number with a reason ("spawn interval
  1.2s → 0.9s, the 3s gap before the first obstacle felt dead")?
- Does the file that owns the element record the reason, not just the
  new number, and is the パラメータ表 updated?
- After an extension: was the existing difficulty curve and pacing judged
  with the new element in play, not only the new element on its own?
- Autopilot (`<game-dir>/.autopilot.md` exists) replaces the user's sign-off: was
  no number changed; for a gameplay change, were the initial numbers
  measured once by automated play (medians, seeds and conditions stated,
  before-numbers beside them where they exist) and handed to
  `game-publish` for the PR body — or is it said why there is nothing to
  measure; and does no number contradict the 変えないもの list?
- Did the user explicitly say the current feel is good enough to ship
  (for a presentation-only revision, in `game-polish`'s combined
  confirmation)?
