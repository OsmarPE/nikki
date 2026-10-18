# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Read this first

This repo pins **Next.js 16.2.6 / React 19.2.4**, versions newer than your training data. APIs, conventions,
and file structure may differ from what you expect. Before writing Next.js code (routing, data fetching,
caching, server actions, middleware, etc.), check `node_modules/next/dist/docs/` — it's the local docs mirror
for the exact installed version. Heed any deprecation notices you find there.

## Commands

Package manager is **pnpm** (`pnpm-workspace.yaml` present; ignore the stray `package-lock.json`).

```bash
pnpm dev          # start dev server (localhost:3000)
pnpm build        # production build
pnpm start        # run production build
pnpm lint         # eslint (flat config: eslint-config-next core-web-vitals + typescript)
```

Database (MySQL, via `mysql2`). Scripts read `.env.local` first, falling back to `.env`:

```bash
pnpm db:schema    # run migrations only (database/migrations/*.sql, in order)
pnpm db:seed      # run database/seed.sql only
pnpm db:setup     # schema + seed (default when no flag is passed)
node scripts/create-admin.mjs   # create an admin user directly in the DB
```

Required env vars (see `.env`): `JWT_SECRET`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

There is no test runner configured in this repo.

## Architecture

This is a single-tenant POS + inventory management system (Spanish domain language throughout: productos,
ventas, inventario, caja, clientes, cuentas por cobrar). Everything is Next.js App Router with Server Actions —
there is no separate REST API layer except for a few file-producing endpoints under `src/app/api/`
(PDF generation, Excel/backup export, image upload).

**Route groups** (`src/app/`):
- `(auth)/login` — public login page.
- `(admin)/*` — the whole authenticated panel (productos, categorias, marcas, colecciones, inventario,
  clientes, ventas, caja, cuentas-por-cobrar, dashboard, configuracion). Wrapped by `(admin)/layout.tsx`,
  which loads the session server-side and redirects to `/login` or `/sin-acceso` as needed.
- `api/pdf/[id]`, `api/export/*`, `api/upload` — route handlers for binary/file responses
  (`@react-pdf/renderer` / `pdf-lib` for PDFs, `exceljs` for spreadsheets).

**Data access — `src/actions/*.ts`**: one file per domain (`productos.ts`, `ventas.ts`, `caja.ts`,
`inventario.ts`, `clientes.ts`, `catalogos.ts`, `usuarios.ts`, `auth.ts`, `mantenimiento.ts`). All are
`'use server'` files that talk to MySQL directly via raw SQL through the shared pool in `src/lib/db.ts` —
there is no ORM. Every mutating action re-checks the session and permission itself (see Auth below) and
calls `revalidatePath` after writing. Follow this same pattern for new actions: get session → check
`tienePermiso` → parameterized query → `revalidatePath`.

**`src/lib/db.ts`**: single `mysql2` pool, stashed on `global` in dev to survive HMR (a fresh pool would be
created per dev-reload otherwise, exhausting `max_connections`). The pool is wrapped in a `Proxy` that
retries `query`/`execute` once on transient connection errors (`ETIMEDOUT`, `ECONNRESET`, etc.) — the remote
Hostinger DB host has intermittent connection failures. Always import the default export from `@/lib/db`;
don't create new pools/connections elsewhere.

**Auth** (`src/lib/auth.ts` + `src/middleware.ts`): JWT (via `jose`) stored in the `pos_session` cookie,
signed with `JWT_SECRET` (production throws at import time if unset). Payload carries `rol` (`admin` |
`vendedor`) and, for vendedores, a `permisos` map computed once at login (`src/actions/auth.ts` →
`loginAction`). Changes an admin makes to a vendedor's permissions only take effect the next time that user
logs in — permissions are not re-read per-request.

**Permissions model** (`src/lib/permisos.ts`): per-module CRUD flags (`ver`/`crear`/`editar`/`eliminar`) for
a fixed set of modules (`productos`, `categorias`, `marcas`, `colecciones`, `inventario`, `clientes`,
`ventas`, `caja`). Admins bypass all checks (`tienePermiso` always true). `MODULO_RUTA` maps each module to
its admin-panel route and is the single source of truth used by both `middleware.ts` (route-level gating)
and `primerModuloAccesible` (where to redirect a vendedor after login / on unauthorized access). Dashboard,
Configuración, and Cuentas por Cobrar are intentionally admin-only and outside the granular permission
system (they have no entry in `MODULO_RUTA`, so `middleware.ts` never grants a vendedor access regardless of
`permisos`). When adding a new permissioned module/route, update `Modulo`, `MODULOS`, and `MODULO_RUTA`
together.

**Ventas a crédito / abonos** (`database/migrations/006_ventas_abonos.sql`, `src/actions/ventas.ts`): a venta
has `tipo_venta` (`contado` | `credito`); a `credito` sale can be created with no initial payment, so
`ventas.metodo_pago` is nullable — each partial payment lives in its own `abonos` row with its own
`metodo_pago`, `usuario_id`, and `sesion_caja_id`. The outstanding balance is never stored as a column; it's
always computed as `total - SUM(abonos.monto)` (see `getCuentasPorCobrar` / `registrarAbono` in
`ventas.ts`) to avoid desync. Each abono is tied to the caja session open when it was collected, same as a
regular sale.

**Soft deletes are inconsistent by design, not by accident** — check the actual column before writing
queries:
- `productos`: `activo` (TINYINT) flag.
- `colecciones`: `deleted_at` timestamp.
- `categorias`, `marcas`, and other simple catalog tables: hard rows, no soft delete.

**Database schema**: `database/migrations/NNN_*.sql`, applied in filename order by `scripts/db-seed.mjs`.
When changing the schema, add a new numbered migration rather than editing an existing one, and update
`src/types/index.ts` (the hand-written row types used across actions/components) to match.

## UI conventions

- shadcn/ui, but configured with `"style": "base-nova"` on top of **`@base-ui/react`** (not Radix) —
  `components.json` sets this explicitly. When adding shadcn components, this affects which primitives get
  generated.
- Path aliases (`tsconfig.json` / `components.json`): `@/components`, `@/components/ui`, `@/lib`, `@/hooks`,
  bare `@/*` → `src/*`.
- Generated primitives live in `src/components/ui`; app-specific composites in `src/components/ui-custom`.
- Tailwind v4 (CSS-based config, no `tailwind.config.*`); theme lives in `src/app/globals.css`.
- Forms: `react-hook-form` + `zod` via `@hookform/resolvers`; validation schemas in `src/lib/validations.ts`.
- Tables: `@tanstack/react-table`.
