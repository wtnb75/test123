# STAGE=qa (self) — consumer: game-polish

- Is there a screenshot for every Scene and every state transition named in
  the spec — spec.md and its linked files (title, mid-play, clear,
  game-over, overlays)?
- For a revision: was the change classified (shared parts / local change /
  wording only, with the one-line reason), and was the matching set re-shot
  — everything for shared parts; the changed states plus one shot per Scene
  on both viewports plus the reachable regression items for a local change?
- For each screenshot, can you say which spec rule/Scene it confirms?
- Is each 完了条件 in the spec (spec.md and its linked files, including
  split files' regression conditions) checked by either a screenshot or
  an earlier stage (test/check)? List any that nothing checked.
- Was feel (speed, hit detection, transition timing) judged against the
  spec, not just "it rendered"?
- Was the shared build (`scripts/qa/up.sh <game-dir> <port> --shared`) served
  under the sub-path and smoke-tested (no console errors / failed requests),
  and were its screenshots looked at?
- In autopilot (`<game-dir>/.autopilot.md` exists): were the states where the
  change shows shot at all four sizes of AGENTS.md 4.6, and the files
  kept for `game-polish`?
- Were the QA container and server actually cleaned up?
