---
name: game-extend
description: Use when the user wants to add a new element or feature to an already-published game in this monorepo — picks exactly one extension, agrees why, how it affects the core loop, what must not change and where it goes in the spec, then hands off to game-spec. Conversation only; no files touched.
---

# game-extend

The entry point for growing a game after it has shipped. `game-idea`
starts from nothing; this starts from a working, published game and
decides the next *one* thing to add to it. Like `game-idea`, this is a
conversation, not an implementation step: no files are touched and no
`status_*` key is written here. Once the user approves, `game-spec` takes
over — it opens the branch, revises the spec and resets the downstream
stages, and the normal impl → … → publish chain runs again.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm
  with the user.
- Requires `status_publish: done`
  (`task game:status PACKAGE=<game-dir> STAGE=publish`). If the game
  hasn't been published yet, don't extend it: tell the user to ship the
  MVP first (adding to it now widens the MVP, which `game-idea` works to
  keep small) and point them back to `game-next`.

## Process

Ask one question at a time.

1. **Understand the current game.** Read the whole spec — `docs/spec.md`
   and every `docs/spec/*.md` linked from its `## 拡張` section (see
   `game-spec` "Spec layout") — focusing on コンセプト, コアループ,
   非MVP範囲 and the パラメータ表, plus `README.md`. Optionally play it
   once with `game-qa`'s Docker+Playwright setup and look at the
   screenshots; skip this if the user has played it recently.
2. **Pick exactly one.** List candidates from the user's ideas and the
   spec's 非MVP範囲, and have the user choose **one**. If they want
   several, split them and say which ones are left for later cycles
   (AGENTS.md: one change, one purpose; one PR per game change).
3. **Pin it down**, one question at a time:
   - what is added, concretely;
   - why — what feels missing or dull in the current game (a concrete
     problem, not "more content");
   - how it affects the core loop: does it deepen the existing loop or
     widen it with something beside it?
   - controls added or changed (or explicitly none);
   - the direction for looks and for initial numbers (game-spec fills in
     the パラメータ表; game-balance tunes it later).
4. **Decide what must not change.** List the existing controls feel,
   rules, scoring and difficulty this extension must leave alone. Anything
   existing that *will* change is agreed explicitly as an intended change.
5. **Check the size.** If it doesn't fit one PR (e.g. a new mode plus a
   stage set plus new UI at once), cut it down to the smallest step, as
   `game-idea` does for an MVP. If existing code has to be restructured to
   fit it, say so and get agreement. If `docs/spec.md` is over 600 lines,
   offer to split the existing spec first in its own docs-only cycle (see
   `game-spec` "Spec layout").
6. **Decide where it goes in the spec**, by the `game-spec` "Spec layout"
   rule: an element with its own rules, parameters and screens → a new
   `docs/spec/<slug>.md`; a change to an existing element or a small
   addition → edit `docs/spec.md` in place.
7. **Propose a branch slug** for `feat/<game-dir>-<slug>` (short
   kebab-case). Check it doesn't collide with an existing local or remote
   branch (`git branch -a --list '*<game-dir>-<slug>*'`).
8. Run `game-review STAGE=extend PACKAGE=<game-dir>` (a self-review
   against its checklist) and fix anything that fails, silently, rather
   than handing the gaps to the user.
9. Summarize the agreement in one block — what is added and why, core
   loop effect, controls, what must not change, where it goes in the spec,
   branch slug — and get explicit approval.

## Handoff

Once approved, invoke `game-spec` with `PACKAGE=<game-dir>` and pass the
summary from step 9. `game-spec` treats it as a post-publish revision:
new `feat/<game-dir>-<slug>` branch from `main`, spec revision (see its
"Revisions coming from `game-extend`"), downstream stages reset to
`pending`. From there `game-next` drives the chain as usual.

The candidates the user didn't pick this time aren't recorded anywhere by
this skill; mention them again in the summary so the user can keep them.
