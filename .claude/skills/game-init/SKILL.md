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

1. Confirm with the user this is the directory name they want (it becomes
   the public URL path). Renaming later is possible but costs a rerun.
2. Create and check out a dedicated branch for this game before touching
   any files: `feat/<game-dir>`, branched from the current `main`. This is
   what lets `game-publish` later open a PR scoped to exactly this game,
   without needing to pick this game's changes out of a working tree that
   also has unrelated work sitting in it (learned the hard way — sorting
   that out by hand after the fact is real, avoidable effort).
   - If the current branch isn't `main`, stop and confirm with the user
     before branching from it — branching from the wrong base carries
     whatever unrelated work is on that branch into the new game's branch
     too.
   - `git checkout -b feat/<game-dir> main`
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
   immediately, instead of only after the spec is written:

   ```yaml
   ---
   status_idea: done
   status_init: done
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

Tell the user the directory is ready and the next step is `game-spec`
(or just `game-next`, which will now find it on its own).
