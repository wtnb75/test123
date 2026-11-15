# STAGE=check (self) — consumer: game-qa

- All four commands (lint, test, test:coverage, build) passed in the last
  run, from the top, after the last fix.
- Was any failure masked instead of fixed (new lint-disable comment, looser
  assertion, lowered threshold)? Masked doesn't count.
- Do lint-disable comments in the diff carry a reason and minimal scope?
- Does `public/` contain any file not referenced by `src/` or `index.html`?
- If the build setup changed: does `dist/` actually look like a working
  static site?
