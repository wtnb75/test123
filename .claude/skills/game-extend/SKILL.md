---
name: game-extend
description: Use when the user wants to add a new element or feature to an already-published game in this monorepo — picks exactly one extension, agrees why, how it affects the core loop, what must not change and where it goes in the spec, then hands off to game-spec — or, with MODE=pin, records the agreement in the backlog card (状態: 着手可) so game-autopilot can build it later without the dialogue. Conversation only; no files touched except the backlog in MODE=pin.
---

# game-extend

The entry point for growing a game after it has shipped. `game-idea`
starts from nothing; this starts from a working, published game and
decides the next *one* thing to add to it. Like `game-idea`, this is a
conversation, not an implementation step: no files are touched and no
`status_*` key is written here. Once the user approves, `game-spec` takes
over — it opens the branch, revises the spec and resets the downstream
stages, and the normal impl → … → publish chain runs again. With
`MODE=pin` the agreement is written into the backlog card instead, for a
later `game-autopilot` run.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:dashboard`, list the
  games with `next=complete`, and ask the user to pick one
  (`task game:detect` doesn't return completed games).
- `MODE=pin` (optional): agree now, build later — see "Pin only". Also
  when the user says so in words (「詰めるだけ」「着手可にしておいて」).
  With `PACKAGE=all` (「全部のゲーム」, or no `PACKAGE` in a grooming
  session) it goes through the top card of every game in turn — see
  "Pin sweep".
- Requires `status_publish: done`
  (`task game:status PACKAGE=<game-dir> STAGE=publish`):
  - `done` → proceed.
  - `absent` (no progress frontmatter — a game from before tracking) →
    this game is out of scope for this workflow, same as `game-next`;
    tell the user it predates progress tracking and they can handle the
    extension manually.
  - `pending`/`in_progress` → check whether the spec already went
    through a post-publish revision (a `<type>/<game-dir>-<slug>` branch
    exists, or `status_spec` shows a revision). If so, there's an
    unfinished revision: finish it via `game-next` first. Otherwise the
    game hasn't shipped yet: tell the user to ship the MVP first (adding
    to it now widens the MVP, which `game-idea` works to keep small) and
    point them back to `game-next`.

## Process

Ask one question at a time.

1. **Understand the current game.** Read the whole spec — `docs/spec.md`
   and every `docs/spec/*.md` linked from its `## 拡張` section (see
   `game-spec` "Spec layout") — focusing on コンセプト, コアループ,
   非MVP範囲 and the パラメータ表, plus `README.md`. Optionally play it
   once with `game-qa`'s Docker+Playwright setup and look at the
   screenshots; skip this if the user has played it recently.
2. **Pick exactly one.** Offer the cards of `<game-dir>/docs/backlog.md`
   (on `origin/main`) in their order — top card first, it's the user's
   agreed next-up — plus any idea the user brings, and have the user choose
   **one**. If there is no backlog, or it is empty, or the user wants fresh
   ideas, run `game-backlog` first and come back. If they want several,
   split them and say which ones are left for later cycles (AGENTS.md: one
   change, one purpose; one PR per game change).
3. **Pin it down**, one question at a time (a question that depends on
   the previous answer). Independent design choices that the user can
   decide in any order (up to four) may go in one batch, each with a
   recommendation. A backlog card's 狙い,
   コアループへの効き方, 種別 and 規模 are the starting draft — confirm or
   revise them rather than asking from scratch. Before the first question,
   check the card's premise (what is "stuck", the numbers it cites) against
   the current spec: a card written before a later spec change can be stale.
   If it is, say so and restate the problem in plain text first; don't build
   the choices on the old premise. A card that is already `状態: 着手可`
   has these answers in its `合意`: check it against the current spec (its
   `基準` commit, as `game-autopilot` "A" step 1 does), show it, and ask
   only for what moved:
   - what is added, concretely;
   - why — what feels missing or dull in the current game (a concrete
     problem, not "more content");
   - how it affects the core loop: does it deepen the existing loop or
     widen it with something beside it?
   - controls added or changed (or explicitly none);
   - when the addition goes onto an existing Scene: how many px of the
     canvas height the new element gets after the existing elements keep
     their places, and what existing text/elements may be removed or
     moved to make room — show it as a to-scale sketch (px), not ratios;
   - the direction for looks and for initial numbers (game-spec fills in
     the パラメータ表; game-balance tunes it later).
4. **Classify it**: *presentation-only* (effects, UI, result screens —
   no rule, score or gameplay number changes) or *gameplay* (anything
   else). Say which; a presentation-only extension may settle polish,
   balance and the PR in one confirmation later (`game-polish`
   "Presentation-only revisions").
5. **Decide what must not change.** List the existing controls feel,
   rules, scoring and difficulty this extension must leave alone. Anything
   existing that *will* change is agreed explicitly as an intended change.
   If the extension changes how hard the game is (generation, spawn,
   scoring, recovery), compare the old and the new with a bot over seeded
   runs before asking for approval, and say which "unchanged" numbers the
   result puts in doubt: they are an intended retune now, not a surprise
   in `game-balance`.
   If the extension joins two places in the game's space (leaving one
   area through an edge, door or portal and arriving in another; maps,
   levels, screens or scroll regions that link up), also work the join
   out by hand before asking for approval: pick at least two exit
   directions or edges, write the cell/position the player leaves from
   and the one they arrive at, and show the arrival is where the walk
   leads (the same edge or the matching one, the same facing). Put that
   small example in the summary at step 10; `game-spec` copies it into
   テスト観点. Skip this when nothing joins places.
6. **Check the size.** If it doesn't fit one PR (e.g. a new mode plus a
   stage set plus new UI at once), cut it down to the smallest step, as
   `game-idea` does for an MVP. If existing code has to be restructured to
   fit it, say so and get agreement. If `docs/spec.md` is over 400 lines,
   offer to split it first; if the user agrees, stop here and run that
   split via `game-spec` (its `split.md`), then come back.
7. **Decide where it goes in the spec**, by the `game-spec` "Spec layout"
   rule: an element with its own rules, parameters and screens → a new
   `docs/spec/<slug>.md`; a change to an existing element or a small
   addition → edit `docs/spec.md` in place.
8. **Propose a branch name** `<type>/<game-dir>-<slug>` (short
   kebab-case slug). `<type>` is `feat` for anything the player can see or
   feel; `refactor` for a card that only restructures code or adds a
   measurement, with no player-visible change (the PR title then says
   `refactor(...)` too). Check it doesn't collide with an existing local or remote
   branch: `git fetch --prune origin` first (otherwise `origin/*` keeps
   branches deleted after their merge and reports a collision that is not
   there), then `git branch -a --list '*<game-dir>-<slug>*'`.
9. Run `game-review STAGE=extend PACKAGE=<game-dir>` (a self-review
   against its checklist) and fix what you can from what's already
   agreed; gaps that need the user's answer (e.g. the must-not-change
   list) are asked together in one batch.
10. Summarize the agreement in one block — what is added and why, core
    loop effect, controls, presentation-only or gameplay, what must not
    change, where it goes in the spec, branch name, and the candidates left
    for later — and get explicit approval.

## Handoff

`game-autopilot` calls this skill for steps 1–9 and replaces step 10's
approval by one combined approval (the extension plus the autopilot
agreement). Used directly, this skill ends at step 10 as written.

Once approved, invoke `game-spec` with `PACKAGE=<game-dir>` and pass the
summary from step 10. `game-spec` treats it as a post-publish revision:
new `<type>/<game-dir>-<slug>` branch from `origin/main`, spec revision (see its
"Revisions coming from `game-extend`"), downstream stages reset to
`pending`. From there `game-next` drives the chain as usual.

In this mode the skill touches no files. The candidates the user didn't pick
go into the summary's "left for later" list; `game-spec` records them in
`<game-dir>/docs/backlog.md` on the new branch (and removes the one being
implemented), so the next `game-extend` can offer them again.

## Pin only (`MODE=pin`): agree now, build later

For when the user has time to talk but the build should wait for a later
`game-autopilot` run — typically while grooming the backlog. The dialogue is
the same (steps 1–10, nothing shortened: a later autopilot run has only
what is written here); the ending differs. Nothing is built, no feature
branch is made, no `status_*` key changes.

After the approval of step 10, instead of the hand-off above:

1. Write the agreement into the card in `<game-dir>/docs/backlog.md`, by
   adding these two fields at the end of the card (and correcting the
   card's own 狙い / 何を足すか / 種別 / 規模 where the dialogue revised
   them):

   ```markdown
   - 状態: 着手可（YYYY-MM-DD、基準 `<sha>`）
   - 合意:
     - 足すもの: <concretely; the rules and where on the screen>
     - 操作: <added or changed controls, or なし>
     - 見た目と初期値の方向: <direction; the numbers already decided>
     - 変えないもの: <the must-not-change list>
     - 意図して変えるもの: <existing behavior that changes, or なし>
     - 測ったこと: <bot comparison / hand-worked join from step 5, with conditions; or なし>
     - spec の置き場所: <docs/spec.md の節 / docs/spec/<slug>.md>
     - ブランチ: <type>/<game-dir>-<slug>
   ```

   `基準` is the commit the agreement was made against:
   `git log -1 --format=%h origin/main -- <game-dir>/src <game-dir>/docs/spec.md <game-dir>/docs/spec`.
   Write for a reader without this conversation — `game-autopilot` builds
   from these lines and the spec alone, and stops on anything they don't
   answer. Candidates left for later become cards of their own now (the
   `game-backlog` card format).
2. The card keeps its place in the order unless the user moves it. A pinned
   card is taken before the top card by `game-autopilot`, so pinning is how
   the user says "this one next".
3. Write it on a docs-only branch and open the PR as `game-backlog`
   step 5 does (`docs/<game-dir>-backlog`, or one `docs/backlog-<slug>`
   branch for several games; only `docs/backlog.md` files change;
   `game-review STAGE=backlog`). Several cards pinned in one session — of
   one game or of several — go in **one** PR: write each card to the file
   and commit it on that branch as soon as it is approved (a local commit,
   so a long session cannot lose it), and push and open the PR once, when
   the user has no more cards.
4. Recommend merging that PR right away (it is docs-only, and
   `game-autopilot` holds a game out while a backlog PR for it is open),
   then offer `game-autopilot` (don't start it unasked).

A 着手可 card whose game changes later is checked by `game-autopilot`
against its `基準`; it is not this skill's job to keep it fresh.

What step 2 offers in this mode: only the cards that are not 着手可 yet
(say which ones already are). An idea the user brings that is not in the
backlog becomes a new card first (the `game-backlog` card format, 出どころ:
ユーザー, placed where the user says), and is then pinned like any other.

### Pin sweep (`PACKAGE=all`): the top card of every game, in turn

The grooming session: the user sits down once and leaves a 着手可 card in
as many games as they have time for, so that a later
`game-autopilot N=<count>` has something to run in each.

1. **Build the queue.** `git fetch --prune origin`; the games with
   `next=complete` (`task game:dashboard`) that have a non-empty
   `docs/backlog.md` on `origin/main`. Leave out, and list with the reason:
   - games with work in flight (found as `game-autopilot` "Choosing the game
     and card" steps 1–2 do: open PRs, other worktrees, remote branches) —
     the open PR may change the spec the agreement would rest on;
   - games held by an open backlog PR — recommend merging it first, then
     they join the queue;
   - games that already have a 着手可 card (one waiting card per game is
     enough: `game-autopilot` takes one card per game per run).

   The card of each game is its **top card**.
2. **Show the queue once**, as a table (ゲーム / カード / 種別 / 規模), in
   dashboard order unless the user names another. The user may drop games,
   reorder, or name a different card for a game. Don't ask anything else
   here.
3. **One game at a time**, steps 1–10 for its card, as in "Pin only" —
   same questions, nothing shortened because more games follow. Read that
   game's spec when its turn comes, not all specs up front. Announce each
   turn in one line (`3/14 mazetd: <カード>`).
   - The user can say 「飛ばす」 at any point of a game's turn: leave that
     card as it is (not pinned, nothing written) and go to the next game.
   - A card whose premise is stale, or that turns out to need a decision
     the user wants to sleep on, is skipped the same way; put what was
     learned into the card's メモ so the next session starts from it.
   - Size L: cut the first one-PR step out as its own card and pin that;
     the rest stays as the remaining card.
4. **After each approval**, write that card and commit it (one local commit
   per card on the one `docs/backlog-pin-<YYYYMMDD>` branch, from
   `origin/main`), then go on to the next game without asking whether to
   continue. The user ends the sweep by saying so (「ここまで」); a sweep
   need not finish the queue.
5. **At the end** (queue done or the user stopped): run
   `game-review STAGE=backlog` for the games touched, push, open the one
   docs-only PR, and report: the cards pinned (game / card / branch name),
   the games skipped and why, the games not reached. Recommend merging the
   PR now, and offer `game-autopilot N=<number pinned>`.
