---
name: deploy
description: "Release LiveConsole Ops to the live site at live.kriviinfotech.com — preflight checks, commit and push, npm run deploy over FTPS, then verify the deployed build. Use when the user says deploy, release, live kar do, push it live, or types /deploy."
---

# Deploy LiveConsole Ops

Takes the working tree to <http://live.kriviinfotech.com> and proves it landed.

**Pushing to `main` does not deploy.** The GitHub Actions workflow's
`FTP_PASSWORD` and `PRODUCTION_ENV` secrets are unset, so it skips every step and
still reports success. The release only happens when `npm run deploy` runs here.

Arguments, if the user passed any: `skip-db` forces a code-only release,
`dry-run` stops after the preflight and prints what would upload, `no-commit`
deploys what is already committed and leaves the working tree alone.

## 1. Preflight

Run these before touching anything:

```bash
git status --short && git log --oneline -3 && git status -sb | head -1
npm run typecheck
```

- **Typecheck must pass.** If it fails, stop and fix it — never deploy a red tree.
- `npm run lint` is a no-op that exits 0. It proves nothing; do not report it.
- There is no test suite. `npm run smoke` needs a running API and a local
  database, neither of which exists on this machine.

Work out whether the database is involved: if `apps/api/prisma/` changed since
the last deployed commit (a new folder under `migrations/`, or an edit to
`schema.prisma`), this is a **full deploy**; otherwise pass `--skip-db`.

```bash
git diff --name-only $(git log -1 --format=%H --skip=1) HEAD -- apps/api/prisma
```

## 2. Commit and push

Untracked files written by other tooling — `CLAUDE.md`, `AGENT.md`, `.mcp.json`,
`.cursor/`, `.agents/`, `.windsurfrules`, `.github/copilot-instructions.md`,
`.jetro/` (holds credentials) — are **not** ours to commit. Stage paths
explicitly; never `git add -A` at the repo root.

Write the commit message about *why* the change was made, in the voice of the
existing history (`git log`), and end it with the attribution line the session's
system reminder gives. Then `git push origin main`.

## 3. Deploy

```bash
npm run deploy                 # build → migrate + seed → FTPS sync → health check
npm run deploy -- --skip-db    # code-only release
npm run deploy -- --dry-run    # list what would change, upload nothing
```

Takes a few minutes; run it with a generous timeout and filter the output
(`grep -E "\[deploy\]|Applying|Error|error|fail"`).

Two things worth telling the user when they happen:

- A release that touches Prisma files flips the site to `maintenance.html` while
  it uploads, then back — a short interruption, not a failure.
- A full deploy runs `prisma migrate deploy` **and** `db:seed`. Seeding is what
  creates the permission rows a new module needs, so a release that adds one is
  not live until it has run.

**A migration changes live data.** Before running one that rewrites rows, read
the affected rows first (read-only, via `apps/api/.env.production` + Prisma),
save them to the scratchpad, and tell the user how many rows and how much money
will move. Ask before proceeding unless they already agreed to that specific
change.

## 4. Verify, then report

The deploy's own health check is not enough — confirm the live site is serving
the new build:

```bash
curl -s -o /dev/null -w "site %{http_code}\n" http://live.kriviinfotech.com/
curl -s http://live.kriviinfotech.com/ | grep -o 'assets/index-[^"]*\.js'
```

Then grep the deployed chunk for a string only the new code contains — take the
chunk's hashed name from `apps/web/dist/assets/`, fetch it from the live host and
look for the label or copy just changed. For an API change, check
`apps/api/dist/server.cjs` (the file that was uploaded; `/app` is blocked from the
web) for the route or field.

Report to the user: what went live, the commit, whether the database was touched,
and what you actually verified — stating plainly anything you could not check.
Nobody is logged into the app here, so screens behind sign-in are for them to
test; remind them to hard-refresh (Ctrl+F5).
