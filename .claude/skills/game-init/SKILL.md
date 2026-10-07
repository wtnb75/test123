---
name: game-init
description: Use when a game concept has been agreed (see game-idea) and needs its directory scaffolded via `task newgame` — the required first filesystem step for any new game in this monorepo (AGENTS.md section 2.2).
---

# game-init

Scaffold a new game directory. Follows `AGENTS.md` section 2.2/2.3 exactly —
never call `pnpm create @phaserjs/game@latest` directly.

## Inputs

- `PACKAGE=<game-dir>`: folder name only (kebab/lowercase, e.g. `cjump`). If
  not given, ask the user — do not guess a name silently.

## Steps

1. Make sure the directory name is one the user agreed to (it becomes the
   public URL path; renaming later is possible but costs a rerun). If the
   user already approved this exact name — in the `game-idea` summary or
   by passing `PACKAGE=` themselves — don't ask again. Confirm only when
   the name is new to them (e.g. you had to pick or adjust it here).
2. Create and check out a dedicated branch for this game before touching
   any files: `feat/<game-dir>`, branched from `origin/main`. This is
   what lets `game-publish` later open a PR scoped to exactly this game,
   without needing to pick this game's changes out of a working tree that
   also has unrelated work sitting in it (learned the hard way — sorting
   that out by hand after the fact is real, avoidable effort).
   - Always branch from `origin/main`, not from the branch you happen to be
     on: in a worktree session you start on a worktree branch, and local
     `main` may be checked out in another worktree (so `git checkout main`
     fails) or be behind. Branching from `origin/main` also keeps whatever
     is on the current branch out of the game's branch. If the working tree
     has uncommitted changes, stop and confirm with the user first — they
     would be carried into the new branch.
   - `git fetch origin && git checkout -b feat/<game-dir> origin/main`
   - If `feat/<game-dir>` already exists, don't reuse or overwrite it
     silently — you don't know what state it's in (an abandoned earlier
     attempt, leftover from a rename, something else entirely). Find the
     next free name instead (`feat/<game-dir>-2`, `-3`, ...) and create
     that, and tell the user a branch by the original name already existed
     so they can look at it later if it's worth recovering.
3. Run `task newgame PACKAGE=<game-dir>`. This merges `package.json` with
   `base.json`, sets up thin `tsconfig.json` / `eslint.config.mjs` /
   `vitest.config.ts` / `vite/config.*.mjs` that reference the shared
   configs under `scaffold/` (90% coverage threshold), and registers the
   package in `pnpm-workspace.yaml` plus a **commented-out** line in
   `Taskfile.yml`'s `GAMES` list.
4. Required follow-ups (do all of these — AGENTS.md 2.2 lists them as
   mandatory, not optional):
   - Edit `<game-dir>/package.json` `description` to match the game concept
     from `game-idea`.
   - Run `pnpm install` to update the lockfile.
   - Run `task game:favicon PACKAGE=<game-dir>` to replace the Phaser
     template's stock `public/favicon.png` with an identicon generated
     from the game name (jdenticon via `pnpm dlx`, so it needs network
     access). If it fails, tell the user and carry on — `game-publish`
     checks it again.
   - Leave the `GAMES` line commented out — it gets uncommented only by
     `game-publish`, once the game is ready to be listed on the top page.
5. Create `<game-dir>/docs/spec.md` with **only** this frontmatter block —
   no body content yet, that's `game-spec`'s job. This is what makes the
   game visible to `task game:detect` / `task game:next` / `game-next`
   immediately, instead of only after the spec is written. Create the file
   with the Write tool, not a shell `printf`/`echo`: in a worktree-isolated
   session a shell command whose argument starts with `---` is refused as
   "cannot be shown not to be git".

   ```yaml
   ---
   status_idea: done
   status_init: done
   status_proto: pending
   status_spec: pending
   status_impl: pending
   status_test: pending
   status_check: pending
   status_codereview: pending
   status_qa: pending
   status_polish: pending
   status_balance: pending
   status_publish: pending
   ---
   ```

## Review (before handoff)

Run `game-review STAGE=init PACKAGE=<game-dir>` — a self-review against
its `STAGE=init` checklist — before handing off. Fix anything that
fails rather than just noting it.

## Handoff

Tell the user in one line that the directory is ready, then continue
without asking: invoke `game-next` with `PACKAGE=<game-dir>`. It
dispatches `game-proto`, which writes a short spec-lite, builds a
throwaway prototype and loops playtests with the user (see `game-next`
"Continuous mode"); the full spec comes after that, from `game-spec`.
