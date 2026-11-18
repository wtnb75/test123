# STAGE=publish (self) — consumer: the PR reviewer

- Does `README.md` let a stranger understand the goal, rules and controls?
- Is `status_balance` genuinely `done` (user signed off)?
- Is `public/favicon.png` this game's own, not the template's stock icon?
- Does `<game-dir>/package.json` have an `index` (`title`, `summary`,
  `tags`) that matches what the game is now (spec/README), with tags reused
  from the existing games where possible? On a post-publish revision, was it
  re-checked against the change (new mode / input method / pitch)?
- Is the card a playful pitch (`title` as `主役「ひとこと」`, `summary` a short
  jokey line) rather than an earnest description, and does it not promise
  anything the game doesn't do? Are the tags ordered genre → `タッチ` →
  `マウス` → `キーボード`, with `マウス` alongside `タッチ` for pointer games?
- First publish: is the game's line in `LAB_GAMES` (uncommented) and gone
  from `GAMES` — unless the user explicitly asked for the top page? Does
  `docs/backlog.md` exist with the non-MVP / cut items as cards?
  Post-publish revision: the line was already in place — does the diff leave
  `Taskfile.yml` untouched?
- Post-publish revision: does `README.md` reflect the changed rules and
  controls, and does the PR body say what was added and why?
- Is the branch not `main`, and does `git diff --stat origin/main` (what
  is committed plus what is still uncommitted) touch only files that belong
  to this change?
- Autopilot (`<game-dir>/.autopilot.md` exists): does the PR body say it was made
  in autopilot, give the automated-play numbers (or why there are none),
  and list 「未対応の指摘」 and what QA could not confirm? Is the agreement
  file absent from `git status` (ignored), i.e. not in the commit?
- Has the user confirmed the push and the PR — or does the autopilot
  agreement cover them — (and, for a first publish, the
  listing)? `status_publish: done` is written only after that, then
  committed with the change, then pushed — never left on a branch without an
  open PR.
