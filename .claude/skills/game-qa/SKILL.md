---
name: game-qa
description: Use to visually confirm a game in this monorepo actually works in a real browser — canvas rendering, input feel, clear/game-over states — via the Docker+Playwright headless-browser procedure in AGENTS.md section 9.
---

# game-qa

`game-check` verifies lint/test/build pass. This skill verifies the game
*actually renders and plays* — Vitest can't see canvas output, so this is
the only step that looks at real pixels.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.
- Requires `status_codereview: done` for this game — if not, send the user
  back to `game-codereview` (or `game-check` before it) first.

## Procedure — full detail in `AGENTS.md` section 9, summary here

`task game:status:set PACKAGE=<game-dir> STAGE=qa VALUE=in_progress`

1. Start the dev server in `<game-dir>`: `npm run dev -- --port <PORT> --host 0.0.0.0`.
2. If headless Chromium isn't available directly in this sandbox, use a
   `mcr.microsoft.com/playwright:<tag>` container instead:
   - Find *this* session's own Docker network first (`hostname` →
     `docker inspect <id> --format '{{json .NetworkSettings.Networks}}'`).
     `--network host` on the QA container points at the wrong host — it
     will not reach this session's `localhost`.
   - Start the QA container on that **same** network name, not `host`.
   - Hit the dev server via this session's own IP, not `localhost`.
3. Never bind-mount host paths into the QA container (`-v`) — on this class
   of sandbox it silently yields an empty directory. Move files in/out with
   `docker cp`.
4. The Playwright image ships the browser only — `npm install
   playwright@<version>` (matching the image tag) inside the container
   before using it.
5. Take `page.screenshot()` shots at the states that matter for this game
   (title, mid-play, clear, game-over) and `docker cp` them out for visual
   inspection — judge on speed feel, hit-detection feel, and whether
   transitions match the spec, not just "it didn't crash". The spec is
   `docs/spec.md` plus its linked `docs/spec/*.md` files.

   For a revision (this game passed QA before — e.g. after `game-extend`),
   also re-shoot every existing Scene/state listed above, not only the
   changed parts, and check them against the regression conditions in
   完了条件: the change must not have altered what it was meant to leave
   alone.
6. Clean up: `docker rm -f <qa-container>` and stop the dev server. Always,
   even if QA failed.

## On failure

Don't mark this stage done. Report what looked wrong with the screenshots
as evidence, and route back to `game-impl` for a fix (one change, one
purpose — don't bundle the fix with unrelated work).

## Review (before completion)

Run `game-review STAGE=qa PACKAGE=<game-dir>` — a self-review against
its `STAGE=qa` checklist — before marking this stage done. Fix anything that
fails rather than just noting it.

## Completion

1. Screenshots confirm the game renders and behaves as the spec describes.
2. `task game:status:set PACKAGE=<game-dir> STAGE=qa VALUE=done`
3. Tell the user the next step is `game-polish`.
