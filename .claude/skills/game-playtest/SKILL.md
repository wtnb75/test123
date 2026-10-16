---
name: game-playtest
description: Use when the user wants to play an open game PR before merging it — picks the PR, publishes its dev server through a tunnel, waits for the user's verdict, squash-merges on OK, and reflects change requests on the same PR branch until it is OK.
---

# game-playtest

The last human step for a game PR (typically one opened by `game-autopilot`,
`game-publish` or `game-balance`): play it, then merge it or change it.

The user asking for this skill is the request to publish the dev server
(AGENTS.md 9.1: it is never published on the agent's own initiative). The
URL has no authentication, so give it only to the user, and stop the tunnel
whenever this skill ends or pauses for long.

## Inputs

- `PR=<number>` (optional). If not given: `gh pr list --state open --json
  number,title,headRefName,statusCheckRollup` and show those whose branch
  looks like `<type>/<game-dir>[-slug]` (`feat`/`fix`/`balance`). Ask the
  user which one. Derive `<game-dir>` from the changed files
  (`gh pr diff <n> --name-only`); a PR touching several games, or none, is
  not for this skill — say so.
- Needs `cloudflared` (see `scripts/qa/share.sh`). If missing, say so and
  stop; don't look for another tunnel service.

## Process

1. **Check out the PR branch.** `gh pr checkout <n>`. If it refuses because
   the branch is checked out in another worktree, stop and tell the user
   where. Run `pnpm install` if the lockfile or the game's `package.json`
   changed. Read `<game-dir>/docs/spec.md` (and linked files) for what the
   PR changes, and the PR body.
2. **Check the state before asking anyone to play**: `gh pr checks <n>` and
   `gh pr view <n> --json mergeable,mergeStateStatus`. Failing CI or a
   conflict is reported first; fix a conflict by merging `origin/main` into
   the branch only if the user says so. Don't send someone to play a PR that
   CI already rejects.
3. **Publish.** `scripts/qa/share.sh <game-dir> [port]`; its last stdout line
   is the URL. Give the user: the URL; one line on what the PR changes; a
   short checklist of what to try (the new element; the 「変えないもの」 from
   the spec/PR body, so regressions get noticed; small-screen layout if the
   UI changed). Then end the turn and wait.
4. **Verdict.** Act on the user's words:
   - **OK** ("OK", "マージして", "いいよ") → step 5. A vague "いい感じ" is
     not a merge instruction: ask once.
   - **Change requests** → step 6.
   - **Not wanted** → stop the tunnel, leave the PR open, and say what is
     left. Closing the PR needs its own instruction.
5. **Merge.** Re-run the checks from step 2 (CI green, mergeable). Then
   `gh pr merge <n> --squash --delete-branch`. If it reports only a local
   checkout/branch cleanup problem (common in worktrees), confirm with
   `gh pr view <n> --json state` that it is `MERGED` and carry on. Stop the
   tunnel (`scripts/qa/down.sh <game-dir> [port]`) and report the merged PR.
   Offer the next step in one line: `game-autopilot` (next backlog card) or
   `game-next`.
6. **Reflect the requests on the same PR.** Don't open a new branch or PR.
   - Write the requests as a short numbered list and classify each:
     look-only, numbers, or rules/behavior. Anything not obviously one
     change is split; if it is a different purpose from the PR's, say it
     belongs to a later PR and leave it out.
   - Run the normal chain on the PR's branch: `game-spec` revision (tell it
     the branch is the open PR's, so it does not create another), then
     `game-next`. The user's requests in this conversation are the
     agreement for their content, so the **Autopilot** rules of
     `game-autopilot` apply to this loop (the spec approval, codereview
     triage and publish confirmation are not asked again; a gap in the
     requests still stops and asks). Numbers the user asks to change are
     changed as asked; no other tuning.
   - `game-publish` here means: commit, push to the existing branch, and
     update the PR title/body if the content changed (`gh api -X PATCH
     repos/<owner>/<repo>/pulls/<n> -F body=@<file>`; `gh pr edit` fails
     here). No `gh pr create`.
   - The dev server picks up the change; tell the user to reload the same
     URL and what to look at. If the tunnel was stopped, run `share.sh`
     again (the URL changes). Back to step 4.

Every exit (merged, not wanted, blocked) stops the tunnel and the dev server
(`scripts/qa/down.sh`) unless the user wants to keep playing.

## Checklist (before reporting a merge)

- The PR merged was the one the user played, at the head commit they played
  (no push after the last verdict that they haven't seen).
- CI was green and the PR mergeable at the moment of the merge.
- The tunnel and the dev server are stopped.
- The user's change requests are all either done, or listed as left for a
  later PR.
