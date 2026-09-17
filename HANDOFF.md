# Handoff — LiveConsole Ops

Written on 2026-09-17, at the end of a session that shipped the branding, the
formatting changes and the removal of expense approval. Read `README.md` for how
the system is built; this file only covers **where things stand and what is
still open**.

---

## State right now

- Branch `main`, working tree clean, `main` == `origin/main`.
- Latest commit **`6805122`**, and that is exactly what is live at
  <http://live.kriviinfotech.com> (health check passed after the deploy).
- Live database holds **test data only** — 2 employees, ~10 expenses, 1 rental.
  A figure that looks wrong there is usually a test entry.

Shipped in this session, newest first:

| Commit | What |
| --- | --- |
| `6805122` | Numeric table headings align over their figures (`:where()` fix in `index.css`) |
| `f530d56` | Vehicle Rentals leads with three tiles: on rent, rent paid, pending rent |
| `dcd0706` | **Expense approval removed** — API, UI, permission, and a data migration |
| `5769a26` | Dashboard leads with an employee's totals; figures dropped the monospace face |
| `60ac38c` | Amounts are plain figures — no ₹, Indian grouping, two decimals |
| `8e0698a` | Expense remark optional; `Paid to` off the form |
| `20c56d7` | LiveConsole logo, orange theme, favicon, dark sign-in panel |

## Rules that changed — code or copy still assuming the old ones is stale

**The ledger is `cash given − returned − expenses`.** There is no approval step.
An expense counts from the moment it is filed, every expense is editable and
deletable by its owner (or `expenses:manage`), and `expenses:approve` no longer
exists. `Expense.status` and the three review fields remain in the database as a
record of what was reviewed while approval existed; nothing writes them and new
rows default to `APPROVED`. The one definition of the balance lives in
`apps/api/src/services/ledger.service.ts` — dashboard, balances and statement all
read it, so they cannot disagree.

**Amounts carry no currency symbol** and are formatted once, in
`packages/shared/src/utils/format.ts`. `.numeric` is tabular figures only, not a
monospace font.

**Brand tokens** are in `apps/web/src/index.css`: primary is a deeper orange
(`20 86% 42%`) chosen so white text on it passes WCAG AA; `--brand-red/orange/
amber` are the logo's own gradient stops, for accents only, never for text.

## Open items

1. **Untracked files nobody has decided on:** `CLAUDE.md`, `AGENT.md`,
   `.mcp.json`, `.cursor/`, `.agents/`, `.windsurfrules`,
   `.github/copilot-instructions.md`, `.jetro/` (which holds `credentials.json`).
   They were written by other tooling, not by this work. The user was offered a
   `.gitignore` entry twice and has not answered — ask before committing or
   ignoring them.
2. **Test data cleanup.** The user knows the live data is dummy. Three options
   were offered (clear transactions only / clear everything but the admin /
   pick records). Nothing may be deleted until they choose.
3. **Two tile-wording offers the user has not taken up:** making "Total received"
   show the net of returned cash (they asked why 45,000 received − 33,100 spent
   showed a −100 balance; the 12,000 returned is only a hint line), and matching
   the Balances column headings ("Given", "Expenses") to the dashboard's wording
   ("Total received", "Total expense"). Same numbers either way.
4. **Docs drift.** `README.md` and `GUIDE.md` still describe an empty dashboard,
   "no file uploads" and an approval flow in places. `GUIDE.md` is largely the
   starter's text.

## Two commands live in this repo

`.claude/skills/` holds the project's own slash commands:

- **`/handoff`** — both directions. At the start of a session it reads this file,
  checks it against the repo and the live site, and reports what is open. At the
  end it rewrites this file and updates memory. It asks which you meant only when
  that is genuinely unclear.
- **`/deploy`** — preflight (typecheck, working out whether Prisma changed),
  commit and push, `npm run deploy`, then verifies the live bundle actually
  carries the change. It never commits the tooling files listed above.

## Working notes for this machine

- **Deploy from here, not from CI.** `npm run deploy` (add `--skip-db` when there
  is no migration). Pushing to `main` deploys nothing — the workflow's secrets
  are unset, so it skips and still reports success.
- **Ports 5273/4100 belong to the user's other project** (PratishthaRent). To run
  this web app locally use `npx vite --port 5274` from `apps/web`, and never kill
  the other project's processes.
- **There is no local `apps/api/.env` and no local database for this project.**
  Local Postgres on 5432 exists but is the other project's. Nothing here has been
  run against a local DB; verification has been typecheck + build + fetching the
  deployed assets and grepping them.
- **No Python, ImageMagick or patchright.** For screenshots, drive headless Edge
  over CDP from Node (its built-in `WebSocket` works); for image work, PowerShell
  `System.Drawing`. Both were used successfully this session.
- **Nobody has logged into the app here** — there are no credentials in this
  environment, so screens behind sign-in have never been seen directly. The user
  tests those and sends screenshots.
- Read-only production queries are possible with `apps/api/.env.production` +
  Prisma, and were used to check figures before a data migration. Treat writes
  through that path as off-limits unless the user asks.
