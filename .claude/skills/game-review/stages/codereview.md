# STAGE=codereview (self) — consumer: game-qa

- Was the level matched to the size (`game-codereview` "Level by size":
  `medium` and at most 2 rounds for a size-S revision, `high` and at most
  3 otherwise), and does the report say which?
- Did the user make the accept/reject call, once per round, on a table
  with your recommendation — not you alone? (A round from round 2 on where
  every finding was rejected is shown with its reasons and not asked. In
  autopilot — `<game-dir>/.autopilot.md` exists — the triage is yours: were
  **spec** findings left unapplied and listed for the PR body's
  「未対応の指摘」?)
- Were the rejected findings given to the reviewer (from
  `docs/review-rejected.md` and this run) and appended to that file at the
  end?
- Was each finding checked against the code before it was recommended,
  and does every rejected one have a stated reason?
- Does every accepted correctness fix have a regression test that failed
  before the fix?
- Did findings that change player-visible behavior go to `game-spec`
  instead of being fixed straight in code?
- Did the four `game-check` commands pass after the *last* fix?
- Does the diff contain only the accepted fixes (plus the updated
  `docs/review-rejected.md`) — no drive-by refactoring?
- Did the loop end properly (a round with nothing accepted, or the last allowed round
  with the rest handed to the user)?
