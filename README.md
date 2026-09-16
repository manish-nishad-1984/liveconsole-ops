# LiveConsole Ops

Internal web app for LiveConsole staff: **petty cash** (cash/UPI issued to
employees, expenses with receipts and balances) and
**transportation** (rented vehicles per site, rent periods, payments).

Live: <http://live.kriviinfotech.com>

Built on an ERP starter: React + Vite on the front, Express + Prisma + PostgreSQL
behind it, with authentication, RBAC, an audit trail and a module registry already
wired together end to end.

---

## Deployment

The live host is Windows shared hosting (IIS 10 + iisnode, Node 25) with
PostgreSQL behind PgBouncer. There is no SSH — files go up over FTPS.

```bash
npm run deploy                  # build → migrate + seed → upload changes → health check
npm run deploy -- --dry-run     # list what would change
npm run deploy -- --skip-db     # code-only release
```

Two local files, both git-ignored, hold the credentials:

| File | Holds |
| --- | --- |
| `.env.deploy` | `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, `FTP_ROOT`, `SITE_URL` |
| `apps/api/.env.production` | The server's runtime `.env` (uploaded to `/app/.env`) |

Pushing to `main` runs the same script in GitHub Actions once the repository
secrets `FTP_PASSWORD` and `PRODUCTION_ENV` (the full contents of
`.env.production`) are set.

How it fits together (`deploy/iis/`, `scripts/deploy.mjs`):

- IIS serves the Vite build directly; `/api/*` is rewritten to `app/server.cjs`,
  which iisnode runs. Everything under `/app` is blocked from the web.
- The API is bundled by tsup into one CommonJS file. The only `node_modules` on
  the server is Prisma's client and its Windows query engine.
- `PORT` is a named pipe under iisnode, not a number — `env.ts` accepts both.
- The database URL needs `pgbouncer=true`; port 6432 is the only one reachable.
- Uploads are hash-diffed against `/app/.deploy-manifest.json`, so a release
  only sends what changed. The root `web.config` is rewritten last on every
  deploy, which recycles the Node process onto the new build.
- When Prisma's files change, the site is switched to `maintenance.html` first
  so iisnode releases its lock on the engine binary.
- iisnode's logs are in `/app/iisnode/` over FTP.
- The site has no SSL yet, so `COOKIE_SECURE=false`. Turn on SSL in the hosting
  panel, then set it to `true` and `WEB_ORIGIN` to `https://…`.

---

## Quick start

```bash
npm install                      # workspace root
cp apps/api/.env.example apps/api/.env    # then edit DATABASE_URL and the JWT secrets
npm run -w @liveconsole-ops/api db:migrate
npm run db:seed
npm run dev                      # API on :4100, web on :5273
```

Sign in at <http://localhost:5273> with the credentials from `apps/api/.env`
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). The seeded account is flagged
`mustChangePassword`, so it lands on the change-password screen first — that is
deliberate: the bootstrap password is in a file on disk.

**Generate your own JWT secrets.** Two different ones:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## Layout

```
apps/
  api/     Express + Prisma + PostgreSQL
  web/     React 18 + Vite + TanStack Query/Table + Tailwind + shadcn/ui
packages/
  types/   DTOs, enums, and the RBAC catalog — the authorization source of truth
  shared/  module registry, constants, and any rule both sides compute
```

`packages/*` ship TypeScript **source**, not build output. The API bundles them
via tsup's `noExternal`; the web app aliases them in `vite.config.ts`. That means
no build step for shared code during development, and one definition of a rule
rather than two copies that drift.

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Both apps, in parallel |
| `npm run build` | tsup → `apps/api/dist`, vite → `apps/web/dist` |
| `npm run typecheck` | All four workspaces |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Idempotent reference data — permissions, roles, org, admin |
| `npm run smoke` | End-to-end HTTP smoke test against a running API |

---

## The rules that are not style preferences

Breaking one of these produces a bug that looks like something else, so they are
worth stating flatly.

**`organizationId` always comes from the authenticated session, never from the
request.** `authenticate` reads it off the live `User` row and puts it in the
request context; services take it from `requireOrg()`. It is never accepted from a
body, a query param or a header. This is the entire multi-tenancy boundary.

**Permissions are read from the database on every request, not trusted from the
token.** The access token is trusted for identity (`sub`) and nothing else, so a
role change or a suspension takes effect immediately rather than whenever a
15-minute token happens to expire.

**`tokenVersion` is the forced-logout mechanism.** Bumping it anywhere invalidates
every outstanding access *and* refresh token for that user at once, with no
blacklist to maintain. Password changes, admin resets, suspensions and deletions
all do it.

**Refresh tokens rotate, and replay revokes the family.** Every refresh issues a
new token and revokes the old one. Presenting an already-revoked token means the
token was replayed — the whole rotation family is revoked on the spot. Only the
SHA-256 hash is stored, so a database leak cannot be used to mint sessions.

**The access token lives in memory; the refresh token is an httpOnly cookie.**
Nothing is written to `localStorage`, so an XSS payload has no long-lived
credential to steal.

**The permission catalog in `packages/types/src/rbac.ts` is the source of truth.**
`ModuleKey` and `PermissionKey` are *derived* from the `MODULE_PERMISSIONS` object
literal, so a typo in a route guard or the seeder is a compile error rather than a
silent 403. The `Permission` table is reconciled against that catalog by the seed
script — never hand-edit those rows.

**Adding a module means a registry entry, not a router edit.**
`packages/shared/src/modules.ts` drives navigation, routes and guards. The router
generates the route and its `ModuleGuard` together, so a module cannot be mounted
without its guard.

**Hiding a control in the UI is a courtesy, not a boundary.** Both layers are
required: the API enforces the permission on the route, and the UI hides what the
click would only 403 on.

**The audit log is append-only.** Nothing outside
`apps/api/src/services/audit.service.ts` writes to it, and there is no update or
delete path at all. A trail somebody can edit is not a trail.

**A release is not live until `db:seed` has run.** A release that adds a module
adds permission rows; without them the new screens load and then 403, which reads
like a broken build rather than missing data.

---

## Module shape

**API** — five files under `apps/api/src/modules/<m>/`:

| File | Holds |
| --- | --- |
| `<m>.schema.ts` | Zod schemas and the sort allow-list |
| `<m>.repository.ts` | All Prisma. `select` shapes, `where` building, sorting |
| `<m>.service.ts` | Rules, transactions, audit, DTO mapping |
| `<m>.controller.ts` | Thin: read validated input, call one service method, shape the response |
| `<m>.routes.ts` | Path + `requirePermission(...)` + `validate(...)` |

Register the router in `apps/api/src/routes/index.ts`.

**Web** — a service in `src/services/`, query keys in `lib/query-client.ts`, pages
under `src/pages/<module>/`. Lists are `DataTable` + `useListQuery`; forms are
`FormModal` + `FormField`.

**Both** — DTOs in `packages/types`. Anything both sides compute goes in
`packages/shared` and is imported, never duplicated.

The response envelope is `{ success, data }`, and for lists specifically
`data: { items, pagination }` — not `{ data: [], meta }`. Login takes
`identifier` (email *or* mobile), not `email`, and returns
`data.tokens.accessToken`.

---

## Adding your first real module

Five steps. None of them touch auth, theming or the router.

1. **Declare its permissions.** Add a line to `MODULE_PERMISSIONS` in
   `packages/types/src/rbac.ts`:

   ```ts
   invoices: [...CRUD, 'approve', 'export'],
   ```

2. **Register the module.** Add an entry to `MODULES` in
   `packages/shared/src/modules.ts` — label, path, lucide icon name, nav group,
   order, and the guard permission. Add the icon to `apps/web/src/lib/icons.ts`.

3. **Grant it and re-seed.** Add `...only('invoices', 'view', 'create')` to
   whichever entries in `ROLE_SEEDS` (`apps/api/prisma/seed/access.ts`) should
   have it, then `npm run db:seed`. The seeder inserts the new `Permission` rows
   and diffs each role's grants to match.

4. **Build the API module.** The five files above, each route guarded with
   `requirePermission('invoices:action')`, then add it to `protectedRoutes` in
   `apps/api/src/routes/index.ts`.

5. **Build the page.** Add the component to `MODULE_PAGES` in
   `apps/web/src/routes/module-routes.tsx`. Until you do, the module renders
   `ModulePlaceholder` — already routed, already guarded, just not built.

---

## What is deliberately not here

No mailer (password-reset tokens are returned in the response body in development
so the flow can be exercised without one), no file uploads, no background job
runner, no test suite, no ESLint config — `npm run lint` is a no-op that exits 0,
so do not report it as a passing check. `npm run smoke` is the thing that actually
verifies the stack, and it needs a running API and a real database.
