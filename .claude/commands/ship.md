---
description: Run lint + build, then commit and push the current branch
argument-hint: "[optional commit message or scope note]"
allowed-tools: Bash(npm run lint), Bash(npm run build), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git rev-parse:*), Bash(git branch:*), Read, Edit, Glob, Grep
---

Verify, then commit and push the current work.

Extra instruction from the user (may be empty): $ARGUMENTS

## 1. Inspect

Run `git status` and `git diff` (plus `git diff --staged`) to see what is about to ship.
If there is nothing to commit, say so and stop — do not run the build for nothing.

Never stage or commit secrets: `.env*`, `*.pem`, keys, or anything containing
`ENCRYPTION_KEY` / `HASH_KEY` / `SUPABASE_SECRET_KEY` / `POLAR_*` values.
If such a file shows up as untracked or modified, stop and report it instead of committing.

## 2. Verify

Run both, in this order:

```bash
npm run lint
npm run build
```

If either fails:

- Fix the cause of the failure (this is the point of the command — do not just report and quit).
- Re-run the failing step, then re-run the full sequence from `npm run lint` once it passes.
- Repeat up to 3 attempts. If it still fails after 3 attempts, stop, do **not** commit,
  and report exactly what is failing with the relevant output.
- If a failure is clearly pre-existing and unrelated to the current diff, say so and ask
  the user whether to ship anyway rather than deciding on your own.

## 3. Commit

Stage only files that belong to this change (`git add <paths>` — avoid a blind `git add -A`
unless every changed file is clearly part of the work).

Write the commit message in **English**, following the repo's recent style
(`feat:` / `fix:` / `refactor:` prefixes — check `git log --oneline -10`).
Describe *why* the change was made, not a file-by-file list.
If `$ARGUMENTS` is non-empty, use it as the intent for the message.

End the commit message with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Do not use `--no-verify` or skip signing.

## 4. Push

Push the current branch to `origin`. If the branch has no upstream, use `git push -u origin HEAD`.
If the push is rejected as non-fast-forward, stop and report it — never force-push here.

## 5. Report

One short summary: verification result, commit hash + subject, and the branch pushed to.
