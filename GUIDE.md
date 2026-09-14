# Understanding this repo

The README is a reference card — accurate, but written for someone who already
knows the shape of the system. This doc is the other thing: a plain-language walk
through what's actually in here, why it's built this way, and what happens when
you run each command. Read it once, then use the README day to day.

---

## What this actually is

A **starting point**, not a product. It's everything a multi-tenant business app
needs before you write a single feature: companies, users, roles, permissions,
login, sessions, an audit trail, a settings table, and a UI component library —
all wired together and working. There are zero business screens in it on purpose.
No leads, no invoices, no products. Just the shell those things get built inside.

It was extracted from a real production ERP (ShreeHari Solar) by stripping out
everything solar-specific and keeping only the generic plumbing. So this isn't a
tutorial scaffold — it's the same auth/RBAC/audit code a real multi-tenant system
runs on, minus the domain.

## The four pieces, and why they're separate

```
apps/api/       Express + Prisma + PostgreSQL — the backend
apps/web/       React + Vite + Tailwind + shadcn/ui — the frontend
packages/types/ Shared TypeScript types and the permission catalog
packages/shared/ Shared logic — the module registry, constants
```

`packages/types` and `packages/shared` exist so the backend and frontend never
define the same thing twice. The list of permissions, the list of modules, the
shape of a "user" object — each is written once in a `packages/*` file and
imported by both apps. If you ever find yourself typing the same enum or DTO into
both `apps/api` and `apps/web`, that's a sign it belongs in `packages/` instead.

These two packages ship as plain TypeScript source, not compiled output — nothing
to rebuild while you're editing them, the API and the web app both read the
`.ts` files directly.

## How a login actually works, end to end

This is the part most starter kits get wrong or skip, so it's worth walking
through once:

1. You submit an email-or-phone (`identifier`) and password.
2. The server checks the password, checks the account isn't locked (too many
   wrong attempts locks it for a few minutes), and issues **two** tokens: a
   short-lived **access token** and a longer-lived **refresh token**.
3. The access token goes to the browser's memory (a JS variable, not
   `localStorage`) — it's never written to disk, so a malicious script running on
   the page (XSS) can't steal a long-lived credential even if it can read the
   page's memory momentarily.
4. The refresh token goes into an `httpOnly` cookie the browser can't read with
   JavaScript at all.
5. When the access token expires (short — 15 minutes by default), the browser
   silently calls a refresh endpoint using the cookie, gets a new access token
   *and a new refresh token*, and keeps going. The user never notices.
6. The old refresh token is immediately marked used. If it's ever presented
   again — meaning it was copied and someone's replaying it — the server assumes
   theft and kills every session descended from that token, not just the one
   being replayed.
7. Every permission check (`can this user create an invoice?`) hits the database
   on every request. The token only proves *who* you are, not *what you can do* —
   so revoking a role takes effect on the very next click, not whenever a token
   happens to expire.

That's why there's a `RefreshToken` table storing only a *hash* of each token
(never the raw value), and a `tokenVersion` counter on `User` that, when bumped,
instantly invalidates every token that user currently holds — used for password
changes, admin-forced logout, and suspensions.

## How permissions work

Nothing is hardcoded as `if (user.role === 'admin')` anywhere in this codebase.
Instead:

- `packages/types/src/rbac.ts` has one object literal, `MODULE_PERMISSIONS`,
  listing every module and the actions it supports — e.g.
  `users: ['view', 'create', 'update', 'delete']`.
- Two TypeScript types (`ModuleKey`, `PermissionKey`) are *derived* from that
  object automatically. Misspell a permission anywhere else in the code and it's
  a compile error, not a bug that shows up as a silent 403 in production.
- The database's `Permission` table is generated *from* that catalog by the seed
  script — you never hand-write a row into it.
- A `Role` is just a named bundle of `Permission` rows (via `RolePermission`).
  A `User` has one or more `Role`s (via `UserRole`).
- Every API route that needs protecting calls `requirePermission('invoices:approve')`
  — one line, and it's checked against the live database on that request.

Because the catalog lives in `packages/types`, both the API (to enforce it) and
the web app (to hide buttons the user can't use) import the exact same list.
Hiding a button in the UI is just a courtesy for a nicer experience — the real
boundary is always the API check, since a determined user can call the API
directly regardless of what the UI shows.

## Multi-tenancy in one sentence

Every business using this app is an `Organization`. Every `User` belongs to
exactly one `Organization`. The current user's `organizationId` is read off
their own database row on every request and is never accepted from anything the
client sends — not the request body, not a query parameter, not a header. That's
the entire wall between one company's data and another's, and it's why every
Prisma query in the codebase filters by `organizationId` sourced from
`requireOrg()`, never from user input.

## What's on screen already

Log in and you'll find working, clickable screens for:

- **Users** (`apps/web/src/pages/users`) — list, create, edit, assign roles.
- **Roles** (`apps/web/src/pages/roles`) — a permission-matrix editor: rows are
  modules, columns are actions, checkboxes are grants.
- **Audit logs** (`apps/web/src/pages/audit-logs`) — a read-only, filterable feed
  of every tracked change.
- **Account** (`apps/web/src/pages/account`) — the logged-in user's own profile
  and password change.
- **Dashboard** — an empty placeholder home screen, ready to hold whatever your
  new project's first useful chart or summary is.

Everything else in the nav is a `ModulePlaceholder` — routed and permission
guarded, just with no page built yet. That's intentional: registering a module
before it has a screen is normal here, not a bug.

## Running it for the first time

```bash
npm install
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and set:
- `DATABASE_URL` — a real Postgres connection string. If your password has an
  `@` in it, percent-encode it as `%40`.
- Two JWT secrets — generate each with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — whatever you want the first login
  to be. The seed script creates this account.

Then:

```bash
npm run -w @liveconsole-ops/api db:migrate   # creates every table
npm run db:seed                              # writes permissions, roles, the org, and the admin user
npm run dev                                  # API on :4100, web on :5273
```

Sign in at `localhost:5273` with the admin credentials from `.env`. It'll force
a password change immediately — that's deliberate, since the bootstrap password
sat in a plaintext file on disk.

## Adding your first real feature

Nothing about auth, theming, or routing needs to change. Five steps, all in the
README under "Adding your first real module," briefly:

1. Add the module's permissions to `MODULE_PERMISSIONS` in `packages/types`.
2. Register the module (nav label, icon, route) in `packages/shared`'s
   `MODULES` list.
3. Grant it to a role in the seed's `ROLE_SEEDS`, then re-run `npm run db:seed`.
4. Build the five backend files (`schema` / `repository` / `service` /
   `controller` / `routes`) under `apps/api/src/modules/<name>/`.
5. Build the page and add it to `MODULE_PAGES` in `apps/web/src/routes`.

Until step 5, the module already shows up in the sidebar and is already
permission-guarded — it just renders a "coming soon" placeholder.

## What's intentionally missing

No mailer (a password-reset token is just returned in the API response in
development, so you can test the flow without wiring up email), no file
uploads, no background jobs, no test suite, and no working ESLint config
(`npm run lint` exits 0 no matter what — don't read that as a passing check).
`npm run smoke` is what actually exercises the stack end-to-end against a real
running API and database.

## Where things came from

This was built by hand to mirror the auth/RBAC/audit design of a real production
app, not generated from a generic template. Two real bugs were found and fixed
in the process relative to the app it was modeled on: role and user queries that
weren't filtered by organization (a cross-tenant data leak), and login/logout
audit entries that lost their organization tag on certain routes. Both are fixed
here from day one.
