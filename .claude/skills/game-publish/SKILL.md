---
name: game-publish
description: Use for the final step of adding a finished game to this monorepo's public listing — registering it in Taskfile.yml's LAB_GAMES (labs.html) by default, or GAMES (top page) only when asked, and opening an "add one game" PR (AGENTS.md section 2.2) — or, for a post-publish revision (fix/balance/extension), checking README and opening that revision's PR.
allowed-tools: Bash(deskil --version), Bash(deskil flow:*)
---

Before anything else, run `deskil --version`. If the command is not found, tell the user to run `uv tool install git+https://github.com/wtnb75/deskil` and stop.

# game-publish

Add `<game-dir>` to the public top-page listing and open a PR for it. This
is the last workflow stage — only run it once balance has been signed off
by the user. For a post-publish revision, the listing is already done —
the "one thing" this stage scopes to is that revision (fix/balance/
extension), not the original add.

Run this skill as a step-by-step flow:

1. Run `deskil flow start .claude/skills/game-publish/flow.toml`.
2. Follow the instructions in the output. When the work is done, run the
   `next` command shown at the end of the output.
3. Repeat until the output ends with `Flow complete.`

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.
- Requires `status_balance: done` for this game.

## Top-page card

Check the top-page card data: the `index` field of
`<game-dir>/package.json` (`{ title, summary, tags }`;
`scripts/build-index.mjs` builds the card from it, falling back to the
directory name and `description` when it is missing). Compare it with
`docs/spec.md` and `README.md` (what the game is now, not what it was at
the prototype):
- **Missing** → add it. **Present but stale or off-convention** → change
  it. Otherwise leave it alone (don't churn wording that is fine).
- The card is a pitch, not a description: the point is the game's selling
  point in one playful line, like a game's catch copy. It is not the
  place for an earnest explanation (that is `README.md`'s job). The card
  text is separate from the title screen's name; don't copy one to the
  other.
- `title`: `<main subject>「<one-line hook>」` — e.g. `モグラ「叩ける？」`,
  `ミノ「ちょっと屋上行こうぜ」`, `地雷「オレを部屋に置くなよ！」`,
  `電卓「60 秒で支度しな！」`. The subject is what the player deals with (a
  mole, a mine); the hook is a line the subject itself says (or a
  well-known line bent to fit), absurd enough to stick. Aim for impact over
  explanation; a pun or a borrowed catchphrase is welcome.
- `summary`: 1–2 short, jokey Japanese sentences that say what you do and
  what is fun or tricky, in a cheeky tone — e.g. 「探して、ぶっ叩く！
  ただしネコ以外をな！！ お前の中のハンマーを目覚めさせろ」. No controls
  list, no rule details, no numbers that change under balance; stay true to
  the game (a joke must not promise something the game does not do).
- `tags`: genre first, then the input methods the game really supports,
  always in the order `タッチ` → `マウス` → `キーボード` (the top page's
  filter chips are ordered by first appearance, so a stable order keeps
  them stable). A game played with pointer input gets both `タッチ` and
  `マウス` (touch and mouse are the same Phaser pointer events). Reuse
  existing tags — list them with `rg -N -A8 '"tags"' */package.json` —
  and add a new one only when none fits.
- Keep `description` (what the game is, for developers) separate from
  `summary` (what the player sees on the card); don't copy one to the other
  blindly.
- On a post-publish revision, re-check it too: an extension that adds a
  mode or an input method (or a balance change that alters the pitch) can
  make the card wrong. Include the change in this PR.

## Added by the flow conversion

- The steps (README, favicon, card, listing, backlog, PR confirmation,
  the review, writing `status_publish: done` before the commit, the
  commit / push / PR, completion) live in `flow.toml`.
- `fix_review` has `max_visits = 2`; exceeding it ends at `blocked`.
