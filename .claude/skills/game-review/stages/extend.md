# STAGE=extend (self) — consumer: game-spec

Before summarizing the agreed extension to the user:

- Is `status_publish` `done`? If not, did the user get the right reason
  (untracked / unfinished revision / not yet shipped)?
- Is it exactly one extension? Were the others split off and named as
  later cycles?
- Is the reason a concrete problem with the current game (what feels
  missing or dull), not just "more content"?
- Is its effect on the core loop stated (deepens it / widens it)?
- Are added or changed controls stated, or explicitly "none"?
- Is the direction for looks and initial numbers stated?
- Is there an explicit "must not change" list (controls feel, rules,
  scoring, difficulty), and is every intended change to existing behavior
  agreed as such?
- Does it fit one PR? If code structure has to change, was the user told?
- Is the spec location decided by the `game-spec` "Spec layout" rule
  (a new `docs/spec/<slug>.md` vs. editing `docs/spec.md`)? If
  `docs/spec.md` is over 400 lines, was the separate split cycle offered?
- Is there a branch name `<type>/<game-dir>-<slug>` that doesn't collide
  with an existing branch (checked after `git fetch --prune origin`), with
  `refactor` as the type when nothing player-visible changes and `feat`
  otherwise?
- `MODE=pin`: is the agreement going into the card (状態 / 合意, every
  line filled, written for a reader without this conversation) rather
  than to `game-spec`, with no feature branch and no `status_*` change?
  In a pin sweep (`PACKAGE=all`): was the queue shown once with the games
  left out and why (work in flight / open backlog PR / already has a 着手可
  card), and is each approved card committed before the next game starts?
- Is it classified presentation-only or gameplay?
- Were candidates offered from `docs/backlog.md` top-down (if it exists), and
  are the ones left for later listed in the summary for `game-spec` to record?
- If it joins places in the game's space, is the join shown with a
  hand-worked example for at least two exits or edges, with the
  arrival where the walk leads?
