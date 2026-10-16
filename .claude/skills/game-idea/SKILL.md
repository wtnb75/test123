---
name: game-idea
description: Use when the user wants to jot down a new game idea for this monorepo (memo mode — adds it to docs/ideas.md), or to take an idea from that backlog (or a fresh one) and develop it into a concept — core loop, target player, MVP scope — before any game directory or spec exists (develop mode).
---

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

## Choosing the mode

- The user states an idea ("〜というゲームを思いついた", "メモしておいて") and
  doesn't ask to start it → **memo**.
- The user wants to start a new game, asks "what's in the idea list", or
  `game-next` offers a new game → **develop**.
- If unclear, ask once: メモだけ残すか、取り出して詳細化するか。

## memo

1. `git fetch`, then read `origin/main`'s `docs/ideas.md` (not a stale local
   copy). If it doesn't exist yet, tell the user it is the introducing PR's job
   (the file ships with the change that added this skill) and stop.
2. Add one line per idea under **Inbox**: `- <ひとこと>（YYYY-MM-DD）`. Take
   the user's words as given — don't develop, trim or rank here. Ask back only
   if the line can't be understood later (e.g. a bare title with no hint of
   what the game is).
3. Check against the existing list: if the same idea is already in Inbox /
   候補 / 見送り, say so and don't add a duplicate (if it's in 見送り, show the
   reason and ask whether to bring it back to Inbox).
4. Write on a docs-only branch from `origin/main`: `docs/ideas-<slug>` (next
   free `-2`, `-3`, ...). Change only `docs/ideas.md`. After the user
   confirms, commit, push and open a docs-only PR (no behavior/build/test
   impact). Several memos in one session go in one PR.
5. Stop. Don't start **develop** unasked; offer it in one line.

## develop

1. `git fetch`, then read `origin/main`'s `docs/ideas.md`. Also run
   `task game:dashboard` (or list the top-level game directories) so the idea
   can be checked against existing games.
2. Pick the idea:
   - The user names one → use it.
   - Otherwise show 候補 top-down (up to 5, as a short list: タイトル /
     コンセプト / 規模) and Inbox lines, and ask which to take. If the list is
     empty, the user brings a fresh idea (nothing to move into 採用済み).
3. Develop it: ask the user, one question at a time, about:
   - コンセプト（1-3行で言える程度に絞る）
   - ターゲットプレイヤー
   - コアループ（プレイ中に繰り返す行動）
   - 操作仕様（キーボード／タッチのどちらを主にするか）
   - MVP範囲と非MVP範囲（最初のバージョンで作らないものを明確にする）

   Start from what the memo/card already says — don't ask again for what is
   written there; confirm it and ask only for what is missing.
4. Push back on scope creep. An idea that bundles multiple independent
   systems (e.g. multiplayer + shop + leaderboard in v1) should be trimmed to
   a single core loop before moving on. What is trimmed away and worth keeping
   goes back into Inbox as its own line (or a separate 候補 card).
5. Suggest a tentative `<game-dir>` name (English, kebab/lowercase, matches
   existing conventions like `cjump`, `kogodrop`, `dutchcalc`).
6. Before summarizing, run `game-review STAGE=idea` (a self-review
   against its checklist) and fix anything that fails, silently, rather
   than handing the gaps to the user.
7. Summarize the agreed concept in a few sentences — including the
   `<game-dir>` name, since approving the summary approves it — and get explicit
   confirmation from the user before proceeding.

### Not going ahead

If, while developing, the user drops the idea, don't start `game-init`.
Move the card (or Inbox line) to **見送り** with the reason
(`- <仮タイトル> — <理由>（YYYY-MM-DD）`) on a docs-only branch
`docs/ideas-<slug>`, as in **memo** step 4. If the user only wants to park it
for later, leave it where it is, with what was decided added to the card's
メモ.

## Handoff

Once the user approves the concept (including the `<game-dir>` name in
the summary), invoke `game-init` with `PACKAGE=<game-dir>` right away —
the approval covers it, so don't ask a second time. If the idea came from
`docs/ideas.md`, also pass `IDEA=<仮タイトル>` (the card's heading or the
Inbox line's words), so `game-init` can move it to 採用済み on the game's
branch. `game-init` then hands off to `game-next`, which keeps the chain
going (see its "Continuous mode"). Do not run `task newgame` from this
skill — that is `game-init`'s job.
