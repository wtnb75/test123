---
name: game-backlog
description: Use when the user wants extension ideas for a published game in this monorepo, wants to see, grow, reorder or prune its backlog of candidate features, or game-extend finds no backlog to pick from. Conversation plus one docs-only change to <game-dir>/docs/backlog.md.
---

# game-backlog

Keeps `<game-dir>/docs/backlog.md`: the ranked list of things that could be
added to a published game next. `game-extend` picks the top card from it
and pins one down; this skill is where cards are found, written, ranked
and pruned. It never touches the spec, code or `status_*` keys.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:dashboard` and ask the
  user to pick one of the games with `next=complete`.
- Several games at once are fine (`PACKAGE=a,b,c`, or "all" / 「全部」 for
  every `next=complete` game — a grooming session): do steps 1–4 per game,
  ask the ranking questions of all games in as few messages as it takes,
  and write them in **one** branch and PR (step 5). `task backlogs` (the
  number of cards per game) shows which games are running thin.
- Requires `status_publish: done` — ideas for an unshipped game belong in
  `game-idea` / its MVP scope, not a backlog.

## Sources — every new card cites one

1. **Spec analysis.** Read `docs/spec.md`, every linked `docs/spec/*.md`,
   `README.md` and the current backlog. Look for: the core loop's decision
   ("the one choice the player keeps making") and where it is shallow;
   非MVP範囲 items; parts of the パラメータ表 that nothing in play pushes
   on; stretches of the difficulty timeline where nothing new happens.
2. **Automated play numbers.** Drive the game's pure logic (AGENTS.md 4:
   rules live in `src/game/logic/`) with a simple bot, headless, over
   seeded runs — see "Automated play" below. Record what the numbers say
   about pacing and threats: survival time, score, share of hits by
   source, how often each enemy/event appears and gets beaten, dead
   stretches, caps that are hit.
3. **The user's ideas.** Take them as given; ask back only for what the
   card needs (the problem it solves, if not obvious).

An idea with no problem behind it ("more content", "a mode would be nice")
is not a card. Either find the problem it solves in sources 1–2, or ask
the user what feels missing that it would fix.

A problem that only needs existing numbers retuned (one orientation much
easier, one enemy causing most hits) is not a card either: report it to
the user as a `game-balance` finding.

## Card format

`docs/backlog.md` is ordered: top card = next up. Each card:

```markdown
### <タイトル>（`<slug>`）

- 狙い: いまのゲームで何が物足りないか。根拠: <spec の節 / 自動プレイの数字（条件つき）/ ユーザーの声>
- 何を足すか: 1〜2 行
- コアループへの効き方: 深める / 広げる — どう効くか
- 種別: gameplay / presentation-only
- 規模: S / M / L（L は game-extend で 1 PR 分に切り出してから採用）
- 出どころ: spec 分析 / 自動プレイ / ユーザー
- メモ: 見送った経緯・依存・注意点（なければ省く）
```

A card that `game-extend MODE=pin` has pinned down carries two more fields
at its end, `状態: 着手可（日付、基準 <sha>）` and `合意:` (see `game-extend`
"Pin only"). `game-autopilot` builds such a card without the dialogue, and
takes it before the top card. This skill does not write those fields. Keep
them as they are when reordering; when an edit here changes what the card
adds (or its evidence went stale), remove both fields and tell the user the
card needs pinning again. In the ranking table, mark these cards 着手可.

Keep the file's short header (what the file is, that it isn't spec, the
S/M/L meaning). Cards written earlier in the one-line style are converted
to this format the first time this skill touches the file.

## Process

1. `git fetch` and read `origin/main`'s backlog, not a stale local copy.
2. Gather from the sources above. Automated play is optional for a pure
   reprioritise/prune request; for "give me ideas" run it.
3. Draft 3–8 new cards (fewer, stronger ones beat a long list), plus any
   edits to existing ones: merge duplicates, update evidence that went
   stale (e.g. a card about an enemy's pacing after that enemy changed),
   and propose dropping cards whose problem is already solved.
4. **Rank with the user.** Show the proposed order as a table (順位 /
   タイトル / 種別 / 規模 / 狙い / 推奨理由), recommending by how directly
   it strengthens the core loop's decision and by size. Ask once: accept
   the order, reorder, drop or add. The user's order is final.
5. **Write** on a docs-only branch from `origin/main`:
   `docs/<game-dir>-backlog` for one game, `docs/backlog-<slug>` for several
   (next free `-2`, `-3`, ...). Change only `docs/backlog.md` files. Run
   `game-review STAGE=backlog PACKAGE=<game-dir>` (per game),
   then commit and — after the user confirms — push and open a docs-only
   PR (no behavior/build/test impact).
6. **Get it merged soon.** While this PR is open, `game-autopilot` holds
   every game it touches out of its candidates (the order on `origin/main`
   is not the agreed one yet), and a feature PR that removes a card can
   conflict with it. Say so, and recommend merging now. If the user tells
   you to merge: `gh pr checks <n>` green, then
   `gh pr merge <n> --squash --delete-branch`. Don't merge unasked.
7. **Hand off.** Offer the next step, without starting it unasked:
   `game-extend PACKAGE=<game-dir> MODE=pin` to pin down cards now for a
   later `game-autopilot` run (when the user has time to talk but not to
   build), `game-extend` to build the top card now, or `game-autopilot`.

Dropped cards leave the file; say why in the PR body, not in the backlog.

## Automated play

A throwaway harness, never committed:

- Put a `*.test.ts` file under `<game-dir>/src/game/logic/` (vitest
  already resolves it there), run it with `npx vitest run <file>`, then
  remove it with `git clean -f <file>`. Keep the source in the scratchpad
  so it can be rerun. Vitest does not show a test's `console.log` here:
  write the numbers to a file in the scratchpad (`writeFileSync`) and read
  it afterwards.
- Build the game's logic entry point (e.g. its `World`) with a seeded rng;
  drive it at a fixed dt with a bot that plays plausibly but simply (flee
  close threats, stay near the player's usual area, release/act on a
  simple rule). Try 2 bot styles if the core decision has two ends (e.g.
  release early vs hold long) and both screen orientations the game
  supports. 40–60 seeds per condition is enough.
- Report medians, not single runs, with the conditions ("landscape, bot
  releases at 20, 60 seeds"). State plainly what a simple bot can't tell
  you (feel, whether a human would take a risk the bot never takes).

## Relationship to other skills

- `game-extend` reads the backlog top-down and pins down one card; the
  card's 狙い / 効き方 / 種別 / 規模 are its starting point, not a decision
  already made. With `MODE=pin` it writes the agreement back into the card
  (状態: 着手可) on a backlog branch like this skill's.
- `game-autopilot` takes a 着手可 card first, and holds a game out while a
  backlog PR for it is open.
- `game-spec` removes the adopted card on the feature branch and adds the
  candidates `game-extend` left for later — in this card format.
- `game-next` offers this skill for a published game with nothing pending.

## Completion

The backlog PR is open (or the user chose to keep it local), the user has
agreed the order, and `game-extend` has been offered. No `status_*` key
changes.
