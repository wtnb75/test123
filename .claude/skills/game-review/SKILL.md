---
name: game-review
description: The stage-exit review for this monorepo's game workflow — called by each game-* skill before it marks its stage done (STAGE=idea/backlog/extend/title/init/proto/spec/impl/test/check/codereview/qa/polish/balance/publish). Holds every stage's review checklist, one file per stage (only the reviewed stage's file is read); spec/impl/test are reviewed by a fresh subagent, the rest by self-review.
---

# game-review

One place for "is this stage really ready to hand off?". Each `game-*` skill
calls this with its own stage before marking itself `done`. This skill does
not change status keys — the calling skill does that after the review
passes.

## Inputs

- `STAGE=<stage>` — the stage being completed.
- `PACKAGE=<game-dir>` (not needed for `STAGE=idea`; required for `STAGE=extend`).

## Principle: review for the next stage's needs

A stage is done when the **next** stage can start without guessing, not
when its own output merely looks complete. Each checklist (one file per stage, see the end) is written
from the point of view of whoever consumes the output next (e.g. the spec
checklist asks "can someone implement this without inventing anything?").

## Method per stage

| STAGE | Reviewer | Why |
|---|---|---|
| `spec`, `impl`, `test` | **Fresh subagent** (see below) | The output is consumed by the next stage; the author fills gaps from conversation context without noticing |
| `idea`, `backlog`, `extend`, `title`, `init`, `proto`, `check`, `codereview`, `qa`, `polish`, `balance`, `publish` | Self-review against the checklist | Mechanically verifiable, or the user's subjective call — a subagent would only re-derive context (`codereview` already ran its own independent reviewer) |

### Running a subagent review

Launch one `general-purpose` agent (Agent tool). Give it **only**:

- the game directory, the stage, and the path of the stage's checklist file
  (`.claude/skills/game-review/stages/<STAGE>.md`), which it reads itself —
  the "Checklist" subsection including its "Don't flag" list. Don't paste
  the checklist into the prompt;
- the artifacts to read (listed at the top of that file);
- for a revision: a 1-3 line summary of what changed and why, so it can
  focus on the changed parts — nothing else from the conversation.

Don't pass the conversation, design rationale, or your own opinion of the
output: the point is to see whether the artifact stands on its own.

Tell the agent: read-only (no edits, no git state changes), and return
findings in this format, blockers first:

```
- [blocker|should|nit] <location: file:line or spec section>
  problem: <what's missing/wrong>
  impact: <what the next stage would have to guess, or what breaks>
  suggestion: <concrete fix, or the question to ask the user>
```

and, when there are none, say `no findings` explicitly.

A report is valid only if it also lists what was checked (a short
"確認したこと": which files, compared with what). Ask for that section in
the prompt. A one-word or empty answer ("placeholder", "done") is not
`no findings`: send the same task again with the section required, and
say in the review summary that the first answer was empty.

### Severity

- **blocker** — the next stage would have to invent a player-visible
  behavior or value, the output contradicts the spec / AGENTS.md, or
  something is plainly broken. Blocks completion.
- **should** — worth fixing, but the next stage can proceed without it.
- **nit** — wording, style, taste.

### Handling findings (keep it moving)

1. Check each finding before acting on it — the reviewer lacks context and
   can be wrong. Discard a finding only with a stated reason.
2. Fix blockers that you can resolve from facts already agreed (the
   concept, earlier user answers, AGENTS.md).
3. Blockers that need a decision only the user can make (a rule, a number
   with gameplay weight): collect them and ask the user **once**, together
   — not one question per round.
4. Re-run the review after fixing blockers. **At most 2 review rounds.**
   Anything still flagged after round 2 goes to the user as a list with
   your recommendation, instead of a third round.
5. `should`/`nit`: fix the cheap ones; show the rest to the user in one
   short list at completion. They never block.
6. Report to the user in one short block: rounds run, blockers fixed,
   questions answered, remaining should/nit.

## Checklists: one file per stage

Each stage's checklist is its own file next to this one. Read **only** the
file of the stage being reviewed (`.claude/skills/game-review/stages/<STAGE>.md`)
— not the others.

| STAGE | Reviewer | File |
|---|---|---|
| `idea` | self | `stages/idea.md` |
| `backlog` | self | `stages/backlog.md` |
| `extend` | self | `stages/extend.md` |
| `title` | self | `stages/title.md` |
| `init` | self | `stages/init.md` |
| `proto` | self | `stages/proto.md` |
| `spec` | subagent | `stages/spec.md` |
| `impl` | subagent | `stages/impl.md` |
| `test` | subagent | `stages/test.md` |
| `check` | self | `stages/check.md` |
| `codereview` | self | `stages/codereview.md` |
| `qa` | self | `stages/qa.md` |
| `polish` | self | `stages/polish.md` |
| `balance` | self | `stages/balance.md` |
| `publish` | self | `stages/publish.md` |
