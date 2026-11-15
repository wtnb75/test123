# game-spec: splitting an existing spec

Run this as a `game-spec` revision, on its own branch:

- Branch from `origin/main` (`git fetch origin && git checkout --no-track -b
  <branch> origin/main`): `docs/<game-dir>-split-spec` (next free `-2`, `-3`,
  ... if taken).
- Move only descriptions of self-contained elements (modes, stage sets,
  systems, Scenes) into `docs/spec/<slug>.md`. The AGENTS.md 2.4 required
  items for the base game stay in `docs/spec.md`. Move text verbatim —
  don't rewrite it.
- Because behavior doesn't change, this is the one revision that does
  **not** run the downstream reset below. Instead, run
  `game-review STAGE=spec` to confirm nothing was lost or duplicated and
  every link resolves, then commit and open a docs-only PR (confirm with
  the user before pushing/opening it).
- Once it merges, restart `game-extend`.
