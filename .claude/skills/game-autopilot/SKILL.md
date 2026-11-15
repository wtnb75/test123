---
name: game-autopilot
description: Use when the user wants a backlog card of a published game (or several, N=) carried through to an open PR without further stops (autopilot) — a card already pinned down (状態: 着手可) runs on its recorded agreement, any other card is first pinned down in a few rounds of dialogue; then spec, impl, test, check, codereview, qa and publish run on the agreed content. Merging is game-playtest's job.
---

# game-autopilot

`game-extend` plus "and then don't stop". The work has two halves that need
different things from the user:

- **deciding what to build** needs the user's attention (a few rounds of
  questions), and few tokens;
- **building it** (spec → … → an open PR) needs tokens, and no attention.

They don't have to happen in the same session. A card pinned down earlier
(`game-extend MODE=pin`, typically while grooming the backlog) carries its
agreement in `docs/backlog.md` as `状態: 着手可`; this skill then runs on it
without the dialogue. A card that is not pinned is pinned here first. The
playtest and the merge come afterwards (`game-playtest`).

This skill adds no new stage and no status key. It records the agreement in
a file (`<game-dir>/.autopilot.md`, git-ignored) so the stage skills can skip
their approval stops (each has an "Autopilot" section).

## Inputs

- `PACKAGE=<game-dir>` (optional). If given, use it as is and skip the
  choice of the game (the card is still chosen as below). If not given,
  choose as below.
- `N=<count>` (optional, default 1). Run that many cards one after another,
  each of a different game, each to its own branch and PR — see "Several
  cards in one run". Only 着手可 cards are taken when `N` > 1.

## Choosing the game and card

The backlog on `origin/main` still lists a card while a PR that implements
it is open, so picking from `main` alone repeats work already in flight and
conflicts with it. Look at the work in flight first.

1. `git fetch --prune origin` (without `--prune`, `origin/*` keeps branches that
   were deleted after their merge: ~80 stale refs, none on the remote). List the
   work in flight, from three places:
   - open PRs: `gh pr list --state open --json number,title,headRefName,files`
   - branches checked out in other worktrees (work that is not pushed yet, so
     neither a PR nor a remote branch shows it): `git worktree list --porcelain`.
     Skip this session's own worktree and the one on `main`, and skip a branch
     whose PR is merged or closed (`gh pr list --state all --head <branch>
     --json state`; a merged branch can stay checked out). What it touches is
     `git diff --name-only origin/main...<branch>` plus the uncommitted files
     of that worktree (`git -C <path> status --porcelain`).
   - remote branches with no PR: `git branch -r --list 'origin/feat/*'
     'origin/fix/*' 'origin/balance/*' 'origin/refactor/*'` (after the prune
     only branches that really exist remain), minus the heads of those PRs.
     Don't judge a branch by its `ahead` count: a squash merge makes a merged
     branch look ahead.
2. Sort each game by what that work touches:
   - **busy** — it touches `<game-dir>/` beyond `docs/backlog.md` (a branch
     name `<type>/<game-dir>-<slug>` counts too), or touches a
     `shared/<name>` the game depends on (`"<name>": "workspace:*"` in its
     `package.json`), or touches `scaffold/`. A busy game is skipped as a
     whole, not card by card: a second PR in the same game collides on its
     spec and backlog even for a different card.
   - **backlog pending** — the only thing touched under `<game-dir>/` is
     `docs/backlog.md` (a backlog PR from `game-backlog` or
     `game-extend MODE=pin`, often covering many games at once). The game is
     held out too — `origin/main` does not have the order and the 着手可
     cards of that PR yet, and removing a card here would conflict with it —
     but it is not in flight: one merge brings all of those games back.
     Report it apart from the busy ones, with the PR number.
   - Changes only to the repo-level `docs/`, `.claude/`, `AGENTS.md`,
     `Taskfile.yml`, `pnpm-lock.yaml` are ignored.
3. Candidates = the games with `next=complete` in `task game:dashboard`
   (`status_publish: done`, nothing pending), minus the busy and
   backlog-pending ones, and minus those with no `docs/backlog.md` or an
   empty one.
4. Pick the card, from `docs/backlog.md` on `origin/main`:
   - within a game: the top-most card with `状態: 着手可`; if it has none,
     the **top card**;
   - among the games: if any candidate has a 着手可 card, pick one of those
     games at random (`shuf -n1`); otherwise pick one of all candidates at
     random.
5. Tell the user in one block: the game and card (タイトル, 種別, 規模,
   着手可 or not), the work in flight and which games it made busy, the
   backlog PRs that hold games out (「#N をマージすると <games> が候補に
   戻ります」), and the candidates left. The choice is a proposal: if the
   user wants another card or game, take the next one they name (or
   re-pick). Don't ask for approval here — the next section confirms the
   card.

If a backlog PR holds out most of the candidates (or the game the user
named), say so first and recommend merging it before going on; when the user
merges it (or tells you to: it is docs-only), fetch again and re-pick.

If there is no candidate: say why (all complete games are busy, held out by
a backlog PR, or have no backlog) and offer `game-backlog` for a game
without a backlog, or `game-playtest` for an open PR waiting to be played. A
busy game is touched only if the user insists, and then after the PR that
makes it busy is merged.

## Process

### A. The card is 着手可 (pinned earlier)

The card's `合意` holds what `game-extend` steps 1–10 agreed. Don't ask it
again.

1. **Check that it is not stale.** The card records the commit it was agreed
   against (`基準 <sha>`). `git diff --stat <sha> origin/main --
   <game-dir>/src <game-dir>/docs/spec.md <game-dir>/docs/spec`:
   - empty → go on;
   - not empty → read that diff against the agreement (the elements, Scenes
     and numbers it names, and its 変えないもの). If it touches none of
     them, go on and say so in the summary. If it does, the premise moved:
     ask the user the one or two questions that settle it (as `game-extend`
     step 3 does for a stale card) — or, when `N` > 1 or the user said not
     to ask, leave this card, say why in the report, and pick again.
2. Read the spec (`docs/spec.md` and its linked files) and `README.md`, as
   `game-extend` step 1 — the chain needs them, the user doesn't.
3. Check the branch name in the agreement is still free
   (`git branch -a --list '*<game-dir>-<slug>*'`; if taken, append `-2`).
4. **Approval.** Show the agreement as the extension summary and, under it,
   the オートパイロット合意 block (below). Ask once — unless the user's
   invocation already said to run without asking (「確認なしで」,
   「着手可を N 件流して」, `N` > 1): then the invocation is the approval
   of the autopilot, and the card's `合意` is the approval of the
   extension. Go on to "Record and hand off".

### B. The card is not pinned

1. **Pin down one card with `game-extend`.** Invoke it with `PACKAGE` and
   tell it the card chosen above is the starting card (its step 2 then
   confirms it instead of offering the whole backlog); follow it as written
   (its steps 1–9: understand the game, pick exactly one, ask one question at
   a time, classify, "must not change", size, spec place, branch name,
   `game-review STAGE=extend`). Several rounds of questions are
   expected here — this is where the user's attention is spent. Don't skip
   or shorten a question because autopilot follows; the autopilot can only
   be as good as this agreement.
2. **Prefer a card that fits one PR.** If the card is size L, cut it down
   with the user as `game-extend` step 6 says. Autopilot never starts on
   something that needs restructuring the user hasn't agreed to.
3. **Replace `game-extend` step 10 by one combined approval.** Show the
   extension summary (what and why, core loop effect, controls,
   presentation-only or gameplay, must-not-change list, spec place, branch
   name, candidates left for later) and, under it, the オートパイロット合意
   block. Get explicit approval once. It covers both the extension and the
   autopilot. If the user approves the extension but not the autopilot, stop
   here and hand over to `game-spec` as `game-extend` does (normal mode).

If the user would rather build it later, end with `game-extend`'s "Pin only"
exit instead (the agreement goes into the card; nothing is built now).

### The agreement block

```markdown
## オートパイロット合意
- ここから PR を開くまで、確認を挟まずに進める（spec の承認 / codereview の採否 / polish・balance の選択 / push と PR 作成）
- polish・balance の調整は行わない（初期値のまま。gameplay の変更は、自動プレイの数字を PR に載せる。遊んでの調整は PR のテストプレイで行う）
- 止まる条件: 合意にない仕様の穴・合意からの逸脱・ゲートの失敗・合意の範囲を超える修正
- マージはしない（`game-playtest` で遊んでから）
```

### Record and hand off

1. **Write `<game-dir>/.autopilot.md`** (with the Write tool; the name is in
   `.gitignore`, so it never reaches a commit):

   ```markdown
   # オートパイロット合意: <game-dir> / <slug>

   - 日付: YYYY-MM-DD
   - ブランチ: <type>/<game-dir>-<slug>
   - カード: <タイトル>（`<slug>`） / 種別 / 規模
   - 承認: <ユーザーの承認の言葉、または「着手可のカード＋確認なしの指示」>

   ## 拡張の内容
   <the extension summary, as shown to the user>

   ## オートパイロット合意
   <the block above>

   ## 止まった理由
   （止まったときだけ書く: 段階・理由・ユーザーへの質問）
   ```

2. **Hand off.** Invoke `game-spec` with the summary, as `game-extend`
   does. From here the stage skills find the file and run in autopilot
   (below). `game-next` keeps dispatching.

## Autopilot rules

The file is the switch: a stage skill's "Autopilot" section applies while
`<game-dir>/.autopilot.md` exists, names the current branch, and has an
empty 「止まった理由」. It is on disk, so a compacted context does not turn
autopilot off: when a stage is unsure what was agreed, it reads the file
again instead of asking. A session that does not have the file (a new
checkout: the uncommitted work is gone with it) is not in autopilot.

The user can withdraw it at any time ("止めて", "ここからは確認して"): remove
the file (`git clean -fX -- <game-dir>/.autopilot.md`) and the stages ask as
usual from there.

`game-playtest` uses the same switch for its change-request loop: it writes
the file with the user's requests as the agreement.

What stays the same: every `game-review`, every gate (lint, test, coverage,
build), QA, the branch rules, one change per PR, and "pushing needs the
agreement" (here: the file).

What changes, per stage:

| stage | autopilot |
|---|---|
| spec | Write it, run the review, and go on without the approval stop. The spec must say what was agreed; show the spec diff and review result in the final report, not as a question. |
| codereview | Triage by your own recommendation without asking: accept → fix, reject → drop. A **spec** finding (would change player-visible behavior beyond the agreement) is not applied: it goes into the PR body under 「未対応の指摘」. Same round limit as usual (and the lighter level for a size-S card, see `game-codereview` "Level by size"). |
| qa | As usual, with the affected Scenes shot at all four sizes of AGENTS.md 4.6, so polish does not need a second run. |
| polish | No proposal and no extra items. Check **QA's screenshots** of the affected Scenes against the 4.6 list — don't start the containers again unless a size or state is missing; fix only what breaks the agreement (cut-off text, overlap, targets under 44 px) as part of the change (re-shoot just that), then mark done. |
| balance | No tuning; the initial numbers from the agreement stay. For a **gameplay** card, measure them once with automated play (`game-backlog` "Automated play": seeded runs, medians, stated conditions) and put the numbers in the PR body, next to the before-numbers where they exist (the card's 根拠, the comparison from `game-extend` step 5, or a condition in which the new element is off) — don't build a second checkout for it. A number that contradicts the 変えないもの list is a stop. Presentation-only: nothing to measure. Then mark done; the PR body says the numbers are untried by hand. |
| publish | No confirmation for the commit, push and `gh pr create`; the agreement covers them. |

Stop and tell the user (end the turn) when:

- the spec, impl, test or review finds a question the agreement doesn't
  answer (a spec gap, a conflict with the must-not-change list);
- a gate or QA fails and the fix would go beyond the agreed scope, or the
  same stage fails twice;
- the work turns out to need a second purpose (it no longer fits one PR);
- anything would need an external asset, a new dependency, or a change to
  `Taskfile.yml`'s `GAMES`.

Before ending the turn, write the stage, the reason and the question under
「止まった理由」 in `.autopilot.md`. When the user answers, add the answer to
「拡張の内容」, empty 「止まった理由」 again, and resume (`game-next`); the
chain is back in autopilot without a second approval.

Never in autopilot: merge, publish a dev server, delete anything but its own
throwaway files, touch other games' directories.

## Completion

The PR is open. Remove the agreement file
(`git clean -fX -- <game-dir>/.autopilot.md`). Report in Japanese, in one
short block: the PR URL; what was added; what was skipped (polish, balance)
and the automated-play numbers if any; 「未対応の指摘」 if any; the gate
results. Then offer `game-playtest` for this PR (don't start it unasked) —
the playtest decides the feel and the merge.

If autopilot stopped midway, say which stage and why, and that answering
resumes the chain (`game-next`).

## Several cards in one run (`N` > 1)

For a session that should spend tokens, not attention: the cards were pinned
earlier, and the PRs are played later.

- Take only 着手可 cards. If fewer than `N` are available, run those and say
  how many were missing (`game-extend MODE=pin` makes more).
- One card at a time, start to finish: after a PR opens and its agreement
  file is removed, go back to "Choosing the game and card" (fetch again; the
  PR just opened makes its game busy, so the next card is another game's).
  Each card gets its own branch from `origin/main` and its own PR; nothing
  is carried from one card to the next.
- A stop (above) ends the run: the working tree holds that card's unfinished
  work, so don't start another card over it. Report the PRs opened, the card
  that stopped and its question, and how many were left.
- At the end, one line per card (game, card, PR URL or why it was left), then
  offer `game-playtest`.
