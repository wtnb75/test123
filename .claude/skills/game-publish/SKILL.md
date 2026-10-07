---
name: game-publish
description: Use for the final step of adding a finished game to this monorepo's public listing — uncommenting it in Taskfile.yml's GAMES list and opening a "add one game" PR (AGENTS.md section 2.2) — or, for a post-publish revision (fix/balance/extension), checking README and opening that revision's PR.
---

# game-publish

Add `<game-dir>` to the public top-page listing and open a PR for it. This
is the last workflow stage — only run it once balance has been signed off
by the user. For a post-publish revision, the listing is already done —
the "one thing" this stage scopes to is that revision (fix/balance/
extension), not the original add.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.
- Requires `status_balance: done` for this game.

## Steps

`task game:status:set PACKAGE=<game-dir> STAGE=publish VALUE=in_progress`

1. Confirm `<game-dir>/README.md` documents purpose, rules, and controls
   (AGENTS.md 4.1 — required, not optional).
2. Confirm the game has its own favicon:
   `cmp -s <game-dir>/public/favicon.png scaffold/base-template/public/favicon.png`
   succeeding means it's still the template's stock icon — run
   `task game:favicon PACKAGE=<game-dir>` and include the result in this
   change.
3. **First publish**: this is a user-visible change (it adds a link on the
   public top page) — confirm with the user before touching
   `Taskfile.yml`, then uncomment the `<game-dir>` line under `GAMES:` in
   `Taskfile.yml`.
4. **Post-publish revision** (on a `<type>/<game-dir>-<slug>` branch): the
   `GAMES` line is already uncommented — leave `Taskfile.yml` alone.
   Instead check that `README.md` reflects the changed rules and controls,
   and update it in this change if it doesn't.

For a post-publish revision, also check `<game-dir>/docs/backlog.md` is in
the change if `game-spec` updated it.

`task build` / `output/index.html` verification is CI's job, not this
skill's — don't run it here (confirmed with the user: this repo's CI
builds and verifies the top-page output on its own).

### Opening the PR

The finished PR's content should be scoped to exactly one thing: adding
`<game-dir>` (first publish), or that one revision (post-publish). Confirm
with the user before pushing anything or opening the PR (unless the
user already agreed to it in `game-polish`'s combined confirmation for a
presentation-only revision) — pushing and PR
creation are both visible, and this skill has no standing authorization to
do them silently.

By this point you should already be on a dedicated branch for this game
(`feat/<game-dir>` from `game-init` for a first publish, or a
`<type>/<game-dir>-<slug>` branch from `game-spec` for a post-publish
revision — see that skill) — **not** `main`. If you're on `main`, stop:
something upstream skipped its branch step, and committing here would mix
this game with whatever else is on `main`. Don't improvise a fix by
hand-picking hunks; go back and create the branch that skill should have
created, from `origin/main` (`git fetch origin && git checkout -b <branch>
origin/main`), then return here.

### Order of the steps (the status key is part of the PR)

`status_publish` lives in `<game-dir>/docs/spec.md`, which is part of this
PR. So `done` has to be written **before** the commit, or the merged spec
would still say `in_progress` and the dashboard would never show the game as
complete. Do it in this order:

1. The user has confirmed the listing (first publish) and the push + PR
   (above) — one question can cover both. Do not write `done` before that:
   if they decline, nothing was marked.
2. Run `game-review STAGE=publish PACKAGE=<game-dir>` (see "Review").
3. `task game:status:set PACKAGE=<game-dir> STAGE=publish VALUE=done`
4. Staging is normally just `git add -A` on this branch — the whole point
   of branching per-game upfront is that everything sitting dirty on it
   already belongs to this change. Still, run `git status` once before
   staging: this repo's per-game directories are independent, so it's
   possible (if unlikely, on a correctly-branched session) for something
   unrelated to have ended up here too — if so, stop and ask rather than
   silently including or excluding it. The `status_publish: done` line in
   `docs/spec.md` belongs to the change.
5. Commit the staged files with a message describing the change, push the
   branch, and `gh pr create` with a title/body describing the change — for
   a first publish, "add one game" with one line on what it is and a link
   to `<game-dir>/docs/spec.md`; for a post-publish revision, what changed
   and why.
6. If the commit, the push or the PR fails (or the user stops you after
   step 3), set it back with
   `task game:status:set PACKAGE=<game-dir> STAGE=publish VALUE=in_progress`
   and tell the user what failed. Never leave `done` on a branch whose PR
   is not open.

## Review (before the status is written and committed)

Run `game-review STAGE=publish PACKAGE=<game-dir>` — a self-review against
its `STAGE=publish` checklist — before step 3 above. Fix anything that
fails rather than just noting it.

## Completion

1. For a first publish, the `Taskfile.yml` change is correct and the user
   has confirmed the listing; for a post-publish revision, `README.md` is
   current and `Taskfile.yml` is untouched. Either way, the PR is open with
   a link to show them, and the commit contains `status_publish: done`.
2. Tell the user this game's workflow is complete —
   `task game:dashboard` will show it as `next=complete` once the PR is
   merged — and that the next options are `game-extend` (add a feature) or
   `game-balance` (another tuning pass), same as `game-next` offers.
