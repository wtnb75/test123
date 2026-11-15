# STAGE=polish (self) — consumer: game-balance

- Was every Scene/state looked at on both a desktop and a phone-sized
  viewport, with bursts of frames for effects and transitions?
- Is each implemented change one the user picked, recorded in the file
  that owns it (演出・UI / パラメータ表 / 実装裁量) before it was
  implemented?
- Did anything with gameplay weight (speed, hit box, timing window,
  scoring) sneak in? That belongs to `game-balance` — back it out.
- Do effects leave input responsive, and are emitters/tweens/texts created
  once rather than per frame?
- Can a first-time player tell what to touch first and how to retry,
  from the screenshots alone?
- Are `<title>` and `favicon.png` this game's own?
- Did QA pass again on the polished version, and did the user confirm the
  look with before/after screenshots?
- Autopilot (`<game-dir>/.autopilot.md` exists) replaces the items above that
  need the user: were QA's screenshots of the affected Scenes checked
  against AGENTS.md 4.6 at the four sizes (no second container run for
  the same pictures), was nothing added beyond fixes to cut-off text,
  overlap and small targets, and was no proposal made?
- Presentation-only revision settled in one confirmation: did that
  question cover the look, the unchanged feel and the PR, and did the user
  answer all three?
