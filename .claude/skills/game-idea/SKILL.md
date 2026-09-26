---
name: game-idea
description: Use when the user wants to brainstorm a new game idea for this monorepo (AGENTS.md), before any directory or spec exists — clarifies concept, core loop, target player and MVP scope through dialogue.
---

# game-idea

Brainstorm a new game concept for this repo (see `AGENTS.md` section 2). This
is a conversation, not an implementation step — no files are touched here.
The directory and `docs/spec.md` don't exist yet, so there is no progress
status to update.

## Process

1. Ask the user, one question at a time, about:
   - コンセプト（1-3行で言える程度に絞る）
   - ターゲットプレイヤー
   - コアループ（プレイ中に繰り返す行動）
   - 操作仕様（キーボード／タッチのどちらを主にするか）
   - MVP範囲と非MVP範囲（最初のバージョンで作らないものを明確にする）
2. Push back on scope creep. An idea that bundles multiple independent
   systems (e.g. multiplayer + shop + leaderboard in v1) should be trimmed to
   a single core loop before moving on.
3. Suggest a tentative `<game-dir>` name (English, kebab/lowercase, matches
   existing conventions like `cjump`, `kogodrop`, `dutchcalc`).
4. Before summarizing, run `game-review STAGE=idea` (a self-review
   against its checklist) and fix anything that fails, silently, rather
   than handing the gaps to the user.
5. Summarize the agreed concept in a few sentences and get explicit
   confirmation from the user before proceeding.

## Handoff

Once the user approves the concept, tell them the next step is
`game-init` (directory scaffolding via `task newgame`), and offer to run it.
Do not run `task newgame` from this skill — that is `game-init`'s job.
