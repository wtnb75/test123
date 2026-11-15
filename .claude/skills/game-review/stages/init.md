# STAGE=init (self)

- Is the current branch `feat/<game-dir>` (or the next free `-2`/`-3`/...
  variant), branched from `origin/main`?
- Did `task newgame` finish — is `<game-dir>/package.json` the merged
  version (has `catalog:` deps from `base.json`)?
- Is `<game-dir>` registered in `pnpm-workspace.yaml` and as a
  commented-out line in `Taskfile.yml` `GAMES`?
- Does `<game-dir>/docs/spec.md` have all 12 `status_*` keys, `idea`/`init`
  `done`, the rest `pending`?
- Did `pnpm install` run (`<game-dir>/node_modules` exists,
  `pnpm-lock.yaml` changed)?
- Does `package.json` `description` describe this game?
- Was `task game:favicon` run (`public/favicon.png` differs from
  `scaffold/base-template/public/favicon.png`)? If it failed, was the user
  told?
