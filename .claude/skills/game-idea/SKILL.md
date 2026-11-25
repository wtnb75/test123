---
name: game-idea
description: Use when the user wants to jot down a new game idea for this monorepo (memo mode — adds it to docs/ideas.md), or to take an idea from that backlog (or a fresh one) and develop it into a concept — core loop, target player, MVP scope — before any game directory or spec exists (develop mode).
allowed-tools: Bash(deskil --version), Bash(deskil flow:*)
---

Before anything else, run `deskil --version`. If the command is not found, tell the user to run `uv tool install git+https://github.com/wtnb75/deskil` and stop.

# game-idea

Two stages for a new game concept (see `AGENTS.md` section 2), both centred
on the repo-level `docs/ideas.md` (Inbox → 候補 → 採用済み / 見送り):

- **memo** — put an idea in the backlog, cheaply, without developing it.
- **develop** — take one idea out of the backlog, develop it in dialogue,
  and start building it (`game-init`).

Neither stage creates a game directory or `docs/spec.md`, so there is no
progress status to update. The only file this skill touches is
`docs/ideas.md`, on a docs-only branch.

`docs/ideas.md` is for games that don't exist yet. Ideas for a published
game belong in its own `docs/backlog.md` (`game-backlog`).

Run this skill as a step-by-step flow:

1. Run `deskil flow start .claude/skills/game-idea/flow.toml`.
2. Follow the instructions in the output. When the work is done, run the
   `next` command shown at the end of the output.
3. Repeat until the output ends with `Flow complete.`

## Choosing the mode

- The user states an idea ("〜というゲームを思いついた", "メモしておいて") and
  doesn't ask to start it → **memo**.
- The user wants to start a new game, asks "what's in the idea list", or
  `game-next` offers a new game → **develop**.
- If unclear, ask once: メモだけ残すか、取り出して詳細化するか。

## Added by the flow conversion

- `fix_review` has `max_visits = 2`; exceeding it goes on to `summary` (the
  user's confirmation follows anyway).
- The memo loop (`memo_add` ↔ `memo_more`) has no limit: the user decides when
  there are no more memos.
- `summary` has a `revise` choice (back to the dialogue) that the original did
  not spell out. A parked idea (`park_card`) goes through the same docs-only
  PR step as a dropped one.
