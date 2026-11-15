# STAGE=impl (subagent) — consumer: game-test

Artifacts for the subagent: `<game-dir>/docs/spec.md` and every `docs/spec/*.md` it links to; the change set —
`git diff origin/main -- <game-dir>` plus untracked files from
`git status --porcelain --untracked-files=all -- <game-dir>` (for a first
implementation, simply all of `<game-dir>/src`); AGENTS.md section 4.

Run after `npm run build` succeeds, before offering the user a manual
check.

### Checklist

- **Prototype removed** (first implementation after `game-proto`): no
  `src/proto/` directory remains and `src/main.ts` imports `./game/main`.
- **Spec conformance**: for each rule, state transition and parameter in
  the spec (spec.md and its linked files), point to where it is
  implemented. Anything missing is a blocker;
  anything implemented that the spec doesn't ask for is a blocker unless
  it's an implementation detail with no player-visible effect.
- **Invented behavior**: any player-visible behavior decided in code that
  the spec neither states nor delegates in 実装裁量 → blocker (route to a
  spec revision, don't just accept it).
- **Parameters**: values from the パラメータ表 live in one place (constants
  / config), not scattered literals, so game-balance can tune them.
- **Testability for game-test**: game logic is separable from Scenes (pure
  functions/classes); time and randomness are injectable.
- **Phaser rules (AGENTS.md 4.2)**, each checked individually: Scene
  responsibilities separated; `preload`/`create`/`update` not mixed; no
  needless allocation in `update`; explicit state, no globals; input
  listeners registered once and cleaned up on shutdown.
- **Distribution (4.3)**: no Node-server-only APIs; asset paths survive
  `vite build`.
- **Scope**: every changed file serves this change's one purpose — no
  drive-by refactors or unrelated formatting.
- **Revision**: only the parts affected by the spec change were modified;
  existing feel (input response, speed, transitions) is unchanged unless
  that was the point.

Don't flag: test coverage (game-test), lint style (game-check), fun/tuning
(game-balance).
