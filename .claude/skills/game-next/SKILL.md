---
name: game-next
description: The entry point for this monorepo's game workflow — run it with no arguments to auto-detect the game currently being worked on and continue with its next incomplete stage (idea/init/spec/impl/test/check/qa/balance/publish).
---

# game-next

One command to keep going. Figures out which game is in progress and which
of the `game-idea` → `game-init` → `game-spec` → `game-impl` → `game-test` →
`game-check` → `game-qa` → `game-balance` → `game-publish` stages is next,
then hands off to that skill. This skill never edits files itself — it only
detects state and dispatches.

## Inputs

- `PACKAGE=<game-dir>` (optional). If given, skip auto-detection and use
  this game directly.

## Steps

1. Determine the target game:
   - If `PACKAGE` was given, use it.
   - Otherwise run `task game:detect`. This prefers a game with uncommitted
     git changes; failing that, any game with an incomplete stage.
   - If it returns `none`, there is no game with progress-tracking
     frontmatter yet (existing pre-tracking games are out of scope by
     design). Ask the user: start a brand-new game (→ `game-idea`), or did
     they mean an existing untracked game (out of scope for this skill —
     handle it manually)?
2. Before dispatching, make sure you're on the right branch. Games get a
   dedicated branch (`game-init` creates `feat/<game-dir>`; a post-publish
   revision creates its own differently-named branch — see `game-spec`).
   This skill can only reliably resolve the *pre-publish* case on its own:
   if `status_publish` isn't yet `done` for this game and a local
   `feat/<game-dir>` branch exists and isn't currently checked out,
   `git checkout feat/<game-dir>` before continuing. If `status_publish`
   is already `done`, don't guess a branch name — the revision skill
   (`game-spec`, reached via `game-balance` or directly) is what decides
   the right branch for that specific change; just dispatch as normal and
   let it handle branching.
3. Run `task game:next PACKAGE=<game-dir>` to get the next stage.
4. Map the stage to a skill:

   | stage | skill |
   |---|---|
   | `spec` | `game-spec` |
   | `impl` | `game-impl` |
   | `test` | `game-test` |
   | `check` | `game-check` |
   | `qa` | `game-qa` |
   | `balance` | `game-balance` |
   | `publish` | `game-publish` |
   | `complete` | none — see below |

   (`idea`/`init` never come back from `task game:next` for a tracked game,
   since both are already `done` by the time `game-init` creates
   `docs/spec.md` — see `game-init`.)

5. Announce which game/stage/skill you're dispatching to in one line, then
   invoke that skill immediately via the Skill tool, passing
   `PACKAGE=<game-dir>` — no confirmation prompt here. This one command
   advances exactly one stage; run it again (or let the invoked skill's own
   completion message point back to it) to keep going. The invoked skill
   still applies its own judgment about when to pause for user input (e.g.
   `game-spec` getting content approved, `game-publish` confirming a
   user-visible change) — this skill isn't a license to skip those.

## `complete`

All tracked stages are `done`. Tell the user this game's workflow has
nothing pending, and offer `task game:dashboard` if they want to see every
tracked game's status, or ask if they want another `game-balance` pass on
this one anyway.
