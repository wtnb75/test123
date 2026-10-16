---
name: game-autopilot
description: Use when the user wants to pick one backlog card of a published game, pin it down in a few rounds of dialogue, and then have it carried through to an open PR without further stops (autopilot) — spec, impl, test, check, codereview, qa and publish run on the agreed content. Merging is game-playtest's job.
---

# game-autopilot

`game-extend` plus "and then don't stop": the user spends their time on the
conversation that decides *what* to build, then the chain runs by itself to
an open PR. The playtest and the merge come afterwards (`game-playtest`).

This skill adds no new stage and no status key. It wraps `game-extend`,
and records the user's agreement in the conversation so the stage skills can
skip their approval stops (each has an "Autopilot" section).

## Inputs

- `PACKAGE=<game-dir>` (optional). If given, use it as is and skip
  "Choosing the game and card". If not given, choose as below.

## Choosing the game and card

The backlog on `origin/main` still lists a card while a PR that implements
it is open, so picking from `main` alone repeats work already in flight and
conflicts with it. Look at the work in flight first.

1. `git fetch origin`. List the work in flight:
   - open PRs: `gh pr list --state open --json number,title,headRefName,files`
   - remote branches with no PR: `git branch -r --list 'origin/feat/*'
     'origin/fix/*' 'origin/balance/*'`, minus the heads of those PRs (a
     branch with nothing pushed beyond `origin/main` is ignored).
2. A game is **busy** if any of that work touches `<game-dir>/` (a branch
   name `<type>/<game-dir>-<slug>` counts too), or touches a
   `shared/<name>` the game depends on (`"<name>": "workspace:*"` in its
   `package.json`), or touches `scaffold/`. Changes only to `docs/`,
   `.claude/`, `AGENTS.md`, `Taskfile.yml`, `pnpm-lock.yaml` are ignored. A
   busy game is skipped as a whole, not card by card: a second PR in the same
   game collides on its spec and backlog even for a different card.
3. Candidates = the games with `next=complete` in `task game:dashboard`
   (`status_publish: done`, nothing pending), minus the busy ones, and
   minus those with no `docs/backlog.md` or an empty one.
4. Pick one candidate at random (`shuf -n1`), and take the **top card** of
   its `docs/backlog.md` on `origin/main`. With no work in flight this is the
   same rule applied to every complete game.
5. Tell the user in one block: the game and card (タイトル, 種別, 規模), the
   work in flight and which games it made busy, and the candidates left. The
   choice is a proposal: if the user wants another card or game, take the
   next one they name (or re-pick). Don't ask for approval here — the
   questions of the next section confirm the card.

If there is no candidate: say why (all complete games are busy, or have no
backlog) and offer `game-backlog` for a game without a backlog, or
`game-playtest` for an open PR waiting to be played. A busy game is touched
only if the user insists, and then after the PR that makes it busy is merged.

## Process

1. **Pin down one card with `game-extend`.** Invoke it with `PACKAGE` and
   tell it the card chosen above is the starting card (its step 2 then
   confirms it instead of offering the whole backlog); follow it as written
   (its steps 1–9: understand the game, pick exactly one, ask one question at
   a time, classify, "must not change", size, spec place, branch slug,
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
   slug, candidates left for later) and, under it, this block:

   ```markdown
   ## オートパイロット合意
   - ここから PR を開くまで、確認を挟まずに進める（spec の承認 / codereview の採否 / polish・balance の選択 / push と PR 作成）
   - polish・balance は行わない（初期値のまま。遊んでの調整は PR のテストプレイで行う）
   - 止まる条件: 合意にない仕様の穴・合意からの逸脱・ゲートの失敗・合意の範囲を超える修正
   - マージはしない（`game-playtest` で遊んでから）
   ```

   Get explicit approval once. It covers both the extension and the
   autopilot. If the user approves the extension but not the autopilot, stop
   here and hand over to `game-spec` as `game-extend` does (normal mode).
4. **Hand off.** Invoke `game-spec` with the summary, as `game-extend`
   does. From here the stage skills see the agreement block in the
   conversation and run in autopilot (below). `game-next` keeps dispatching.

## Autopilot rules

The agreement block above is the switch: a stage skill's "Autopilot"
section applies only while that block is in the conversation and the user
has not withdrawn it. A session that no longer has the block (a new session,
a compacted context) is **not** in autopilot: the stage asks as usual.

What stays the same: every `game-review`, every gate (lint, test, coverage,
build), QA, the branch rules, one change per PR, and "pushing needs the
agreement" (here: the block above).

What changes, per stage:

| stage | autopilot |
|---|---|
| spec | Write it, run the review, and go on without the approval stop. The spec must say what was agreed; show the spec diff and review result in the final report, not as a question. |
| codereview | Triage by your own recommendation without asking: accept → fix, reject → drop. A **spec** finding (would change player-visible behavior beyond the agreement) is not applied: it goes into the PR body under 「未対応の指摘」. Same round limit as usual. |
| polish | No proposal and no extra items. Re-screenshot the affected Scenes and check them against the QA/4.6 list; fix only what breaks the agreement (cut-off text, overlap, targets under 44 px) as part of the change, then mark done. |
| balance | No tuning. The initial numbers from the agreement stay; mark done. The PR body says the numbers are untested by hand. |
| publish | No confirmation for the commit, push and `gh pr create`; the agreement covers them. |

Stop and tell the user (end the turn) when:

- the spec, impl, test or review finds a question the agreement doesn't
  answer (a spec gap, a conflict with the must-not-change list);
- a gate or QA fails and the fix would go beyond the agreed scope, or the
  same stage fails twice;
- the work turns out to need a second purpose (it no longer fits one PR);
- anything would need an external asset, a new dependency, or a change to
  `Taskfile.yml`'s `GAMES`.

Never in autopilot: merge, publish a dev server, delete anything, touch other
games' directories.

## Completion

The PR is open. Report in Japanese, in one short block: the PR URL; what
was added; what was skipped (polish, balance); 「未対応の指摘」 if any; the
gate results. Then offer `game-playtest` for this PR (don't start it
unasked) — the playtest decides the feel and the merge.

If autopilot stopped midway, say which stage and why, and that answering
resumes the chain (`game-next`).
